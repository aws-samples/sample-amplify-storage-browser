import assert from 'node:assert/strict';
import test from 'node:test';
import { filterUploaderLocations, GROUP_PRECEDENCE, resolveUserAccess } from '../src/userAccess';

const payload = (groups: string[]) => ({
  'cognito:groups': groups,
  origin_jti: 'login-123',
  sub: 'user-123',
});

test('declara precedencias únicas en el orden restrictivo acordado', () => {
  assert.deepEqual(GROUP_PRECEDENCE, ['uploaders', 'admin', 'eliminadores', 'gexpedientes']);
  assert.equal(new Set(GROUP_PRECEDENCE).size, GROUP_PRECEDENCE.length);
});

test('uploaders prevalece ante cualquier combinación de grupos privilegiados', () => {
  for (const groups of [
    ['admin', 'uploaders'],
    ['eliminadores', 'uploaders'],
    ['gexpedientes', 'uploaders'],
  ]) {
    const access = resolveUserAccess(payload(groups));
    assert.equal(access.effectiveGroup, 'uploaders');
    assert.equal(access.isUploader, true);
    assert.equal(access.sessionId, 'user-123:login-123');
  }
});

test('conserva la presentación efectiva de los demás grupos', () => {
  assert.equal(resolveUserAccess(payload(['admin'])).effectiveGroup, 'admin');
  assert.equal(resolveUserAccess(payload(['eliminadores'])).effectiveGroup, 'eliminadores');
  assert.equal(resolveUserAccess(payload(['gexpedientes'])).effectiveGroup, 'gexpedientes');
  assert.equal(resolveUserAccess(payload([])).effectiveGroup, undefined);
});

test('limita las ubicaciones uploader a las cuatro colecciones del bucket principal', () => {
  const primaryBucket = 'frauden-primary';
  const locations = [
    { bucket: primaryBucket, id: '1', prefix: 'doctrina/', permissions: ['list', 'write'] },
    { bucket: primaryBucket, id: '2', prefix: 'medios/', permissions: ['list', 'write'] },
    { bucket: primaryBucket, id: '3', prefix: 'jurisprudencia/', permissions: ['list', 'write'] },
    { bucket: primaryBucket, id: '4', prefix: 'legislacion/', permissions: ['list', 'write'] },
    { bucket: 'frauden-expedientes', id: '5', prefix: 'privado/user-123/', permissions: ['write'] },
    { bucket: primaryBucket, id: '6', prefix: 'doctrina-privada/', permissions: ['write'] },
  ];

  assert.deepEqual(
    filterUploaderLocations(locations, primaryBucket).map(({ id }) => id),
    ['1', '2', '3', '4']
  );
});

test('rechaza una sesión sin identidad estable', () => {
  assert.throws(
    () => resolveUserAccess({ 'cognito:groups': ['uploaders'], sub: 'user-123' }),
    /identificador de inicio de sesión/
  );
});
