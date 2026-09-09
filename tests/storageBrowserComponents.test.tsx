import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StorageDataTable, StoragePresentationProvider } from '../src/storageBrowserComponents';
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
