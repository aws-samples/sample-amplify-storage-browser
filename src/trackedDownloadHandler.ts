import { getUrl } from '@aws-amplify/storage/internals';
import type { ActionHandler } from '@aws-amplify/ui-react-storage/browser';
import { trackApplicationOperation } from './activityReporter';

const downloadFromUrl = (fileName: string, url: string) => {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.target = '_blank';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

export const trackedDownloadHandler: ActionHandler<{ fileKey: string }, { url: URL }> = ({
  config,
  data: { key },
}) => {
  const result = trackApplicationOperation(async () => {
    try {
      const { url } = await getUrl({
        path: key,
        options: {
          bucket: { bucketName: config.bucket, region: config.region },
          contentDisposition: 'attachment',
          customEndpoint: config.customEndpoint,
          expectedBucketOwner: config.accountId,
          locationCredentialsProvider: config.credentials,
          validateObjectExistence: true,
        },
      });

      downloadFromUrl(key, url.toString());
      return { status: 'COMPLETE' as const, value: { url } };
    } catch (error) {
      return {
        message: error instanceof Error ? error.message : 'No se pudo preparar la descarga.',
        status: 'FAILED' as const,
      };
    }
  });

  return { result };
};
