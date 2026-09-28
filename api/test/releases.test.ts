import { describe, expect, it } from 'vitest';
import {
  downloadLinks,
  isSafeTag,
  parseSha256Digest,
  toReleaseInfo,
  type GithubRelease,
} from '../src/modules/versions/releases.js';

const hash = 'a'.repeat(64);

const release: GithubRelease = {
  tag_name: '4.22.4',
  html_url: 'https://github.com/yairm210/Unciv/releases/tag/4.22.4',
  published_at: '2026-09-26T19:19:23Z',
  draft: false,
  prerelease: false,
  assets: [
    {
      name: 'Unciv.jar',
      browser_download_url: 'https://x/Unciv.jar',
      size: 10,
      digest: `sha256:${hash}`,
    },
    { name: 'UncivServer.jar', browser_download_url: 'https://x/UncivServer.jar', size: 5 },
    { name: 'Unciv.msi', browser_download_url: 'https://x/Unciv.msi', size: 1 },
  ],
};

describe('releases', () => {
  it('extracts the jars of a GitHub release', () => {
    const info = toReleaseInfo(release);
    expect(info.tag).toBe('4.22.4');
    expect(info.gameJar).toEqual({ url: 'https://x/Unciv.jar', size: 10, sha256: hash });
    expect(info.serverJar).toEqual({ url: 'https://x/UncivServer.jar', size: 5, sha256: null });
    expect(info.publishedAt?.toISOString()).toBe('2026-09-26T19:19:23.000Z');
  });

  it('fails when the release has no game jar', () => {
    expect(() => toReleaseInfo({ ...release, assets: [] })).toThrow(/Unciv\.jar/);
  });

  it('rejects tags that could escape the releases directory', () => {
    expect(isSafeTag('4.22.4')).toBe(true);
    expect(isSafeTag('../etc')).toBe(false);
    expect(isSafeTag('a/b')).toBe(false);
    expect(isSafeTag('')).toBe(false);
    expect(() => toReleaseInfo({ ...release, tag_name: '../x' })).toThrow();
  });

  it('parses sha256 digests', () => {
    expect(parseSha256Digest(`sha256:${hash.toUpperCase()}`)).toBe(hash);
    expect(parseSha256Digest('md5:abc')).toBeNull();
    expect(parseSha256Digest(undefined)).toBeNull();
  });

  it('builds official download links', () => {
    const links = downloadLinks('yairm210/Unciv', '4.22.4');
    expect(links.jar).toBe('https://github.com/yairm210/Unciv/releases/download/4.22.4/Unciv.jar');
    expect(downloadLinks('yairm210/Unciv', null).jar).toBeNull();
  });
});
