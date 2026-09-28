import Docker from 'dockerode';
import type { Config } from '../../config.js';

export const LABEL_PREFIX = 'unciv-web-platform';
export const LABEL_ROLE = `${LABEL_PREFIX}.role`;
export const LABEL_SESSION = `${LABEL_PREFIX}.session`;
export const LABEL_USER = `${LABEL_PREFIX}.user`;

export const GAME_ROLE = 'game';
export const MULTIPLAYER_ROLE = 'multiplayer';
/** Port served by websockify/noVNC inside the game image. */
export const GAME_HTTP_PORT = 6080;

export interface GameContainerSpec {
  sessionId: string;
  userId: string;
  version: string;
  vncPassword: string;
  env: Record<string, string>;
}

export interface ContainerState {
  running: boolean;
  healthy: boolean;
  unhealthy: boolean;
  exited: boolean;
}

/** Builds a Docker client from a `unix:///path`, `tcp://host:port` or plain socket path value. */
export function createDockerClient(target: string): Docker {
  if (/^(tcp|http):\/\//.test(target)) {
    const url = new URL(target);
    return new Docker({ protocol: 'http', host: url.hostname, port: Number(url.port || 2375) });
  }
  return new Docker({ socketPath: target.replace(/^unix:\/\//, '') });
}

export function userVolumeName(config: Pick<Config, 'USER_VOLUME_PREFIX'>, userId: string): string {
  return `${config.USER_VOLUME_PREFIX}${userId}`;
}

export function gameContainerName(sessionId: string): string {
  return `unciv-game-${sessionId}`;
}

/** Traefik labels routing `/play/<sessionId>/…` to the container, protected by forward auth. */
export function traefikLabels(sessionId: string, network: string): Record<string, string> {
  const name = `unciv-game-${sessionId}`;
  return {
    'traefik.enable': 'true',
    'traefik.docker.network': network,
    [`traefik.http.routers.${name}.rule`]: `PathPrefix(\`/play/${sessionId}/\`)`,
    [`traefik.http.routers.${name}.entrypoints`]: 'web',
    [`traefik.http.routers.${name}.middlewares`]: `game-auth@file,${name}-strip`,
    [`traefik.http.middlewares.${name}-strip.stripprefix.prefixes`]: `/play/${sessionId}`,
    [`traefik.http.services.${name}.loadbalancer.server.port`]: String(GAME_HTTP_PORT),
  };
}

export class DockerService {
  readonly docker: Docker;

  constructor(private readonly config: Config) {
    this.docker = createDockerClient(config.DOCKER_SOCKET);
  }

  async ping(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  async startGameContainer(spec: GameContainerSpec): Promise<string> {
    const { config } = this;
    const volume = userVolumeName(config, spec.userId);
    await this.ensureVolume(volume, spec.userId);

    const container = await this.docker.createContainer({
      name: gameContainerName(spec.sessionId),
      Image: config.GAME_IMAGE,
      Env: Object.entries({
        ...spec.env,
        UNCIV_VERSION: spec.version,
        VNC_PASSWORD: spec.vncPassword,
        SCREEN_WIDTH: String(config.GAME_SCREEN_WIDTH),
        SCREEN_HEIGHT: String(config.GAME_SCREEN_HEIGHT),
      }).map(([key, value]) => `${key}=${value}`),
      Labels: {
        [LABEL_ROLE]: GAME_ROLE,
        [LABEL_SESSION]: spec.sessionId,
        [LABEL_USER]: spec.userId,
        ...traefikLabels(spec.sessionId, config.GAME_NETWORK),
      },
      HostConfig: {
        AutoRemove: true,
        NetworkMode: config.GAME_NETWORK,
        NanoCpus: Math.round(config.GAME_CPU_LIMIT * 1e9),
        Memory: config.GAME_MEMORY_MB * 1024 * 1024,
        MemorySwap: config.GAME_MEMORY_MB * 1024 * 1024,
        PidsLimit: 512,
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        Mounts: [
          { Type: 'volume', Source: volume, Target: '/data' },
          { Type: 'volume', Source: config.RELEASES_VOLUME, Target: '/releases', ReadOnly: true },
        ],
        Tmpfs: { '/tmp': 'rw,nosuid,nodev,exec,size=512m' },
      },
    });
    await container.start();
    return container.id;
  }

  async getContainerState(containerId: string): Promise<ContainerState | null> {
    try {
      const info = await this.docker.getContainer(containerId).inspect();
      const health = info.State.Health?.Status;
      return {
        running: info.State.Running,
        healthy: info.State.Running && (health === undefined || health === 'healthy'),
        unhealthy: health === 'unhealthy',
        exited: !info.State.Running && info.State.Status !== 'created',
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async stopContainer(containerId: string): Promise<void> {
    try {
      await this.docker.getContainer(containerId).stop({ t: 10 });
    } catch (error) {
      if (!isNotFound(error) && !isNotModified(error)) throw error;
    }
  }

  /** IDs of the session containers currently known by Docker. */
  async listGameSessionIds(): Promise<Map<string, string>> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: { label: [`${LABEL_ROLE}=${GAME_ROLE}`] },
    });
    return new Map(
      containers.flatMap((container) => {
        const sessionId = container.Labels[LABEL_SESSION];
        return sessionId ? [[sessionId, container.Id] as const] : [];
      }),
    );
  }

  async restartByRole(role: string): Promise<number> {
    const containers = await this.docker.listContainers({
      filters: { label: [`${LABEL_ROLE}=${role}`] },
    });
    await Promise.all(containers.map((c) => this.docker.getContainer(c.Id).restart({ t: 10 })));
    return containers.length;
  }

  async removeUserVolume(userId: string): Promise<void> {
    try {
      await this.docker.getVolume(userVolumeName(this.config, userId)).remove();
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  private async ensureVolume(name: string, userId: string): Promise<void> {
    try {
      await this.docker.getVolume(name).inspect();
    } catch (error) {
      if (!isNotFound(error)) throw error;
      await this.docker.createVolume({
        Name: name,
        Labels: { [LABEL_ROLE]: 'user-data', [LABEL_USER]: userId },
      });
    }
  }
}

function statusCode(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'statusCode' in error
    ? Number(error.statusCode)
    : undefined;
}

const isNotFound = (error: unknown) => statusCode(error) === 404;
const isNotModified = (error: unknown) => statusCode(error) === 304;
