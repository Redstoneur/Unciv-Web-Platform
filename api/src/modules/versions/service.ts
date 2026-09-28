import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { desc, eq } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../../config.js';
import type { Database } from '../../db/client.js';
import { gameVersions, type GameVersion } from '../../db/schema.js';
import { AppError } from '../../lib/errors.js';
import {
  GAME_JAR_ASSET,
  isSafeTag,
  SERVER_JAR_ASSET,
  toReleaseInfo,
  type GithubRelease,
  type ReleaseAsset,
  type ReleaseInfo,
} from './releases.js';

/** File inside RELEASES_DIR holding the active version tag (read by the multiplayer server image). */
export const CURRENT_VERSION_FILE = 'current';

export interface VersionServiceOptions {
  config: Config;
  db: Database;
  logger: FastifyBaseLogger;
  /** Called after a version becomes the current one. */
  onActivated?: (tag: string) => Promise<void>;
}

/**
 * Keeps the official Unciv release jars in sync with GitHub:
 * download, integrity check, activation and periodic update checks.
 */
export class VersionService {
  private readonly installing = new Map<string, Promise<GameVersion>>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly options: VersionServiceOptions) {}

  private get config(): Config {
    return this.options.config;
  }

  private get db(): Database {
    return this.options.db;
  }

  list(): Promise<GameVersion[]> {
    return this.db.query.gameVersions.findMany({ orderBy: desc(gameVersions.createdAt) });
  }

  async getCurrent(): Promise<GameVersion | null> {
    const current = await this.db.query.gameVersions.findFirst({
      where: eq(gameVersions.isCurrent, true),
    });
    return current ?? null;
  }

  async fetchRelease(tag?: string): Promise<ReleaseInfo> {
    if (tag !== undefined && !isSafeTag(tag)) throw new AppError(400, 'VERSION_NOT_FOUND');
    const path = tag ? `tags/${encodeURIComponent(tag)}` : 'latest';
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'unciv-web-platform',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (this.config.GITHUB_TOKEN) headers.Authorization = `Bearer ${this.config.GITHUB_TOKEN}`;

    const response = await fetch(
      `https://api.github.com/repos/${this.config.UNCIV_REPOSITORY}/releases/${path}`,
      { headers, signal: AbortSignal.timeout(30_000) },
    );
    if (response.status === 404) throw new AppError(404, 'VERSION_NOT_FOUND');
    if (!response.ok) throw new Error(`GitHub API responded with HTTP ${response.status}`);
    return toReleaseInfo((await response.json()) as GithubRelease);
  }

  /** Downloads a release (idempotent: concurrent calls share the same download). */
  install(tag?: string): Promise<GameVersion> {
    const run = async (): Promise<GameVersion> => {
      const release = await this.fetchRelease(tag);
      const pending = this.installing.get(release.tag);
      if (pending) return pending;
      const promise = this.download(release).finally(() => this.installing.delete(release.tag));
      this.installing.set(release.tag, promise);
      return promise;
    };
    return run();
  }

  private async download(release: ReleaseInfo): Promise<GameVersion> {
    const existing = await this.db.query.gameVersions.findFirst({
      where: eq(gameVersions.tag, release.tag),
    });
    if (existing?.status === 'ready') return existing;

    const log = this.options.logger.child({ version: release.tag });
    await this.db
      .insert(gameVersions)
      .values({
        tag: release.tag,
        releaseUrl: release.releaseUrl,
        publishedAt: release.publishedAt,
        status: 'downloading',
      })
      .onConflictDoUpdate({
        target: gameVersions.tag,
        set: { status: 'downloading', error: null },
      });

    const directory = join(this.config.RELEASES_DIR, release.tag);
    try {
      await mkdir(directory, { recursive: true });
      log.info('Downloading Unciv release');
      const gameJarSha256 = await this.downloadAsset(
        release.gameJar,
        join(directory, GAME_JAR_ASSET),
      );
      const serverJarSha256 = release.serverJar
        ? await this.downloadAsset(release.serverJar, join(directory, SERVER_JAR_ASSET))
        : null;

      const [ready] = await this.db
        .update(gameVersions)
        .set({ status: 'ready', gameJarSha256, serverJarSha256, downloadedAt: new Date() })
        .where(eq(gameVersions.tag, release.tag))
        .returning();
      log.info('Unciv release ready');
      if (!ready) throw new Error('Version row disappeared during download');
      return ready;
    } catch (error) {
      log.error({ err: error }, 'Unciv release download failed');
      await rm(directory, { recursive: true, force: true });
      await this.db
        .update(gameVersions)
        .set({ status: 'failed', error: error instanceof Error ? error.message : String(error) })
        .where(eq(gameVersions.tag, release.tag));
      throw error;
    }
  }

  /** Streams an asset to disk and verifies its SHA-256 against the digest published by GitHub. */
  private async downloadAsset(asset: ReleaseAsset, destination: string): Promise<string> {
    const response = await fetch(asset.url, {
      headers: { 'User-Agent': 'unciv-web-platform' },
      signal: AbortSignal.timeout(10 * 60_000),
    });
    if (!response.ok || !response.body) {
      throw new Error(`Download of ${asset.url} failed with HTTP ${response.status}`);
    }

    const hash = createHash('sha256');
    const hasher = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    const partial = `${destination}.part`;
    await pipeline(
      Readable.fromWeb(response.body as WebReadableStream),
      hasher,
      createWriteStream(partial),
    );

    const sha256 = hash.digest('hex');
    if (asset.sha256 && asset.sha256 !== sha256) {
      await rm(partial, { force: true });
      throw new Error(
        `Checksum mismatch for ${asset.url}: expected ${asset.sha256}, got ${sha256}`,
      );
    }
    await rename(partial, destination);
    return sha256;
  }

  async activate(tag: string): Promise<GameVersion> {
    const version = await this.db.query.gameVersions.findFirst({
      where: eq(gameVersions.tag, tag),
    });
    if (!version) throw new AppError(404, 'VERSION_NOT_FOUND');
    if (version.status !== 'ready') throw new AppError(409, 'VERSION_NOT_READY');

    const activated = await this.db.transaction(async (tx) => {
      await tx
        .update(gameVersions)
        .set({ isCurrent: false })
        .where(eq(gameVersions.isCurrent, true));
      const [row] = await tx
        .update(gameVersions)
        .set({ isCurrent: true })
        .where(eq(gameVersions.tag, tag))
        .returning();
      return row;
    });
    if (!activated) throw new AppError(404, 'VERSION_NOT_FOUND');

    const currentFile = join(this.config.RELEASES_DIR, CURRENT_VERSION_FILE);
    await writeFile(`${currentFile}.tmp`, `${tag}\n`);
    await rename(`${currentFile}.tmp`, currentFile);
    this.options.logger.info({ version: tag }, 'Unciv version activated');

    await this.options.onActivated?.(tag).catch((error: unknown) => {
      this.options.logger.warn({ err: error }, 'Post-activation hook failed');
    });
    return activated;
  }

  /** Installs the latest release and activates it (always when no version is active yet). */
  async checkForUpdates(): Promise<{ latest: string; activated: boolean }> {
    const version = await this.install();
    const current = await this.getCurrent();
    const shouldActivate =
      !current || (this.config.AUTO_ACTIVATE_UPDATES && current.tag !== version.tag);
    if (shouldActivate) await this.activate(version.tag);
    return { latest: version.tag, activated: shouldActivate };
  }

  startScheduler(): void {
    const check = () => {
      this.checkForUpdates().catch((error: unknown) => {
        this.options.logger.error({ err: error }, 'Unciv update check failed');
      });
    };
    check();
    const minutes = this.config.UPDATE_CHECK_INTERVAL_MINUTES;
    if (minutes > 0) this.timer = setInterval(check, minutes * 60_000);
  }

  stopScheduler(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
