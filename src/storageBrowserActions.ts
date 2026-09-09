export function filterStorageActionsForUploader<T extends { actionType: string }>(
  items: T[],
  isUploader: boolean
): T[] {
  return isUploader ? items.filter(({ actionType }) => actionType === 'upload') : items;
}
