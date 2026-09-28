import type { GameVersion } from '../../db/schema.js';

export interface VersionDto {
  tag: string;
  releaseUrl: string;
  publishedAt: string | null;
  status: GameVersion['status'];
  error: string | null;
  isCurrent: boolean;
  gameJarSha256: string | null;
  hasServerJar: boolean;
  downloadedAt: string | null;
}

export function toVersionDto(version: GameVersion): VersionDto {
  return {
    tag: version.tag,
    releaseUrl: version.releaseUrl,
    publishedAt: version.publishedAt?.toISOString() ?? null,
    status: version.status,
    error: version.error,
    isCurrent: version.isCurrent,
    gameJarSha256: version.gameJarSha256,
    hasServerJar: version.serverJarSha256 !== null,
    downloadedAt: version.downloadedAt?.toISOString() ?? null,
  };
}
