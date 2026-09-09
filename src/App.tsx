import {
  componentsDefault,
  createAmplifyAuthAdapter,
  createStorageBrowser,
} from '@aws-amplify/ui-react-storage/browser';
import '@aws-amplify/ui-react/styles.css';
import '@aws-amplify/ui-react-storage/styles.css';
import './App.css';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import config from '../amplify_outputs.json';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import { I18n } from 'aws-amplify/utils';
import { Authenticator, Button, translations, View } from '@aws-amplify/ui-react';
import fraudenLogo from './assets/frauden-logo.svg';
import { trackApplicationOperation } from './activityReporter';
import { listLocationItemsPage } from './listLocationItemsPage';
import { useSessionActivity, useTrackApplicationProcessing } from './sessionActivityContext';
import { SessionActivityProvider } from './sessionActivityReact';
import {
  StorageActionsList,
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
  getPermissionDisplayName,
  resolveUserDisplayName,
  USER_FALLBACK_LABEL,
  type AmplifyBucketConfig,
} from './storageBrowserPresentation';
import { trackedDownloadHandler } from './trackedDownloadHandler';
import { filterUploaderLocations, resolveUserAccess, type UserAccess } from './userAccess';

Amplify.configure(config);
I18n.putVocabularies(translations);
I18n.setLanguage('es');

const bucketLabels = createBucketLabelMap(
  Amplify.getConfig().Storage?.S3?.buckets as AmplifyBucketConfig | undefined
);
const primaryBucketName = Amplify.getConfig().Storage?.S3?.bucket;
const amplifyAuthAdapter = createAmplifyAuthAdapter();
const listAllLocationItems = createListAllLocationItemsHandler(listLocationItemsPage);
let locationAdapterSessionId: string | undefined;
let locationAdapter = amplifyAuthAdapter;

const trackedAuthAdapter = {
  ...amplifyAuthAdapter,
  listLocations: (input: Parameters<typeof amplifyAuthAdapter.listLocations>[0]) =>
    trackApplicationOperation(async () => {
      const session = await fetchAuthSession();
      const payload = session.tokens?.accessToken?.payload;

      if (!payload) {
        throw new Error('No se pudo verificar el acceso a las ubicaciones de almacenamiento.');
      }

      const access = resolveUserAccess(payload as Record<string, unknown>);
      if (locationAdapterSessionId !== access.sessionId) {
        locationAdapterSessionId = access.sessionId;
        locationAdapter = createAmplifyAuthAdapter();
      }
      const result = await locationAdapter.listLocations(input);

      if (!access.isUploader) return result;
      if (!primaryBucketName) {
        throw new Error('No se encontró la configuración del almacenamiento principal.');
      }

      return {
        ...result,
        items: filterUploaderLocations(result.items, primaryBucketName),
      };
    }),
};

const { StorageBrowser, useView } = createStorageBrowser({
  config: trackedAuthAdapter,
  actions: {
    default: {
      download: trackedDownloadHandler,
      listLocationItems: (input) => trackApplicationOperation(() => listAllLocationItems(input)),
    },
  },
  components: {
    ...componentsDefault,
    ActionDestination: StorageActionDestination,
    ActionsList: StorageActionsList,
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

function TrackedUploadView() {
  const state = useView('Upload');
  useTrackApplicationProcessing(state.isProcessing);

  return (
    <View className="amplify-storage-browser">
      <StorageBrowser.UploadView.Provider {...state}>
        <StorageBrowser.UploadView.Exit />
        <StorageBrowser.UploadView.Title />
        <View className="amplify-storage-browser__controls">
          <StorageBrowser.UploadView.OverwriteToggle />
          <View className="amplify-storage-browser__buttons">
            <StorageBrowser.UploadView.AddFolder />
            <StorageBrowser.UploadView.AddFiles />
          </View>
        </View>
        <StorageBrowser.UploadView.DropZone>
          <View className="amplify-storage-browser__data-table">
            <StorageBrowser.UploadView.TasksTable />
          </View>
        </StorageBrowser.UploadView.DropZone>
        <View className="amplify-storage-browser__summary">
          <StorageBrowser.UploadView.Destination />
          <StorageBrowser.UploadView.Statuses />
        </View>
        <View className="amplify-storage-browser__footer">
          <View className="amplify-storage-browser__message">
            <StorageBrowser.UploadView.Message />
          </View>
          <View className="amplify-storage-browser__buttons">
            <StorageBrowser.UploadView.Cancel />
            <StorageBrowser.UploadView.Start />
          </View>
        </View>
      </StorageBrowser.UploadView.Provider>
    </View>
  );
}

function TrackedCopyView() {
  const state = useView('Copy');
  useTrackApplicationProcessing(state.isProcessing);

  return (
    <View className="amplify-storage-browser">
      <StorageBrowser.CopyView.Provider {...state}>
        <StorageBrowser.CopyView.Exit />
        <StorageBrowser.CopyView.Title />
        <View className="amplify-storage-browser__data-table">
          <StorageBrowser.CopyView.TasksTable />
        </View>
        {state.isProcessing || state.isProcessingComplete ? null : (
          <>
            <View className="amplify-storage-browser__controls">
              <View className="amplify-storage-browser__search">
                <StorageBrowser.CopyView.FoldersSearch />
              </View>
              <StorageBrowser.CopyView.FoldersPagination />
            </View>
            <View className="amplify-storage-browser__data-table">
              <StorageBrowser.CopyView.FoldersLoadingIndicator />
              <StorageBrowser.CopyView.FoldersTable />
              <StorageBrowser.CopyView.FoldersMessage />
            </View>
          </>
        )}
        <View className="amplify-storage-browser__summary">
          <StorageBrowser.CopyView.Destination />
          <StorageBrowser.CopyView.Statuses />
        </View>
        <View className="amplify-storage-browser__footer">
          <StorageBrowser.CopyView.Message />
          <View className="amplify-storage-browser__buttons">
            <StorageBrowser.CopyView.Cancel />
            <StorageBrowser.CopyView.Start />
          </View>
        </View>
      </StorageBrowser.CopyView.Provider>
    </View>
  );
}

function TrackedDeleteView() {
  const state = useView('Delete');
  useTrackApplicationProcessing(state.isProcessing);

  return (
    <View className="amplify-storage-browser">
      <StorageBrowser.DeleteView.Provider {...state}>
        <StorageBrowser.DeleteView.Exit />
        <StorageBrowser.DeleteView.Title />
        <View className="amplify-storage-browser__data-table">
          <StorageBrowser.DeleteView.TasksTable />
        </View>
        <View className="amplify-storage-browser__summary">
          <StorageBrowser.DeleteView.Statuses />
        </View>
        <View className="amplify-storage-browser__footer">
          <View className="amplify-storage-browser__message">
            <StorageBrowser.DeleteView.Message />
          </View>
          <View className="amplify-storage-browser__buttons">
            <StorageBrowser.DeleteView.Cancel />
            <StorageBrowser.DeleteView.Start />
          </View>
        </View>
      </StorageBrowser.DeleteView.Provider>
    </View>
  );
}

function TrackedCreateFolderView() {
  const state = useView('CreateFolder');
  useTrackApplicationProcessing(state.isProcessing);

  return (
    <View className="amplify-storage-browser">
      <StorageBrowser.CreateFolderView.Provider {...state}>
        <StorageBrowser.CreateFolderView.Exit />
        <StorageBrowser.CreateFolderView.Title />
        <StorageBrowser.CreateFolderView.NameField />
        <View className="amplify-storage-browser__footer">
          <View className="amplify-storage-browser__message">
            <StorageBrowser.CreateFolderView.Message />
          </View>
          <View className="amplify-storage-browser__buttons">
            <StorageBrowser.CreateFolderView.Start />
          </View>
        </View>
      </StorageBrowser.CreateFolderView.Provider>
    </View>
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
  const { beginOperation } = useSessionActivity();

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
    const finishOperation = beginOperation();

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

      void syncRequest
        .catch((error) => {
          console.warn('No se pudo leer la respuesta de sincronización.', error);
        })
        .finally(finishOperation);

      setSyncStatus({
        type: 'success',
        message: syncKnowledgeRequestSentMessage,
      });

      window.setTimeout(() => setIsSyncing(false), syncKnowledgeButtonCooldownMs);
    } catch (error) {
      finishOperation();
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
    getPermissionName: (permissions) => getPermissionDisplayName(permissions),
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

const createStorageBrowserDisplayText = (
  userLabel: string,
  isUploader: boolean
): StorageBrowserDisplayText => ({
  ...storageBrowserDisplayTextBase,
  LocationsView: {
    ...storageBrowserDisplayTextBase.LocationsView,
    getPermissionName: (permissions) => getPermissionDisplayName(permissions, isUploader),
  },
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
  onAuthenticated: () => void;
  onSessionExpired: () => void;
  signOut?: () => void;
  username?: string;
};

type UserAccessState =
  | { status: 'loading' }
  | { access: UserAccess; status: 'ready' }
  | { message: string; status: 'error' };

function useAuthenticatedUserAccess() {
  const [state, setState] = useState<UserAccessState>({ status: 'loading' });

  useEffect(() => {
    let isCurrent = true;

    void fetchAuthSession()
      .then((session) => {
        const payload = session.tokens?.accessToken?.payload;
        if (!payload) {
          throw new Error('No se pudo leer el token de acceso de la sesión.');
        }

        const access = resolveUserAccess(payload as Record<string, unknown>);
        if (isCurrent) setState({ access, status: 'ready' });
      })
      .catch((error) => {
        if (isCurrent) {
          setState({
            message:
              error instanceof Error
                ? error.message
                : 'No se pudieron verificar los permisos de la sesión.',
            status: 'error',
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return state;
}

function ApplicationShell({
  access,
  signOut,
  username,
}: Pick<AuthenticatedContentProps, 'signOut' | 'username'> & { access: UserAccess }) {
  const userLabel = useUserDisplayName();
  const { clearSharedState } = useSessionActivity();
  const storageBrowserDisplayText = useMemo(
    () => createStorageBrowserDisplayText(userLabel, access.isUploader),
    [access.isUploader, userLabel]
  );
  const storageBrowserViews = useMemo(
    () => ({
      CopyView: TrackedCopyView,
      CreateFolderView: TrackedCreateFolderView,
      DeleteView: TrackedDeleteView,
      LocationDetailView: AllItemsLocationDetailView,
      UploadView: TrackedUploadView,
    }),
    []
  );
  const handleSignOut = () => {
    clearSharedState();
    signOut?.();
  };

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
          <Button className="sign-out-button" variation="primary" onClick={handleSignOut}>
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
        <StoragePresentationProvider
          bucketLabels={bucketLabels}
          isUploader={access.isUploader}
          userLabel={userLabel}
        >
          <StorageBrowser displayText={storageBrowserDisplayText} views={storageBrowserViews} />
        </StoragePresentationProvider>
      </section>
    </main>
  );
}

function AuthenticatedContent({
  onAuthenticated,
  onSessionExpired,
  signOut,
  username,
}: AuthenticatedContentProps) {
  const accessState = useAuthenticatedUserAccess();

  useEffect(() => {
    onAuthenticated();
  }, [onAuthenticated]);

  if (accessState.status === 'loading') {
    return (
      <div className="session-check" role="status">
        Verificando permisos de la sesión...
      </div>
    );
  }

  if (accessState.status === 'error') {
    return (
      <div className="session-check session-check--error" role="alert">
        <p>{accessState.message}</p>
        <Button variation="primary" onClick={signOut}>
          Volver a iniciar sesión
        </Button>
      </div>
    );
  }

  return (
    <SessionActivityProvider
      onExpire={onSessionExpired}
      sessionId={accessState.access.sessionId}
      userId={accessState.access.userId}
    >
      <ApplicationShell access={accessState.access} signOut={signOut} username={username} />
    </SessionActivityProvider>
  );
}

function App() {
  const [sessionExpired, setSessionExpired] = useState(false);
  const clearSessionExpiredMessage = useCallback(() => setSessionExpired(false), []);

  return (
    <>
      {sessionExpired ? (
        <div className="idle-session-message" role="alert">
          La sesión terminó después de 60 minutos de inactividad. Inicia sesión nuevamente.
        </div>
      ) : null}
      <Authenticator components={authenticatorComponents} hideSignUp>
        {({ signOut, user }) => (
          <AuthenticatedContent
            onAuthenticated={clearSessionExpiredMessage}
            onSessionExpired={() => {
              setSessionExpired(true);
              signOut?.();
            }}
            signOut={signOut}
            username={user?.username}
          />
        )}
      </Authenticator>
    </>
  );
}

export default App;
