import {
  componentsDefault,
  createAmplifyAuthAdapter,
  createStorageBrowser,
} from '@aws-amplify/ui-react-storage/browser';
import '@aws-amplify/ui-react/styles.css';
import '@aws-amplify/ui-react-storage/styles.css';
import './App.css';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import config from '../amplify_outputs.json';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import { I18n } from 'aws-amplify/utils';
import { Authenticator, Button, translations } from '@aws-amplify/ui-react';
import fraudenLogo from './assets/frauden-logo.svg';
import { listLocationItemsPage } from './listLocationItemsPage';
import {
  StorageActionDestination,
  StorageDataTable,
  StorageNavigation,
  StoragePagination,
  StoragePresentationProvider,
} from './storageBrowserComponents';
import {
  createBucketLabelMap,
  createListAllLocationItemsHandler,
  formatLocationTitle,
  resolveUserDisplayName,
  USER_FALLBACK_LABEL,
  type AmplifyBucketConfig,
} from './storageBrowserPresentation';

Amplify.configure(config);
I18n.putVocabularies(translations);
I18n.setLanguage('es');

const bucketLabels = createBucketLabelMap(
  Amplify.getConfig().Storage?.S3?.buckets as AmplifyBucketConfig | undefined
);

const { StorageBrowser } = createStorageBrowser({
  config: createAmplifyAuthAdapter(),
  actions: {
    default: {
      listLocationItems: createListAllLocationItemsHandler(listLocationItemsPage),
    },
  },
  components: {
    ...componentsDefault,
    ActionDestination: StorageActionDestination,
    DataTable: StorageDataTable,
    Navigation: StorageNavigation,
    Pagination: StoragePagination,
  },
});

type LocationDetailViewProps = ComponentProps<typeof StorageBrowser.LocationDetailView>;
type LocationDetailViewWithInitialValuesProps = LocationDetailViewProps & {
  initialValues?: {
    delimiter?: string;
    pageSize?: number;
  };
};

const LocationDetailViewWithInitialValues = StorageBrowser.LocationDetailView as unknown as (
  props: LocationDetailViewWithInitialValuesProps
) => ReturnType<typeof StorageBrowser.LocationDetailView>;

function AllItemsLocationDetailView(props: LocationDetailViewProps) {
  return (
    <LocationDetailViewWithInitialValues
      {...props}
      initialValues={{ pageSize: Number.MAX_SAFE_INTEGER }}
    />
  );
}

type StorageBrowserDisplayText = NonNullable<Parameters<typeof StorageBrowser>[0]['displayText']>;

type KnowledgeSyncStatus = {
  message: string;
  type: 'error' | 'info' | 'success';
} | null;

const syncKnowledgeEndpoint = import.meta.env.VITE_SYNC_KNOWLEDGE_LAMBDA_URL?.trim();
const syncKnowledgeTooltip =
  'Cuando agregues nuevos documentos o elimines debes sincronizar la base de conocimiento para cargar la nueva información';
const syncKnowledgeRequestSentMessage =
  'Solicitud de sincronización enviada para todas las fuentes de datos de las 5 bases de conocimiento. Esto puede tardar un rato.';
const syncKnowledgeButtonCooldownMs = 3000;

const authenticatorComponents = {
  Header() {
    return (
      <div className="auth-brand">
        <img className="auth-brand-logo" src={fraudenLogo} alt="Frauden" />
      </div>
    );
  },
};

function KnowledgeSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<KnowledgeSyncStatus>(null);

  const handleKnowledgeSync = async () => {
    if (!syncKnowledgeEndpoint) {
      setSyncStatus({
        type: 'error',
        message:
          'Configura VITE_SYNC_KNOWLEDGE_LAMBDA_URL con la URL de la Lambda para sincronizar.',
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatus({ type: 'info', message: 'Solicitando sincronización de conocimiento...' });

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      if (!idToken) {
        throw new Error('No se encontró una sesión autenticada para invocar la Lambda.');
      }

      const syncRequest = fetch(syncKnowledgeEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'syncKnowledgeBase' }),
      });

      void syncRequest.catch((error) => {
        console.warn('No se pudo leer la respuesta de sincronización.', error);
      });

      setSyncStatus({
        type: 'success',
        message: syncKnowledgeRequestSentMessage,
      });

      window.setTimeout(() => setIsSyncing(false), syncKnowledgeButtonCooldownMs);
    } catch (error) {
      setSyncStatus({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'No se pudo iniciar la sincronización de conocimiento.',
      });
      setIsSyncing(false);
    }
  };

  return (
    <div className="knowledge-sync-panel">
      <div>
        <span className="eyebrow">Base de conocimiento</span>
      </div>
      <div className="knowledge-sync-actions">
        <Button
          className="knowledge-sync-button"
          variation="primary"
          title={syncKnowledgeTooltip}
          onClick={handleKnowledgeSync}
          isDisabled={isSyncing}
        >
          {isSyncing ? 'Sincronizando...' : 'Sincronizar conocimiento'}
        </Button>
        {syncStatus ? (
          <div
            className={`knowledge-sync-status knowledge-sync-status--${syncStatus.type}`}
            role={syncStatus.type === 'error' ? 'alert' : 'status'}
          >
            {syncStatus.message}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const storageBrowserDisplayTextBase: StorageBrowserDisplayText = {
  LocationsView: {
    title: 'Inicio',
    searchPlaceholder: 'Filtrar carpetas y archivos',
    searchSubmitLabel: 'Buscar',
    searchClearLabel: 'Limpiar búsqueda',
    loadingIndicatorLabel: 'Cargando',
    tableColumnBucketHeader: 'Bucket',
    tableColumnFolderHeader: 'Carpeta',
    tableColumnPermissionsHeader: 'Permisos',
    tableColumnActionsHeader: 'Acciones',
    getPermissionName: (permissions) => {
      const canRead = permissions.includes('get') || permissions.includes('list');
      const canWrite = permissions.includes('write') || permissions.includes('delete');

      if (canRead && canWrite) return 'Lectura/Escritura';
      if (canRead) return 'Lectura';
      if (canWrite) return 'Escritura';

      return permissions.join('/');
    },
    getDownloadLabel: (fileName) => `Descargar ${fileName}`,
    getListLocationsResultMessage: (data) => {
      const { isLoading, items, hasExhaustedSearch, hasError = false, message } = data ?? {};

      if (isLoading) return undefined;
      if (hasError) {
        return {
          type: 'error',
          content: message ?? 'Ocurrió un error al cargar las ubicaciones.',
        };
      }
      if (items?.length === 0 && !hasExhaustedSearch) {
        return { type: 'info', content: 'No hay carpetas ni archivos.' };
      }
      if (hasExhaustedSearch) {
        return {
          type: 'info',
          content: 'Se muestran resultados de hasta los primeros 10,000 elementos.',
        };
      }

      return undefined;
    },
  },
  LocationDetailView: {
    loadingIndicatorLabel: 'Cargando',
    searchPlaceholder: 'Buscar en la carpeta actual',
    searchSubmitLabel: 'Buscar',
    searchClearLabel: 'Limpiar búsqueda',
    searchSubfoldersToggleLabel: 'Incluir subcarpetas',
    selectFileLabel: 'Seleccionar archivo',
    selectAllFilesLabel: 'Seleccionar todos los archivos',
    tableColumnLastModifiedHeader: 'Última modificación',
    tableColumnNameHeader: 'Nombre',
    tableColumnSizeHeader: 'Tamaño',
    tableColumnTypeHeader: 'Tipo',
    getTitle: () => '',
    getActionListItemLabel: (key = '') => {
      const labels: Record<string, string> = {
        Copy: 'Copiar',
        Delete: 'Eliminar',
        'Create folder': 'Crear carpeta',
        Upload: 'Subir',
      };

      return labels[key] ?? key;
    },
    getListItemsResultMessage: (data) => {
      const { items, hasExhaustedSearch, hasError = false, message, isLoading } = data ?? {};

      if (isLoading) return undefined;
      if (hasError) {
        return {
          type: 'error',
          content: message ?? 'Ocurrió un error al cargar los elementos.',
        };
      }
      if (!items?.length && hasExhaustedSearch) {
        return {
          type: 'info',
          content: 'No se encontraron resultados en los primeros 10,000 elementos.',
        };
      }
      if (!items?.length) return { type: 'info', content: 'No hay archivos.' };
      if (hasExhaustedSearch) {
        return {
          type: 'info',
          content: 'Se muestran resultados de hasta los primeros 10,000 elementos.',
        };
      }

      return undefined;
    },
  },
  UploadView: {
    title: 'Subir',
    actionStartLabel: 'Subir',
    actionCancelLabel: 'Cancelar',
    actionExitLabel: 'Salir',
    addFilesLabel: 'Agregar archivos',
    addFolderLabel: 'Agregar carpeta',
    overwriteToggleLabel: 'Sobrescribir archivos existentes',
    statusDisplayCanceledLabel: 'Cancelado',
    statusDisplayCompletedLabel: 'Completado',
    statusDisplayFailedLabel: 'Fallido',
    statusDisplayInProgressLabel: 'En progreso',
    statusDisplayOverwritePreventedLabel: 'Sobrescritura evitada',
    statusDisplayQueuedLabel: 'Sin iniciar',
    statusDisplayTotalLabel: 'Total',
    tableColumnFolderHeader: 'Carpeta',
    tableColumnNameHeader: 'Nombre',
    tableColumnTypeHeader: 'Tipo',
    tableColumnSizeHeader: 'Tamaño',
    tableColumnStatusHeader: 'Estado',
    tableColumnProgressHeader: 'Progreso',
    getActionCompleteMessage: () => ({
      content: 'Proceso de carga finalizado.',
      type: 'success',
    }),
  },
  DeleteView: {
    title: 'Eliminar',
    actionStartLabel: 'Eliminar',
    actionCancelLabel: 'Cancelar',
    actionExitLabel: 'Salir',
    statusDisplayCanceledLabel: 'Cancelado',
    statusDisplayCompletedLabel: 'Completado',
    statusDisplayFailedLabel: 'Fallido',
    statusDisplayInProgressLabel: 'En progreso',
    statusDisplayQueuedLabel: 'Sin iniciar',
    statusDisplayTotalLabel: 'Total',
    tableColumnFolderHeader: 'Carpeta',
    tableColumnNameHeader: 'Nombre',
    tableColumnTypeHeader: 'Tipo',
    tableColumnSizeHeader: 'Tamaño',
    tableColumnStatusHeader: 'Estado',
    getActionCompleteMessage: () => ({
      content: 'Proceso de eliminación finalizado.',
      type: 'success',
    }),
  },
  CopyView: {
    title: 'Copiar',
    actionStartLabel: 'Copiar',
    actionCancelLabel: 'Cancelar',
    actionExitLabel: 'Salir',
    actionDestinationLabel: 'Destino de la copia',
    loadingIndicatorLabel: 'Cargando' as 'Loading',
    overwriteWarningMessage:
      'Los archivos copiados sobrescribirán archivos existentes en el destino seleccionado.',
    searchPlaceholder: 'Buscar carpetas',
    searchSubmitLabel: 'Buscar',
    searchClearLabel: 'Limpiar búsqueda',
    statusDisplayCanceledLabel: 'Cancelado',
    statusDisplayCompletedLabel: 'Completado',
    statusDisplayFailedLabel: 'Fallido',
    statusDisplayInProgressLabel: 'En progreso',
    statusDisplayQueuedLabel: 'Sin iniciar',
    statusDisplayTotalLabel: 'Total',
    tableColumnFolderHeader: 'Carpeta',
    tableColumnNameHeader: 'Nombre',
    tableColumnTypeHeader: 'Tipo',
    tableColumnSizeHeader: 'Tamaño',
    tableColumnStatusHeader: 'Estado',
    tableColumnProgressHeader: 'Progreso',
    getListFoldersResultsMessage: ({ folders, query, hasError, message, hasExhaustedSearch }) => {
      if (!folders?.length) {
        return {
          content: query
            ? `No se encontraron carpetas que coincidan con "${query}".`
            : 'No se encontraron subcarpetas en la carpeta seleccionada.',
          type: 'info',
        };
      }
      if ((message && query) || hasError)
        return { content: 'Error al cargar carpetas.', type: 'error' };
      if (hasExhaustedSearch) {
        return {
          content: 'Se muestran resultados de hasta los primeros 10,000 elementos.',
          type: 'info',
        };
      }

      return undefined;
    },
    getActionCompleteMessage: () => ({
      content: 'Proceso de copia finalizado.',
      type: 'success',
    }),
  },
  CreateFolderView: {
    title: 'Crear carpeta',
    actionStartLabel: 'Crear carpeta',
    actionCancelLabel: 'Cancelar',
    actionExitLabel: 'Salir',
    actionDestinationLabel: 'Destino',
    folderNameLabel: 'Nombre de la carpeta',
    folderNamePlaceholder: 'No puede contener "/" ni empezar o terminar con "."',
    getValidationMessage: () => 'El nombre no puede contener "/" ni empezar o terminar con "."',
    getActionCompleteMessage: () => ({
      content: 'Carpeta creada.',
      type: 'success',
    }),
  },
};

const createStorageBrowserDisplayText = (userLabel: string): StorageBrowserDisplayText => ({
  ...storageBrowserDisplayTextBase,
  LocationDetailView: {
    ...storageBrowserDisplayTextBase.LocationDetailView,
    getTitle: ({ current, key }) =>
      formatLocationTitle(
        {
          bucket: current?.bucket,
          key,
          prefix: current?.prefix,
        },
        bucketLabels,
        userLabel
      ),
  },
});

function useUserDisplayName() {
  const [userLabel, setUserLabel] = useState(USER_FALLBACK_LABEL);

  useEffect(() => {
    let isCurrent = true;

    void fetchUserAttributes()
      .then((attributes) => {
        if (isCurrent) {
          setUserLabel(resolveUserDisplayName(attributes));
        }
      })
      .catch(() => {
        if (isCurrent) {
          setUserLabel(USER_FALLBACK_LABEL);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return userLabel;
}

type AuthenticatedContentProps = {
  signOut?: () => void;
  username?: string;
};

function AuthenticatedContent({ signOut, username }: AuthenticatedContentProps) {
  const userLabel = useUserDisplayName();
  const storageBrowserDisplayText = useMemo(
    () => createStorageBrowserDisplayText(userLabel),
    [userLabel]
  );

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Frauden - Inicio">
          <img className="brand-logo" src={fraudenLogo} alt="Frauden" />
        </a>
        <div className="header-actions">
          <div className="user-card" aria-label="Usuario conectado">
            <span className="eyebrow">Sesión activa</span>
            <strong>{username ?? USER_FALLBACK_LABEL}</strong>
          </div>
          <Button className="sign-out-button" variation="primary" onClick={signOut}>
            Cerrar sesión
          </Button>
        </div>
      </header>

      <section className="hero-card" aria-labelledby="storage-title">
        <div>
          <span className="eyebrow">Panel seguro</span>
          <h1 id="storage-title">Gestor documental de Frauden</h1>
          <p>
            carga archivos y organiza de forma segura y sencilla el archivo documental de Frauden.
          </p>
        </div>
      </section>

      <section className="storage-card" aria-label="Explorador de almacenamiento">
        <KnowledgeSyncButton />
        <StoragePresentationProvider bucketLabels={bucketLabels} userLabel={userLabel}>
          <StorageBrowser
            displayText={storageBrowserDisplayText}
            views={{ LocationDetailView: AllItemsLocationDetailView }}
          />
        </StoragePresentationProvider>
      </section>
    </main>
  );
}

function App() {
  return (
    <Authenticator components={authenticatorComponents} hideSignUp>
      {({ signOut, user }) => <AuthenticatedContent signOut={signOut} username={user?.username} />}
    </Authenticator>
  );
}

export default App;
