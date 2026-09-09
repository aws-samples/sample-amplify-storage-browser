import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBucketLabelMap,
  createListAllLocationItemsHandler,
  formatActionDestinationRootLabel,
  formatLocationEntryLabel,
  formatLocationTitle,
  formatNavigationRootLabel,
  formatPrivatePath,
  getBucketDisplayName,
  getNavigationCallbacks,
  getPermissionDisplayName,
  NEUTRAL_STORAGE_LABEL,
  resolveUserDisplayName,
  S3_LIST_PAGE_SIZE,
  USER_FALLBACK_LABEL,
  type ListLocationItemsHandler,
} from '../src/storageBrowserPresentation';

const PRIMARY_BUCKET = 'frauden-physical-bucket-123';
const SECONDARY_BUCKET = 'frauden-expedientes-physical-bucket-456';
const IDENTITY_ID = 'us-east-1:11111111-2222-3333-4444-555555555555';

const bucketLabels = createBucketLabelMap({
  frauden: { bucketName: PRIMARY_BUCKET },
  'frauden-expedientes': { bucketName: SECONDARY_BUCKET },
});

test('mapea los dos buckets solo por coincidencia física exacta', () => {
  assert.equal(getBucketDisplayName(PRIMARY_BUCKET, bucketLabels), 'frauden');
  assert.equal(getBucketDisplayName(SECONDARY_BUCKET, bucketLabels), 'frauden-expedientes');
  assert.equal(
    getBucketDisplayName(`${PRIMARY_BUCKET}-similar`, bucketLabels),
    NEUTRAL_STORAGE_LABEL
  );

  const normalRoute = formatNavigationRootLabel(
    `${PRIMARY_BUCKET}/doctrina`,
    bucketLabels,
    'Ana Pérez'
  );
  const unknownRoute = formatNavigationRootLabel(
    `${PRIMARY_BUCKET}-similar/doctrina`,
    bucketLabels,
    'Ana Pérez'
  );

  assert.equal(normalRoute, 'frauden/doctrina');
  assert.equal(unknownRoute, `${NEUTRAL_STORAGE_LABEL}/doctrina`);
  assert.equal(
    formatLocationTitle({ bucket: `${PRIMARY_BUCKET}-similar` }, bucketLabels, 'Ana Pérez'),
    NEUTRAL_STORAGE_LABEL
  );
  assert.ok(!normalRoute.includes(PRIMARY_BUCKET));
  assert.ok(!unknownRoute.includes(PRIMARY_BUCKET));
});

test('convierte la carpeta privada a nombre, correo o Usuario', () => {
  const privatePath = `privado/${IDENTITY_ID}/expediente`;

  assert.equal(
    resolveUserDisplayName({ name: '  Ana Pérez  ', email: 'ana@example.com' }),
    'Ana Pérez'
  );
  assert.equal(
    resolveUserDisplayName({ name: ' ', email: ' ana@example.com ' }),
    'ana@example.com'
  );
  assert.equal(resolveUserDisplayName({ name: ' ', email: ' ' }), USER_FALLBACK_LABEL);
  assert.equal(formatPrivatePath(privatePath, 'Ana Pérez'), 'Ana Pérez/expediente');
  assert.equal(formatPrivatePath(privatePath, 'ana@example.com'), 'ana@example.com/expediente');
  assert.equal(formatPrivatePath(privatePath, USER_FALLBACK_LABEL), 'Usuario/expediente');
  assert.equal(formatPrivatePath(`privado-similar/${IDENTITY_ID}`, 'Ana Pérez'), undefined);
});

test('muestra Listar/Subir solo para el perfil uploader', () => {
  assert.equal(getPermissionDisplayName(['list', 'write'], true), 'Listar/Subir');
  assert.equal(getPermissionDisplayName(['list', 'write']), 'Lectura/Escritura');
  assert.equal(getPermissionDisplayName(['get', 'list']), 'Lectura');
  assert.equal(getPermissionDisplayName(['delete']), 'Escritura');
});

test('forma rutas normales, privadas y anidadas sin datos físicos', () => {
  const normalRoot = formatNavigationRootLabel(
    `${PRIMARY_BUCKET}/doctrina`,
    bucketLabels,
    'Ana Pérez'
  );
  const normalRoute = [normalRoot, 'contratos', '2026'].join(' > ');
  const privateRoot = formatNavigationRootLabel(
    `${SECONDARY_BUCKET}/privado/${IDENTITY_ID}`,
    bucketLabels,
    'Ana Pérez'
  );
  const privateRoute = [privateRoot, 'expediente'].join(' > ');

  assert.equal(normalRoute, 'frauden/doctrina > contratos > 2026');
  assert.equal(privateRoute, 'Ana Pérez > expediente');
  assert.ok(!privateRoute.includes('privado'));
  assert.ok(!privateRoute.includes(IDENTITY_ID));
  assert.ok(!privateRoute.includes(SECONDARY_BUCKET));

  assert.equal(
    formatLocationEntryLabel(
      SECONDARY_BUCKET,
      `privado/${IDENTITY_ID}/expediente`,
      bucketLabels,
      'Ana Pérez'
    ),
    'Ana Pérez/expediente'
  );
  assert.equal(
    formatActionDestinationRootLabel(`privado/${IDENTITY_ID}`, bucketLabels, 'Ana Pérez'),
    'Ana Pérez'
  );
  assert.equal(
    formatLocationTitle(
      {
        bucket: SECONDARY_BUCKET,
        key: `privado/${IDENTITY_ID}/expediente/`,
        prefix: `privado/${IDENTITY_ID}/`,
      },
      bucketLabels,
      'Ana Pérez'
    ),
    'Ana Pérez/expediente'
  );
});

test('Arriba usa el breadcrumb anterior y desde la raíz usa Home', () => {
  const calls: string[] = [];
  const home = () => calls.push('home');
  const root = () => calls.push('root');
  const parent = () => calls.push('parent');
  const current = () => calls.push('current');

  const nestedCallbacks = getNavigationCallbacks([
    { name: 'Home', onNavigate: home },
    { name: 'raíz', onNavigate: root },
    { name: 'carpeta', onNavigate: parent },
    { name: 'actual', onNavigate: current },
  ]);
  nestedCallbacks.parent?.();
  nestedCallbacks.home?.();

  const rootCallbacks = getNavigationCallbacks([
    { name: 'Home', onNavigate: home },
    { name: 'raíz', onNavigate: root },
  ]);
  rootCallbacks.parent?.();

  assert.deepEqual(calls, ['parent', 'home', 'home']);
});

test('acumula todas las páginas S3 en orden usando lotes de 1,000', async () => {
  const requests: Array<{ nextToken?: string; pageSize?: number }> = [];
  const listPage: ListLocationItemsHandler = async (input) => {
    requests.push({
      nextToken: input.options?.nextToken,
      pageSize: input.options?.pageSize,
    });

    if (!input.options?.nextToken) {
      return {
        items: [{ id: '1', key: 'a/', type: 'FOLDER' }],
        nextToken: 'page-2',
      };
    }

    if (input.options.nextToken === 'page-2') {
      return {
        items: [{ id: '2', key: 'b/', type: 'FOLDER' }],
        nextToken: 'page-3',
      };
    }

    return {
      items: [{ id: '3', key: 'c/', type: 'FOLDER' }],
      nextToken: undefined,
    };
  };

  const listAll = createListAllLocationItemsHandler(listPage);
  const result = await listAll({
    config: {} as never,
    prefix: 'doctrina/',
    options: { pageSize: Number.MAX_SAFE_INTEGER },
  });

  assert.deepEqual(
    result.items.map(({ key }) => key),
    ['a/', 'b/', 'c/']
  );
  assert.equal(result.nextToken, undefined);
  assert.deepEqual(
    requests.map(({ nextToken }) => nextToken),
    [undefined, 'page-2', 'page-3']
  );
  assert.ok(requests.every(({ pageSize }) => pageSize === S3_LIST_PAGE_SIZE));
});

test('rechaza tokens repetidos y no presenta una lista parcial como completa', async () => {
  const listPage: ListLocationItemsHandler = async () => ({
    items: [{ id: '1', key: 'a/', type: 'FOLDER' }],
    nextToken: 'repetido',
  });
  const listAll = createListAllLocationItemsHandler(listPage);

  await assert.rejects(
    listAll({ config: {} as never, prefix: 'doctrina/' }),
    /token de continuación repetido/
  );
});

test('propaga un fallo intermedio en vez de devolver los elementos parciales', async () => {
  let requestCount = 0;
  const listPage: ListLocationItemsHandler = async () => {
    requestCount += 1;

    if (requestCount === 1) {
      return {
        items: [{ id: '1', key: 'a/', type: 'FOLDER' }],
        nextToken: 'page-2',
      };
    }

    throw new Error('fallo intermedio');
  };
  const listAll = createListAllLocationItemsHandler(listPage);

  await assert.rejects(listAll({ config: {} as never, prefix: 'doctrina/' }), /fallo intermedio/);
  assert.equal(requestCount, 2);
});

test('conserva la paginación del selector de carpetas usado por Copiar', async () => {
  const requests: Array<{ nextToken?: string; pageSize?: number }> = [];
  const listPage: ListLocationItemsHandler = async (input) => {
    requests.push({
      nextToken: input.options?.nextToken,
      pageSize: input.options?.pageSize,
    });
    return {
      items: [{ id: '1', key: 'destino/', type: 'FOLDER' }],
      nextToken: 'siguiente',
    };
  };
  const listAll = createListAllLocationItemsHandler(listPage);

  const result = await listAll({
    config: {} as never,
    prefix: 'doctrina/',
    options: { exclude: 'FILE', nextToken: 'actual', pageSize: 25 },
  });

  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], { nextToken: 'actual', pageSize: 25 });
  assert.equal(result.nextToken, 'siguiente');
});
