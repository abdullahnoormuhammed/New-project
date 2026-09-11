import { useEffect, useState, type RefObject } from 'react';

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

/**
 * Scales a fixed 1920x1080 canvas to fill whatever screen the board is plugged
 * into. Designing against one fixed canvas means a layout that is checked on a
 * laptop looks identical on a 55" TV — no reflow surprises, no clipped rows.
 */
export function useStageScale(containerRef: RefObject<HTMLElement>): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = () => {
      const { clientWidth, clientHeight } = element;
      if (!clientWidth || !clientHeight) return;
      setScale(Math.min(clientWidth / STAGE_WIDTH, clientHeight / STAGE_HEIGHT));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('orientationchange', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', measure);
    };
  }, [containerRef]);

  return scale;
}

/**
 * Keeps the display awake. Browsers drop the lock when the tab is hidden or the
 * device sleeps, so it is re-acquired on every visibility change.
 */
export function useWakeLock(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    if (!nav.wakeLock) return;

    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const lock = await nav.wakeLock!.request('screen');
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
      } catch {
        // Denied (no user gesture yet, unsupported, battery saver) — harmless.
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release().catch(() => undefined);
    };
  }, [enabled]);
}

/**
 * Reloads the page shortly after midnight. A board left running for months
 * accumulates memory and, more importantly, needs its date to roll over
 * cleanly — a fresh load is the simplest guarantee of that.
 */
export function useNightlyReload(enabled = true, atHour = 3): void {
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      const now = new Date();
      if (now.getHours() === atHour && now.getMinutes() === 0) {
        window.location.reload();
      }
    }, 60000);
    return () => window.clearInterval(timer);
  }, [enabled, atHour]);
}
