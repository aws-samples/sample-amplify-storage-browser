import { list, type ListOutput } from '@aws-amplify/storage/internals';
import {
  S3_LIST_PAGE_SIZE,
  type ListLocationItemsHandler,
  type LocationItem,
} from './storageBrowserPresentation';

const parseFiles = (items: ListOutput['items'], excludedPath: string): LocationItem[] =>
  items
    .filter(({ path }) => path !== excludedPath)
    .map(({ path: key, lastModified, size, eTag }) => {
      const id = crypto.randomUUID();

      if (size === 0 && key.endsWith('/')) {
        return { id, key, type: 'FOLDER' };
      }

      return {
        eTag,
        id,
        key,
        lastModified: lastModified as Date,
        size: size as number,
        type: 'FILE',
      };
    });

const parseFolders = (paths: ListOutput['excludedSubpaths']): LocationItem[] =>
  paths?.map((key) => ({ id: crypto.randomUUID(), key, type: 'FOLDER' })) ?? [];

const filterDotItems = (items: LocationItem[], prefix: string) =>
  items.filter((item) => {
    const key = (item.key.startsWith(prefix) ? item.key.substring(prefix.length) : item.key).trim();

    return !['/', './', '../', '.', '..'].includes(key);
  });

const parseResult = (output: ListOutput, prefix: string) =>
  filterDotItems(
    [...parseFolders(output.excludedSubpaths), ...parseFiles(output.items, prefix)],
    prefix
  );

// Storage Browser 3.9.1 does not export its default list handler. This keeps
// that version's parsing and Access Grants credential contract while allowing
// the configured wrapper to request every continuation page.
export const listLocationItemsPage: ListLocationItemsHandler = async ({
  config,
  prefix,
  options,
}) => {
  const { bucket: bucketName, credentials, customEndpoint, region, accountId } = config;
  const {
    exclude,
    delimiter,
    nextToken,
    pageSize: requestedPageSize = S3_LIST_PAGE_SIZE,
  } = options ?? {};
  const bucket = { bucketName, region };
  const hasRootOffset = !nextToken;
  const boundedPageSize = Math.min(Math.max(requestedPageSize, 1), S3_LIST_PAGE_SIZE);
  const pageSize = Math.min(boundedPageSize + (hasRootOffset ? 1 : 0), S3_LIST_PAGE_SIZE);
  const items: LocationItem[] = [];
  const seenTokens = new Set<string>();
  let continuationToken = nextToken;

  do {
    if (continuationToken) {
      if (seenTokens.has(continuationToken)) {
        throw new Error('Se detectó un token de continuación repetido al listar la carpeta.');
      }
      seenTokens.add(continuationToken);
    }

    const output = await list({
      path: prefix,
      options: {
        bucket,
        customEndpoint,
        expectedBucketOwner: accountId,
        locationCredentialsProvider: credentials,
        nextToken: continuationToken,
        pageSize,
        subpathStrategy: {
          delimiter,
          strategy: delimiter ? 'exclude' : 'include',
        },
      },
    });
    continuationToken = output.nextToken;

    const pageItems = parseResult(output, prefix);
    items.push(...(exclude ? pageItems.filter((item) => item.type !== exclude) : pageItems));
  } while (continuationToken && items.length < boundedPageSize);

  return { items, nextToken: continuationToken };
};
