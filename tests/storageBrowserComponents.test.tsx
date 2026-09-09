import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  StorageActionsList,
  StorageDataTable,
  StoragePresentationProvider,
} from '../src/storageBrowserComponents';
import { filterStorageActionsForUploader } from '../src/storageBrowserActions';
import { createBucketLabelMap } from '../src/storageBrowserPresentation';

const PHYSICAL_BUCKET = 'frauden-expedientes-physical-bucket-456';
const IDENTITY_ID = 'us-east-1:11111111-2222-3333-4444-555555555555';

test('renderiza la tabla inicial sin depender de componentsDefault.DataTable', () => {
  const headers = [
    {
      key: 'folder',
      type: 'sort' as const,
      content: { label: 'Carpeta' },
    },
    {
      key: 'bucket',
      type: 'sort' as const,
      content: { label: 'Bucket' },
    },
    {
      key: 'permission',
      type: 'sort' as const,
      content: { label: 'Permisos' },
    },
  ];
  const rows = [
    {
      key: 'location-1',
      content: [
        {
          key: 'folder-location-1',
          type: 'button' as const,
          content: { label: `privado/${IDENTITY_ID}/` },
        },
        {
          key: 'bucket-location-1',
          type: 'text' as const,
          content: { text: PHYSICAL_BUCKET },
        },
        {
          key: 'permission-location-1',
          type: 'text' as const,
          content: { text: 'Lectura/Escritura' },
        },
      ],
    },
  ];
  const html = renderToStaticMarkup(
    <StoragePresentationProvider
      bucketLabels={createBucketLabelMap({
        'frauden-expedientes': { bucketName: PHYSICAL_BUCKET },
      })}
      userLabel="Ana Pérez"
    >
      <StorageDataTable headers={headers} rows={rows} />
    </StoragePresentationProvider>
  );

  assert.match(html, /<table/);
  assert.match(html, />Carpeta</);
  assert.match(html, />Permisos</);
  assert.match(html, />Ana Pérez</);
  assert.doesNotMatch(html, />Bucket</);
  assert.doesNotMatch(html, new RegExp(PHYSICAL_BUCKET));
  assert.doesNotMatch(html, new RegExp(IDENTITY_ID));
});

test('renderiza también las tablas de detalle y acciones', () => {
  const html = renderToStaticMarkup(
    <StoragePresentationProvider bucketLabels={new Map()} userLabel="Usuario">
      <StorageDataTable
        headers={[
          {
            key: 'name',
            type: 'sort',
            content: { label: 'Nombre' },
          },
          {
            key: 'size',
            type: 'text',
            content: { text: 'Tamaño' },
          },
        ]}
        rows={[
          {
            key: 'file-1',
            content: [
              {
                key: 'name-file-1',
                type: 'text',
                content: { icon: 'file', text: 'contrato.pdf' },
              },
              {
                key: 'size-file-1',
                type: 'number',
                content: { displayValue: '12 KB', value: 12_000 },
              },
            ],
          },
        ]}
      />
    </StoragePresentationProvider>
  );

  assert.match(html, /<table/);
  assert.match(html, /contrato\.pdf/);
  assert.match(html, /12 KB/);
});

test('para uploaders conserva únicamente la acción Subir', () => {
  const actions = [
    { actionType: 'copy', label: 'Copiar' },
    { actionType: 'delete', label: 'Eliminar' },
    { actionType: 'createFolder', label: 'Crear carpeta' },
    { actionType: 'upload', label: 'Subir' },
  ];
  const uploaderHtml = renderToStaticMarkup(
    <StoragePresentationProvider bucketLabels={new Map()} isUploader userLabel="Usuario">
      <StorageActionsList items={actions} />
    </StoragePresentationProvider>
  );
  const regularHtml = renderToStaticMarkup(
    <StoragePresentationProvider bucketLabels={new Map()} userLabel="Usuario">
      <StorageActionsList items={actions} />
    </StoragePresentationProvider>
  );

  assert.deepEqual(
    filterStorageActionsForUploader(actions, true).map(({ label }) => label),
    ['Subir']
  );
  assert.deepEqual(
    filterStorageActionsForUploader(actions, false).map(({ label }) => label),
    ['Copiar', 'Eliminar', 'Crear carpeta', 'Subir']
  );
  assert.match(uploaderHtml, /aria-label="Menu Toggle"/);
  assert.match(regularHtml, /aria-label="Menu Toggle"/);
});

test('oculta selección y descarga en el detalle uploader sin cambiar otros perfiles', () => {
  const headers = [
    {
      key: 'checkbox',
      type: 'checkbox' as const,
      content: { id: 'select-all', label: 'Seleccionar todos' },
    },
    { key: 'name', type: 'text' as const, content: { text: 'Nombre' } },
    { key: 'download', type: 'text' as const, content: { text: 'Descargar' } },
  ];
  const rows = [
    {
      key: 'file-1',
      content: [
        {
          key: 'checkbox-file-1',
          type: 'checkbox' as const,
          content: { id: 'select-file-1', label: 'Seleccionar archivo' },
        },
        {
          key: 'name-file-1',
          type: 'text' as const,
          content: { text: 'contrato.pdf' },
        },
        {
          key: 'download-file-1',
          type: 'button' as const,
          content: { ariaLabel: 'Descargar contrato.pdf', icon: 'download' as const },
        },
      ],
    },
  ];
  const uploaderHtml = renderToStaticMarkup(
    <StoragePresentationProvider bucketLabels={new Map()} isUploader userLabel="Usuario">
      <StorageDataTable headers={headers} rows={rows} />
    </StoragePresentationProvider>
  );
  const regularHtml = renderToStaticMarkup(
    <StoragePresentationProvider bucketLabels={new Map()} userLabel="Usuario">
      <StorageDataTable headers={headers} rows={rows} />
    </StoragePresentationProvider>
  );

  assert.match(uploaderHtml, /contrato\.pdf/);
  assert.doesNotMatch(uploaderHtml, /type="checkbox"/);
  assert.doesNotMatch(uploaderHtml, /Descargar contrato\.pdf/);
  assert.match(regularHtml, /type="checkbox"/);
  assert.match(regularHtml, /Descargar contrato\.pdf/);
});
