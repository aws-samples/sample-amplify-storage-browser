import React, { type ComponentProps, type ReactNode } from 'react';
import {
  Button,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  View,
} from '@aws-amplify/ui-react';
import { componentsDefault } from '@aws-amplify/ui-react-storage/browser';
import {
  formatActionDestinationRootLabel,
  formatLocationEntryLabel,
  formatNavigationRootLabel,
  getNavigationCallbacks,
  USER_FALLBACK_LABEL,
  type BucketLabelMap,
} from './storageBrowserPresentation';
import { filterStorageActionsForUploader } from './storageBrowserActions';

type PresentationContextValue = {
  bucketLabels: BucketLabelMap;
  isUploader: boolean;
  userLabel: string;
};

const EMPTY_BUCKET_LABELS = new Map<string, string>();

const StoragePresentationContext = React.createContext<PresentationContextValue>({
  bucketLabels: EMPTY_BUCKET_LABELS,
  isUploader: false,
  userLabel: USER_FALLBACK_LABEL,
});

export function StoragePresentationProvider({
  bucketLabels,
  children,
  isUploader = false,
  userLabel,
}: Omit<PresentationContextValue, 'isUploader'> & {
  children: ReactNode;
  isUploader?: boolean;
}) {
  return (
    <StoragePresentationContext.Provider value={{ bucketLabels, isUploader, userLabel }}>
      {children}
    </StoragePresentationContext.Provider>
  );
}

const DefaultActionsList = componentsDefault.ActionsList;
type ActionsListProps = ComponentProps<NonNullable<typeof DefaultActionsList>>;

export function StorageActionsList(props: ActionsListProps) {
  const { isUploader } = React.useContext(StoragePresentationContext);

  if (!DefaultActionsList) return null;

  return (
    <DefaultActionsList
      {...props}
      items={filterStorageActionsForUploader(props.items, isUploader)}
    />
  );
}

const DefaultNavigation = componentsDefault.Navigation;
type NavigationProps = ComponentProps<NonNullable<typeof DefaultNavigation>>;

function UpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 19V5m0 0-6 6m6-6 6 6" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </svg>
  );
}

export function StorageNavigation({ items }: NavigationProps) {
  const { bucketLabels, userLabel } = React.useContext(StoragePresentationContext);

  if (!items.length || !DefaultNavigation) {
    return null;
  }

  const { home, parent } = getNavigationCallbacks(items);
  const breadcrumbs = items.slice(1).map((item, index) =>
    index === 0
      ? {
          ...item,
          name: formatNavigationRootLabel(item.name ?? '', bucketLabels, userLabel),
        }
      : item
  );

  return (
    <div className="storage-navigation">
      <div className="storage-navigation__actions" aria-label="Navegación de carpetas">
        <button
          className="storage-navigation__button"
          type="button"
          aria-label="Subir un nivel"
          title="Subir un nivel"
          onClick={parent}
          disabled={!parent}
        >
          <UpIcon />
        </button>
        <button
          className="storage-navigation__button"
          type="button"
          aria-label="Ir al inicio"
          title="Ir al inicio"
          onClick={home}
          disabled={!home}
        >
          <HomeIcon />
        </button>
      </div>
      <div className="storage-navigation__breadcrumbs">
        <DefaultNavigation items={breadcrumbs} />
      </div>
    </div>
  );
}

const DefaultActionDestination = componentsDefault.ActionDestination;
type ActionDestinationProps = ComponentProps<NonNullable<typeof DefaultActionDestination>>;

export function StorageActionDestination({ items, ...props }: ActionDestinationProps) {
  const { bucketLabels, userLabel } = React.useContext(StoragePresentationContext);

  if (!DefaultActionDestination) {
    return null;
  }

  const displayItems = items.map((item, index) =>
    index === 0
      ? {
          ...item,
          name: formatActionDestinationRootLabel(item.name ?? '', bucketLabels, userLabel),
        }
      : item
  );

  return <DefaultActionDestination {...props} items={displayItems} />;
}

type DataTableProps = ComponentProps<NonNullable<(typeof componentsDefault)['DataTable']>>;
type DataTableCell = DataTableProps['rows'][number]['content'][number];
type DataTableHeader = DataTableProps['headers'][number];

// Storage Browser 3.9.1 uses these icons in table cells, but does not expose its
// DataTable renderer. Keeping the small set of paths here avoids importing the
// package's unsupported `internal` entry point.
const STORAGE_TABLE_ICON_PATHS: Record<string, string> = {
  'action-canceled':
    'M280-440h400v-80H280v80ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z',
  'action-error':
    'M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z',
  'action-info':
    'M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z',
  'action-initial':
    'M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm0 280q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z',
  'action-progress':
    'M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-155.5t86-127Q252-817 325-848.5T480-880q17 0 28.5 11.5T520-840q0 17-11.5 28.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160q133 0 226.5-93.5T800-480q0-17 11.5-28.5T840-520q17 0 28.5 11.5T880-480q0 82-31.5 155t-86 127.5q-54.5 54.5-127 86T480-80Z',
  'action-queued':
    'M280-420q25 0 42.5-17.5T340-480q0-25-17.5-42.5T280-540q-25 0-42.5 17.5T220-480q0 25 17.5 42.5T280-420Zm200 0q25 0 42.5-17.5T540-480q0-25-17.5-42.5T480-540q-25 0-42.5 17.5T420-480q0 25 17.5 42.5T480-420Zm200 0q25 0 42.5-17.5T740-480q0-25-17.5-42.5T680-540q-25 0-42.5 17.5T620-480q0 25 17.5 42.5T680-420ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z',
  'action-success':
    'm424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z',
  cancel:
    'm336-280 144-144 144 144 56-56-144-144 144-144-56-56-144 144-144-144-56 56 144 144-144 144 56 56ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z',
  download:
    'M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z',
  file: 'M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z',
  folder:
    'M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z',
  'sort-ascending': 'm280-400 200-200 200 200H280Z',
  'sort-descending': 'M480-360 280-560h400L480-360Z',
  'sort-indeterminate': 'M240-440v-80h480v80H240Z',
};

function StorageTableIcon({ className, name }: { className?: string; name?: string }) {
  if (!name || !(name in STORAGE_TABLE_ICON_PATHS)) {
    return null;
  }

  const path = STORAGE_TABLE_ICON_PATHS[name];

  return (
    <svg
      aria-hidden="true"
      className={className ? `storage-table-icon ${className}` : 'storage-table-icon'}
      focusable="false"
      viewBox="0 -960 960 960"
    >
      <path d={path} />
    </svg>
  );
}

function StorageTableHeader({ header }: { header: DataTableHeader }) {
  const { content, type } = header;

  if (type === 'checkbox') {
    return (
      <Checkbox
        checked={content.checked ?? false}
        id={content.id}
        label={content.label}
        labelHidden
        name={content.label ?? ''}
        onChange={content.onSelect}
      />
    );
  }

  if (type === 'sort') {
    const iconName = `sort-${content.sortDirection ?? 'indeterminate'}`;

    return (
      <Button
        className="amplify-storage-browser__table-sort-header"
        onClick={content.onSort}
        size="small"
        variation="link"
      >
        {content.label}
        <StorageTableIcon name={iconName} />
      </Button>
    );
  }

  return <View className="amplify-storage-browser__table-text-header">{content.text}</View>;
}

function StorageTableCell({ cell }: { cell: DataTableCell }) {
  const { content, type } = cell;

  if (type === 'button') {
    const isIconOnly = Boolean(content.icon && !content.label);
    const isCancel = isIconOnly && content.icon === 'cancel';

    return (
      <Button
        aria-label={content.ariaLabel}
        className={`amplify-storage-browser__table-button-data-cell${
          isIconOnly ? ' amplify-storage-browser__table-button-data-cell--icon-only' : ''
        }`}
        colorTheme={isCancel ? 'error' : undefined}
        isDisabled={content.isDisabled}
        onClick={content.onClick}
        size="small"
        textDecoration={isCancel ? undefined : 'underline'}
        variation="link"
      >
        <StorageTableIcon
          className={
            content.icon
              ? `amplify-storage-browser__table-button-data-cell-icon--${content.icon}`
              : undefined
          }
          name={content.icon}
        />
        {content.label}
      </Button>
    );
  }

  if (type === 'checkbox') {
    return (
      <Checkbox
        checked={content.checked ?? false}
        id={content.id}
        label={content.label}
        labelHidden
        name={content.label ?? ''}
        onChange={content.onSelect}
      />
    );
  }

  if (type === 'date') {
    return (
      <View className="amplify-storage-browser__table-date-data-cell">
        {content.displayValue ?? content.value?.toLocaleString()}
      </View>
    );
  }

  if (type === 'number') {
    return (
      <View className="amplify-storage-browser__table-number-data-cell">
        {content.displayValue ?? content.value}
      </View>
    );
  }

  return (
    <View className="amplify-storage-browser__table-text-data-cell">
      <StorageTableIcon
        className={
          content.icon
            ? `amplify-storage-browser__table-text-data-cell-icon amplify-storage-browser__table-text-data-cell-icon--${content.icon}`
            : undefined
        }
        name={content.icon}
      />
      <span className="amplify-storage-browser__table-text-data-cell-text" title={content.text}>
        {content.text}
      </span>
    </View>
  );
}

function CompatibleStorageDataTable({ headers, isLoading, rows }: DataTableProps) {
  return (
    <Table
      className="amplify-storage-browser__table"
      lineHeight="small"
      size="small"
      variation="striped"
    >
      <TableHead className="amplify-storage-browser__table-head">
        {headers.length ? (
          <TableRow className="amplify-storage-browser__table-row">
            {headers.map((header) => (
              <TableCell
                as="th"
                className="amplify-storage-browser__table-header"
                key={header.key}
                scope="col"
              >
                <StorageTableHeader header={header} />
              </TableCell>
            ))}
          </TableRow>
        ) : null}
      </TableHead>
      <TableBody className="amplify-storage-browser__table-body">
        {isLoading
          ? null
          : rows.map((row) => (
              <TableRow className="amplify-storage-browser__table-row" key={row.key}>
                {row.content.map((cell) => (
                  <TableCell className="amplify-storage-browser__table-data-cell" key={cell.key}>
                    <StorageTableCell cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}

const getCellLabel = (cell: DataTableCell | undefined) => {
  if (cell?.type === 'text') return cell.content.text ?? '';
  if (cell?.type === 'button') return cell.content.label ?? '';
  return '';
};

const withCellLabel = (cell: DataTableCell, label: string): DataTableCell => {
  if (cell.type === 'text') {
    return { ...cell, content: { ...cell.content, text: label } };
  }

  if (cell.type === 'button') {
    return { ...cell, content: { ...cell.content, label } };
  }

  return cell;
};

export function StorageDataTable({ headers, isLoading, rows }: DataTableProps) {
  const { bucketLabels, isUploader, userLabel } = React.useContext(StoragePresentationContext);
  const bucketColumnIndex = headers.findIndex(({ key }) => key === 'bucket');
  const folderColumnIndex = headers.findIndex(({ key }) => key === 'folder');
  const isLocationsTable =
    bucketColumnIndex !== -1 &&
    folderColumnIndex !== -1 &&
    headers.some(({ key }) => key === 'permission');

  if (!isLocationsTable) {
    const hiddenColumnIndexes = new Set(
      isUploader
        ? headers
            .map(({ key }, index) => (key === 'checkbox' || key === 'download' ? index : -1))
            .filter((index) => index >= 0)
        : []
    );
    const displayHeaders = headers.filter((_, index) => !hiddenColumnIndexes.has(index));
    const displayRows = rows.map((row) => ({
      ...row,
      content: row.content.filter((_, index) => !hiddenColumnIndexes.has(index)),
    }));

    return (
      <CompatibleStorageDataTable
        headers={displayHeaders}
        isLoading={isLoading}
        rows={displayRows}
      />
    );
  }

  const displayHeaders = headers.filter((_, index) => index !== bucketColumnIndex);
  const displayRows = rows.map((row) => {
    const physicalBucketName = getCellLabel(row.content[bucketColumnIndex]);
    const folderLabel = getCellLabel(row.content[folderColumnIndex]);

    return {
      ...row,
      content: row.content
        .map((cell, index) =>
          index === folderColumnIndex
            ? withCellLabel(
                cell,
                formatLocationEntryLabel(physicalBucketName, folderLabel, bucketLabels, userLabel)
              )
            : cell
        )
        .filter((_, index) => index !== bucketColumnIndex),
    };
  });

  return (
    <CompatibleStorageDataTable headers={displayHeaders} isLoading={isLoading} rows={displayRows} />
  );
}

const DefaultPagination = componentsDefault.Pagination;
type PaginationProps = ComponentProps<NonNullable<typeof DefaultPagination>>;

export function StoragePagination(props: PaginationProps) {
  const highestPage = props.highestPageVisited ?? props.page ?? 1;

  if (!DefaultPagination || (!props.hasNextPage && highestPage <= 1)) {
    return null;
  }

  return <DefaultPagination {...props} />;
}
