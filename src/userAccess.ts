export const GROUP_PRECEDENCE = ['uploaders', 'admin', 'eliminadores', 'gexpedientes'] as const;

export const UPLOADER_PREFIXES = ['doctrina', 'medios', 'jurisprudencia', 'legislacion'] as const;

export type RecognizedGroup = (typeof GROUP_PRECEDENCE)[number];

export type UserAccess = {
  effectiveGroup?: RecognizedGroup;
  groups: string[];
  isUploader: boolean;
  sessionId: string;
  userId: string;
};

const getStringClaim = (payload: Record<string, unknown>, name: string) => {
  const value = payload[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

export function getCognitoGroups(payload: Record<string, unknown>): string[] {
  const value = payload['cognito:groups'];

  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.filter((group): group is string => typeof group === 'string' && Boolean(group)))
  );
}

export function resolveUserAccess(payload: Record<string, unknown>): UserAccess {
  const userId = getStringClaim(payload, 'sub');

  if (!userId) {
    throw new Error('La sesión no contiene un identificador de usuario válido.');
  }

  const groups = getCognitoGroups(payload);
  const effectiveGroup = GROUP_PRECEDENCE.find((group) => groups.includes(group));
  const originJti = getStringClaim(payload, 'origin_jti');
  const authenticationTime = payload.auth_time;
  const sessionDiscriminator =
    originJti ??
    (typeof authenticationTime === 'number' && Number.isFinite(authenticationTime)
      ? String(authenticationTime)
      : undefined);

  if (!sessionDiscriminator) {
    throw new Error('La sesión no contiene un identificador de inicio de sesión válido.');
  }

  return {
    effectiveGroup,
    groups,
    isUploader: effectiveGroup === 'uploaders',
    sessionId: `${userId}:${sessionDiscriminator}`,
    userId,
  };
}

export function filterUploaderLocations<
  T extends {
    bucket: string;
    prefix: string;
  },
>(locations: T[], primaryBucket: string): T[] {
  return locations.filter(({ bucket, prefix }) => {
    const [root] = prefix.replace(/^\/+/, '').split('/');
    return bucket === primaryBucket && UPLOADER_PREFIXES.some((allowed) => allowed === root);
  });
}
