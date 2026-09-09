import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import { componentsDefault } from '@aws-amplify/ui-react-storage/browser';
import {
  formatActionDestinationRootLabel,
  formatLocationEntryLabel,
  formatNavigationRootLabel,
  getNavigationCallbacks,
  USER_FALLBACK_LABEL,
  type BucketLabelMap,
} from './storageBrowserPresentation';

type PresentationContextValue = {
  bucketLabels: BucketLabelMap;
  userLabel: string;
};

const EMPTY_BUCKET_LABELS = new Map<string, string>();

const StoragePresentationContext = createContext<PresentationContextValue>({
  bucketLabels: EMPTY_BUCKET_LABELS,
  userLabel: USER_FALLBACK_LABEL,
});

export function StoragePresentationProvider({
  bucketLabels,
  children,
  userLabel,
}: PresentationContextValue & { children: ReactNode }) {
  return (
    <StoragePresentationContext.Provider value={{ bucketLabels, userLabel }}>
      {children}
    </StoragePresentationContext.Provider>
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
  const { bucketLabels, userLabel } = useContext(StoragePresentationContext);

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
  const { bucketLabels, userLabel } = useContext(StoragePresentationContext);

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

const DefaultDataTable = componentsDefault.DataTable;
type DataTableProps = ComponentProps<NonNullable<typeof DefaultDataTable>>;
type DataTableCell = DataTableProps['rows'][number]['content'][number];

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

export function StorageDataTable({ headers, rows, ...props }: DataTableProps) {
  const { bucketLabels, userLabel } = useContext(StoragePresentationContext);
  const bucketColumnIndex = headers.findIndex(({ key }) => key === 'bucket');
  const folderColumnIndex = headers.findIndex(({ key }) => key === 'folder');
  const isLocationsTable =
    bucketColumnIndex !== -1 &&
    folderColumnIndex !== -1 &&
    headers.some(({ key }) => key === 'permission');

  if (!DefaultDataTable) {
    return null;
  }

  if (!isLocationsTable) {
    return <DefaultDataTable {...props} headers={headers} rows={rows} />;
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

  return <DefaultDataTable {...props} headers={displayHeaders} rows={displayRows} />;
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
