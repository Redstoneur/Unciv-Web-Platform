import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { GameSession } from '../api/types';

const STARTING_POLL_MS = 2_000;
const HEARTBEAT_MS = 60_000;

interface UseGameSession {
  session: GameSession | null;
  loading: boolean;
  error: unknown;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Tracks the user's game session. Polls while the game is starting and, when `keepAlive`
 * is set (game page open), sends heartbeats so the idle timeout does not stop the game.
 */
export function useGameSession({ keepAlive = false } = {}): UseGameSession {
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const fetchCurrent = useCallback(
    () =>
      api.get<{ session: GameSession | null }>('/sessions/current').then((data) => data.session),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    fetchCurrent()
      .then((current) => {
        if (!cancelled) setSession(current);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchCurrent]);

  const status = session?.status;
  useEffect(() => {
    if (status !== 'starting') return;
    const timer = setInterval(() => {
      fetchCurrent().then(setSession).catch(setError);
    }, STARTING_POLL_MS);
    return () => clearInterval(timer);
  }, [status, fetchCurrent]);

  useEffect(() => {
    if (!keepAlive || status !== 'running') return;
    const beat = () => {
      api
        .post<{ session: GameSession }>('/sessions/current/heartbeat')
        .then((data) => setSession(data.session))
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.code === 'SESSION_NOT_FOUND') setSession(null);
        });
    };
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [keepAlive, status]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const data = await api.post<{ session: GameSession }>('/sessions');
      setSession(data.session);
    } catch (err) {
      setError(err);
    }
  }, []);

  const stop = useCallback(async () => {
    setError(null);
    try {
      await api.delete('/sessions/current');
      setSession(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  return { session, loading, error, start, stop };
}
