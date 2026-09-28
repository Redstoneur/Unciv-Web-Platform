import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { PlatformInfo } from '../api/types';

export function usePlatform(): PlatformInfo | null {
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<PlatformInfo>('/platform')
      .then((info) => {
        if (!cancelled) setPlatform(info);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, []);

  return platform;
}
