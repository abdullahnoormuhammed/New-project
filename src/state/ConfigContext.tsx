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
import { loadConfig, normalizeConfig, saveConfig } from '../lib/storage';
import {
  POLL_INTERVAL_MS,
  captureEditKeyFromUrl,
  clearEditKey,
  fetchRemoteConfig,
  pushRemoteConfig,
  readEditKey,
  resolveRemoteSettings,
  storeEditKey,
  verifyEditKey,
  type RemoteSettings,
} from '../lib/remote';

/**
 * Whether this device is allowed to write to the shared settings.
 *
 * A key that came off a URL is only `checking` until the database confirms it.
 * A key already in storage was confirmed once before, so it is trusted straight
 * away — otherwise the panel would be unusable whenever the internet is down —
 * but it is re-checked in the background and dropped if it has been revoked.
 */
export type EditAccess = 'none' | 'checking' | 'granted' | 'rejected';

export type SyncStatus =
  /** No shared settings configured — this device stands alone. */
  | { kind: 'local' }
  /** Shared settings are on, and this device is only reading them. */
  | { kind: 'watching'; lastSyncedAt: Date | null }
  /** This device holds the edit key and is up to date with the screens. */
  | { kind: 'synced'; lastSyncedAt: Date }
  | { kind: 'saving' }
  /** The network is unreachable; the cached settings are still in use. */
  | { kind: 'offline'; message: string }
  | { kind: 'error'; message: string };

interface ConfigContextValue {
  config: MasjidConfig;
  update: (patch: Partial<MasjidConfig> | ((prev: MasjidConfig) => MasjidConfig)) => void;
  replace: (next: MasjidConfig) => void;
  reset: () => void;
  saveError: string | null;

  /** Whether this deployment has shared settings at all. */
  remote: RemoteSettings | null;
  /** True when this device can write to the shared settings. */
  canEdit: boolean;
  editAccess: EditAccess;
  editKey: string | null;
  connectEditKey: (key: string) => void;
  disconnectEditKey: () => void;
  syncStatus: SyncStatus;
  /** Ask for the latest shared settings now, rather than waiting for the poll. */
  refreshNow: () => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

/** How long to wait after the last keystroke before pushing to the screens. */
const PUSH_DEBOUNCE_MS = 900;

export function ConfigProvider({ children }: { children: ReactNode }) {
  const remote = useMemo(() => resolveRemoteSettings(), []);

  // The cached settings render immediately, so the board is never blank and
  // never waits on the network.
  const [config, setConfig] = useState<MasjidConfig>(() => loadConfig());
  const [saveError, setSaveError] = useState<string | null>(null);

  // A key straight off the link has to be checked; one already in storage was
  // checked when it was first connected.
  const initialKey = useMemo(() => {
    if (!remote) return { key: null as string | null, fromUrl: false };
    const fromUrl = captureEditKeyFromUrl();
    if (fromUrl) return { key: fromUrl, fromUrl: true };
    return { key: readEditKey(), fromUrl: false };
  }, [remote]);

  const [editKey, setEditKey] = useState<string | null>(initialKey.key);
  const [editAccess, setEditAccess] = useState<EditAccess>(() => {
    if (!remote) return 'granted';
    if (!initialKey.key) return 'none';
    return initialKey.fromUrl ? 'checking' : 'granted';
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    remote ? { kind: 'watching', lastSyncedAt: null } : { kind: 'local' },
  );

  const canEdit = !remote || editAccess === 'granted';

  // Refs, because the poll and the debounced push both run outside React's
  // render flow and must see current values.
  const configRef = useRef(config);
  configRef.current = config;
  const editKeyRef = useRef(editKey);
  editKeyRef.current = editKey;
  /** Set while local edits are waiting to go up; the poll must not clobber them. */
  const pendingPushRef = useRef(false);
  const pushTimerRef = useRef<number | null>(null);
  const writingLocallyRef = useRef(false);

  const persistLocal = useCallback((next: MasjidConfig) => {
    writingLocallyRef.current = true;
    const ok = saveConfig(next);
    setSaveError(ok ? null : 'Changes could not be saved to this device’s storage.');
    setTimeout(() => {
      writingLocallyRef.current = false;
    }, 0);
  }, []);

  // --- pushing to the screens -------------------------------------------------

  const pushNow = useCallback(async () => {
    const settings = remote;
    const key = editKeyRef.current;
    if (!settings || !key) return;

    setSyncStatus({ kind: 'saving' });
    try {
      await pushRemoteConfig(settings, key, configRef.current);
      pendingPushRef.current = false;
      setSyncStatus({ kind: 'synced', lastSyncedAt: new Date() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reach the screens.';
      // The edits are safe in local storage; they go up on the next attempt.
      setSyncStatus(
        /edit key/i.test(message)
          ? { kind: 'error', message }
          : { kind: 'offline', message: `${message} Your changes are saved on this device and will be sent when the connection returns.` },
      );
    }
  }, [remote]);

  const schedulePush = useCallback(() => {
    if (!remote || !editKeyRef.current) return;
    pendingPushRef.current = true;
    if (pushTimerRef.current !== null) window.clearTimeout(pushTimerRef.current);
    pushTimerRef.current = window.setTimeout(() => {
      pushTimerRef.current = null;
      void pushNow();
    }, PUSH_DEBOUNCE_MS);
  }, [remote, pushNow]);

  // --- reading from the screens ------------------------------------------------

  const pull = useCallback(
    async (signal?: AbortSignal) => {
      if (!remote) return;
      // Never overwrite edits that have not gone up yet.
      if (pendingPushRef.current) return;

      try {
        const record = await fetchRemoteConfig(remote, signal);
        if (!record) {
          // The board row does not exist yet. Nothing to adopt; an editor's
          // first save will create its contents.
          setSyncStatus((prev) =>
            prev.kind === 'saving' ? prev : { kind: 'watching', lastSyncedAt: new Date() },
          );
          return;
        }

        if (pendingPushRef.current) return;

        const next = normalizeConfig(record.config);
        setConfig(next);
        persistLocal(next);
        setSyncStatus(
          editKeyRef.current
            ? { kind: 'synced', lastSyncedAt: new Date() }
            : { kind: 'watching', lastSyncedAt: new Date() },
        );
      } catch (error) {
        if (signal?.aborted) return;
        const message = error instanceof Error ? error.message : 'Could not reach the screens.';
        setSyncStatus({
          kind: 'offline',
          message: `${message} The board is using the settings saved on this device.`,
        });
      }
    },
    [remote, persistLocal],
  );

  const refreshNow = useCallback(() => {
    void pull();
  }, [pull]);

  // Poll, and also refresh the moment the tab becomes visible or the network
  // comes back — a TV that has been asleep should not wait out the interval.
  useEffect(() => {
    if (!remote) return;

    const controller = new AbortController();
    void pull(controller.signal);

    const timer = window.setInterval(() => void pull(), POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull();
    };
    const onOnline = () => {
      void pull();
      // Any edits that failed to go up get another attempt now.
      if (pendingPushRef.current) void pushNow();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [remote, pull, pushNow]);

  // --- editing -----------------------------------------------------------------

  const applyLocal = useCallback(
    (next: MasjidConfig) => {
      setConfig(next);
      persistLocal(next);
      schedulePush();
    },
    [persistLocal, schedulePush],
  );

  const update = useCallback<ConfigContextValue['update']>(
    (patch) => {
      setConfig((prev) => {
        const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
        persistLocal(next);
        schedulePush();
        return next;
      });
    },
    [persistLocal, schedulePush],
  );

  const replace = useCallback((next: MasjidConfig) => applyLocal(next), [applyLocal]);

  const reset = useCallback(() => applyLocal(cloneConfig(DEFAULT_CONFIG)), [applyLocal]);

  const connectEditKey = useCallback((key: string) => {
    // Only reached from the connect screen, which has already checked the key.
    storeEditKey(key);
    setEditKey(key.trim());
    setEditAccess('granted');
  }, []);

  const disconnectEditKey = useCallback(() => {
    clearEditKey();
    setEditKey(null);
    setEditAccess('none');
    setSyncStatus({ kind: 'watching', lastSyncedAt: null });
  }, []);

  /**
   * Confirm the key we started with. A key off a URL is gated on this; a stored
   * key is already trusted, and this only takes it away if the server says it
   * has been revoked. A network failure changes nothing either way.
   */
  useEffect(() => {
    if (!remote) return;
    const key = initialKey.key;
    if (!key) return;

    let cancelled = false;
    void (async () => {
      try {
        const ok = await verifyEditKey(remote, key);
        if (cancelled) return;
        if (ok) {
          storeEditKey(key);
          setEditAccess('granted');
        } else {
          clearEditKey();
          setEditKey(null);
          setEditAccess('rejected');
        }
      } catch {
        if (cancelled) return;
        // Could not ask. A previously stored key keeps working offline; a key
        // off a link stays unconfirmed rather than being wrongly trusted.
        setEditAccess(initialKey.fromUrl ? 'rejected' : 'granted');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [remote, initialKey]);

  // A second tab on the same device — a phone with the panel open twice, say —
  // should not drift out of step.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (writingLocallyRef.current) return;
      if (event.key && !event.key.startsWith('masjid-board:')) return;
      setConfig(loadConfig());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Send anything still pending before the page goes away.
  useEffect(() => {
    const onHide = () => {
      if (pendingPushRef.current && pushTimerRef.current !== null) {
        window.clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
        void pushNow();
      }
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [pushNow]);

  const value = useMemo(
    () => ({
      config,
      update,
      replace,
      reset,
      saveError,
      remote,
      canEdit,
      editAccess,
      editKey,
      connectEditKey,
      disconnectEditKey,
      syncStatus,
      refreshNow,
    }),
    [
      config,
      update,
      replace,
      reset,
      saveError,
      remote,
      canEdit,
      editAccess,
      editKey,
      connectEditKey,
      disconnectEditKey,
      syncStatus,
      refreshNow,
    ],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used inside a ConfigProvider');
  return context;
}
