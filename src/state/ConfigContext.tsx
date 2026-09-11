import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_CONFIG, cloneConfig, type MasjidConfig } from '../lib/config';
import { loadConfig, saveConfig } from '../lib/storage';

interface ConfigContextValue {
  config: MasjidConfig;
  /** Apply a partial patch, or a function of the previous config. */
  update: (patch: Partial<MasjidConfig> | ((prev: MasjidConfig) => MasjidConfig)) => void;
  replace: (next: MasjidConfig) => void;
  reset: () => void;
  /** Ticks up whenever a save fails, so the UI can warn about read-only storage. */
  saveError: string | null;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<MasjidConfig>(() => loadConfig());
  const [saveError, setSaveError] = useState<string | null>(null);
  // Set while we are writing, so our own storage event does not bounce back.
  const writingRef = useRef(false);

  const persist = useCallback((next: MasjidConfig) => {
    writingRef.current = true;
    const ok = saveConfig(next);
    setSaveError(ok ? null : 'Changes could not be saved to this device’s storage.');
    // The storage event fires on *other* tabs, but clear the flag next tick anyway.
    setTimeout(() => {
      writingRef.current = false;
    }, 0);
  }, []);

  const update = useCallback<ConfigContextValue['update']>(
    (patch) => {
      setConfig((prev) => {
        const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const replace = useCallback(
    (next: MasjidConfig) => {
      setConfig(next);
      persist(next);
    },
    [persist],
  );

  const reset = useCallback(() => {
    const fresh = cloneConfig(DEFAULT_CONFIG);
    setConfig(fresh);
    persist(fresh);
  }, [persist]);

  // A second browser tab (say, a phone on the same screen's admin URL) editing
  // the config should update the board live.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (writingRef.current) return;
      if (event.key && !event.key.startsWith('masjid-board:')) return;
      setConfig(loadConfig());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(
    () => ({ config, update, replace, reset, saveError }),
    [config, update, replace, reset, saveError],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used inside a ConfigProvider');
  return context;
}
