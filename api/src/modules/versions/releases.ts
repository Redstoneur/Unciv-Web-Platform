/** Pure helpers around GitHub releases of Unciv (kept free of I/O to be unit-testable). */

export const GAME_JAR_ASSET = 'Unciv.jar';
export const SERVER_JAR_ASSET = 'UncivServer.jar';

export interface GithubAsset {
  name: string;
  browser_download_url: string;
  size: number;
  digest?: string | null;
}

export interface GithubRelease {
  tag_name: string;
  html_url: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: GithubAsset[];
}

export interface ReleaseAsset {
  url: string;
  size: number;
  sha256: string | null;
}

export interface ReleaseInfo {
  tag: string;
  releaseUrl: string;
  publishedAt: Date | null;
  gameJar: ReleaseAsset;
  serverJar: ReleaseAsset | null;
}

const SAFE_TAG = /^[\w][\w.-]{0,63}$/;

/** Tags are used as directory names: only allow a conservative character set. */
export function isSafeTag(tag: string): boolean {
  return SAFE_TAG.test(tag) && !tag.includes('..');
}

/** Extracts the hex hash from a GitHub asset digest such as `sha256:abcd…`. */
export function parseSha256Digest(digest: string | null | undefined): string | null {
  const match = /^sha256:([a-f0-9]{64})$/i.exec(digest ?? '');
  return match?.[1]?.toLowerCase() ?? null;
}

function toAsset(asset: GithubAsset | undefined): ReleaseAsset | null {
  if (!asset) return null;
  return {
    url: asset.browser_download_url,
    size: asset.size,
    sha256: parseSha256Digest(asset.digest),
  };
}

export function toReleaseInfo(release: GithubRelease): ReleaseInfo {
  if (!isSafeTag(release.tag_name)) {
    throw new Error(`Unsupported release tag "${release.tag_name}"`);
  }
  const gameJar = toAsset(release.assets.find((asset) => asset.name === GAME_JAR_ASSET));
  if (!gameJar) {
    throw new Error(`Release ${release.tag_name} does not provide ${GAME_JAR_ASSET}`);
  }
  return {
    tag: release.tag_name,
    releaseUrl: release.html_url,
    publishedAt: release.published_at ? new Date(release.published_at) : null,
    gameJar,
    serverJar: toAsset(release.assets.find((asset) => asset.name === SERVER_JAR_ASSET)),
  };
}

export function downloadLinks(repository: string, tag: string | null) {
  const releasesPage = `https://github.com/${repository}/releases`;
  if (!tag) return { releasesPage, jar: null, windows: null, linux: null, android: null };
  const base = `${releasesPage}/download/${encodeURIComponent(tag)}`;
  return {
    releasesPage,
    jar: `${base}/Unciv.jar`,
    windows: `${base}/Unciv-Windows64.zip`,
    linux: `${base}/Unciv-Linux64.zip`,
    android: `${base}/Unciv-signed.apk`,
  };
}
