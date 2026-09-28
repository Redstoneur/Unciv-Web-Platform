import type { Config } from '../../config.js';
import type { User } from '../../db/schema.js';
import { resolvePublicMultiplayerServer } from '../../lib/multiplayer.js';

export interface UserDto {
  id: string;
  email: string;
  username: string;
  role: User['role'];
  locale: string;
  uncivUserId: string;
  multiplayerMode: User['multiplayerMode'];
  customMultiplayerUrl: string | null;
  /** Server URL to configure in the standalone game to keep playing the same multiplayer games. */
  multiplayerServerUrl: string;
  createdAt: string;
}

export function toUserDto(user: User, config: Config): UserDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    locale: user.locale,
    uncivUserId: user.uncivUserId,
    multiplayerMode: user.multiplayerMode,
    customMultiplayerUrl: user.customMultiplayerUrl,
    multiplayerServerUrl: resolvePublicMultiplayerServer(user, config),
    createdAt: user.createdAt.toISOString(),
  };
}
