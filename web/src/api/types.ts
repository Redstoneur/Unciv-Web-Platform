/** Types mirroring the API responses (see api/src/modules). */

export type Role = 'user' | 'admin';
export type MultiplayerMode = 'official' | 'platform' | 'custom';
export type SessionStatus = 'starting' | 'running' | 'stopped' | 'failed';
export type VersionStatus = 'downloading' | 'ready' | 'failed';

export interface User {
  id: string;
  email: string;
  username: string;
  role: Role;
  locale: string;
  uncivUserId: string;
  multiplayerMode: MultiplayerMode;
  customMultiplayerUrl: string | null;
  multiplayerServerUrl: string;
  createdAt: string;
}

export interface GameSession {
  id: string;
  status: SessionStatus;
  version: string;
  playUrl: string | null;
  createdAt: string;
  lastSeenAt: string;
  stopReason: string | null;
}

export interface DownloadLinks {
  releasesPage: string;
  jar: string | null;
  windows: string | null;
  linux: string | null;
  android: string | null;
}

export interface PlatformInfo {
  registrationEnabled: boolean;
  currentVersion: string | null;
  releaseUrl: string | null;
  locales: string[];
  defaultLocale: string;
  multiplayer: {
    officialServerUrl: string;
    platformServerUrl: string | null;
  };
  downloads: DownloadLinks;
  sourceCode: string;
}

export interface GameVersion {
  tag: string;
  releaseUrl: string;
  publishedAt: string | null;
  status: VersionStatus;
  error: string | null;
  isCurrent: boolean;
  gameJarSha256: string | null;
  hasServerJar: boolean;
  downloadedAt: string | null;
}

export interface AdminOverview {
  users: number;
  activeSessions: number;
  maxSessions: number;
  currentVersion: string | null;
  dockerAvailable: boolean;
}

export interface AdminSession {
  id: string;
  status: SessionStatus;
  version: string;
  createdAt: string;
  lastSeenAt: string;
  userId: string;
  username: string;
}
