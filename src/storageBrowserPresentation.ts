import type { LocationCredentialsProvider } from '@aws-amplify/storage/internals';

export const NEUTRAL_STORAGE_LABEL = 'Almacenamiento';
export const PRIVATE_STORAGE_PREFIX = 'privado';
export const S3_LIST_PAGE_SIZE = 1000;
export const USER_FALLBACK_LABEL = 'Usuario';

export type BucketLabelMap = ReadonlyMap<string, string>;

export type AmplifyBucketConfig = Record<
  string,
  {
    bucketName?: string;
  }
>;

export type NavigationItem = {
  isCurrent?: boolean;
  name?: string;
  onNavigate?: () => void;
};

export type LocationItem =
  | {
      id: string;
      key: string;
      type: 'FOLDER';
    }
  | {
      eTag?: string;
      id: string;
      key: string;
      lastModified: Date;
      size: number;
      type: 'FILE';
    };

export type ListLocationItemsHandlerInput = {
  config: {
    accountId?: string;
    bucket: string;
    credentials: LocationCredentialsProvider;
    customEndpoint?: string;
    region: string;
  };
  options?: {
    delimiter?: string;
    exclude?: LocationItem['type'];
    nextToken?: string;
    pageSize?: number;
  };
  prefix: string;
};

export type ListLocationItemsHandlerOutput = {
  items: LocationItem[];
  nextToken: string | undefined;
};

export type ListLocationItemsHandler = (
  input: ListLocationItemsHandlerInput
) => Promise<ListLocationItemsHandlerOutput>;

const trimPath = (path: string) => path.replace(/^\/+|\/+$/g, '');

const getPathParts = (path: string) => {
  const normalizedPath = trimPath(path.trim());
  return normalizedPath ? normalizedPath.split('/') : [];
};

const isConfiguredLogicalName = (value: string, bucketLabels: BucketLabelMap) =>
  Array.from(bucketLabels.values()).includes(value);

export function createBucketLabelMap(buckets?: AmplifyBucketConfig): Map<string, string> {
  const bucketLabels = new Map<string, string>();

  for (const [logicalName, bucket] of Object.entries(buckets ?? {})) {
    const physicalName = bucket?.bucketName?.trim();
    const displayName = logicalName.trim();

    if (physicalName && displayName) {
      bucketLabels.set(physicalName, displayName);
    }
  }

  return bucketLabels;
}

export function getBucketDisplayName(physicalName: string, bucketLabels: BucketLabelMap): string {
  return bucketLabels.get(physicalName) ?? NEUTRAL_STORAGE_LABEL;
}

export function resolveUserDisplayName(attributes?: { email?: string; name?: string }): string {
  return attributes?.name?.trim() || attributes?.email?.trim() || USER_FALLBACK_LABEL;
}

export function getPermissionDisplayName(
  permissions: readonly string[],
  isUploader = false
): string {
  if (isUploader && permissions.includes('list') && permissions.includes('write')) {
    return 'Listar/Subir';
  }

  const canRead = permissions.includes('get') || permissions.includes('list');
  const canWrite = permissions.includes('write') || permissions.includes('delete');

  if (canRead && canWrite) return 'Lectura/Escritura';
  if (canRead) return 'Lectura';
  if (canWrite) return 'Escritura';

  return permissions.join('/');
}

export function formatPrivatePath(path: string, userLabel: string): string | undefined {
  const parts = getPathParts(path);

  if (parts[0] !== PRIVATE_STORAGE_PREFIX || !parts[1]) {
    return undefined;
  }

  return [userLabel, ...parts.slice(2)].join('/');
}

export function formatNavigationRootLabel(
  rawLabel: string,
  bucketLabels: BucketLabelMap,
  userLabel: string
): string {
  const parts = getPathParts(rawLabel);
  const bucketName = parts[0] ?? '';
  const physicalBucketLabel = bucketLabels.get(bucketName);
  const logicalBucketLabel =
    physicalBucketLabel ??
    (isConfiguredLogicalName(bucketName, bucketLabels) ? bucketName : NEUTRAL_STORAGE_LABEL);
  const prefix = parts.slice(1).join('/');
  const privateLabel = formatPrivatePath(prefix, userLabel);

  if (privateLabel) {
    return privateLabel;
  }

  return prefix ? `${logicalBucketLabel}/${prefix}` : logicalBucketLabel;
}

export function formatActionDestinationRootLabel(
  rawLabel: string,
  bucketLabels: BucketLabelMap,
  userLabel: string
): string {
  const normalizedLabel = trimPath(rawLabel.trim());
  const privateLabel = formatPrivatePath(normalizedLabel, userLabel);

  if (privateLabel) {
    return privateLabel;
  }

  const [firstPart] = getPathParts(normalizedLabel);
  if (bucketLabels.has(firstPart) || isConfiguredLogicalName(firstPart, bucketLabels)) {
    return formatNavigationRootLabel(normalizedLabel, bucketLabels, userLabel);
  }

  return normalizedLabel;
}

export function formatLocationEntryLabel(
  physicalBucketName: string,
  rawLabel: string,
  bucketLabels: BucketLabelMap,
  userLabel: string
): string {
  const normalizedLabel = trimPath(rawLabel.trim());

  if (!normalizedLabel || normalizedLabel === physicalBucketName) {
    return getBucketDisplayName(physicalBucketName, bucketLabels);
  }

  if (normalizedLabel.startsWith(`${physicalBucketName}/`)) {
    return formatNavigationRootLabel(normalizedLabel, bucketLabels, userLabel);
  }

  return formatPrivatePath(normalizedLabel, userLabel) ?? normalizedLabel;
}

export function formatLocationTitle(
  location: {
    bucket?: string;
    key?: string;
    prefix?: string;
  },
  bucketLabels: BucketLabelMap,
  userLabel: string
): string {
  const key = trimPath(location.key?.trim() ?? '');
  const prefix = trimPath(location.prefix?.trim() ?? '');
  const visiblePath = key || prefix;

  if (visiblePath) {
    return formatPrivatePath(visiblePath, userLabel) ?? visiblePath;
  }

  return getBucketDisplayName(location.bucket ?? '', bucketLabels);
}

export function getNavigationCallbacks(items: NavigationItem[]): {
  home?: () => void;
  parent?: () => void;
} {
  const home = items[0]?.onNavigate;
  const parent = items.length > 2 ? items[items.length - 2]?.onNavigate : home;

  return { home, parent: parent ?? home };
}

export function createListAllLocationItemsHandler(
  listPage: ListLocationItemsHandler
): ListLocationItemsHandler {
  return async (input) => {
    if (input.options?.exclude === 'FILE') {
      return listPage(input);
    }

    const items: ListLocationItemsHandlerOutput['items'] = [];
    const seenTokens = new Set<string>();
    let nextToken = input.options?.nextToken;

    while (true) {
      if (nextToken) {
        if (seenTokens.has(nextToken)) {
          throw new Error('Se detectó un token de continuación repetido al listar la carpeta.');
        }
        seenTokens.add(nextToken);
      }

      const page = await listPage({
        ...input,
        options: {
          ...input.options,
          nextToken,
          pageSize: S3_LIST_PAGE_SIZE,
        },
      });

      items.push(...page.items);

      if (!page.nextToken) {
        return { items, nextToken: undefined };
      }

      nextToken = page.nextToken;
    }
  };
}
