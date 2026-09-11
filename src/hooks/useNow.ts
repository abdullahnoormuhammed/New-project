import { useEffect, useState } from 'react';

/**
 * A ticking clock.
 *
 * Rather than a plain `setInterval`, each tick schedules the next one aligned to
 * the wall clock. Over the weeks a wall board stays powered on, drift would
 * otherwise show up as a seconds display that visibly stutters.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: number;

    const tick = () => {
      const current = new Date();
      setNow(current);
      const delay = intervalMs - (current.getTime() % intervalMs);
      timer = window.setTimeout(tick, delay);
    };

    const initial = new Date();
    timer = window.setTimeout(tick, intervalMs - (initial.getTime() % intervalMs));
    return () => window.clearTimeout(timer);
  }, [intervalMs]);

  return now;
}

/** Re-renders once per minute; cheaper for anything that does not show seconds. */
export function useMinute(): Date {
  return useNow(60000);
}
