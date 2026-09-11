import { useCallback, useEffect, useRef, useState } from 'react';

export interface SlideshowControls {
  index: number;
  next: () => void;
  previous: () => void;
  goTo: (index: number) => void;
  /** Increments on every change, so views can key their enter animation. */
  tick: number;
}

interface Options {
  /** Seconds each slide holds, in slide order. */
  durations: number[];
  /** Freeze rotation — used while a salaah takeover owns the screen. */
  paused?: boolean;
}

/**
 * Advances through the slide deck. The timer restarts whenever the deck or the
 * current index changes, so a slide always gets its full time on screen even if
 * an admin edit reshuffles the deck mid-rotation.
 */
export function useSlideshow({ durations, paused = false }: Options): SlideshowControls {
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const count = durations.length;

  // Keep the index in range when slides are added or removed.
  useEffect(() => {
    setIndex((prev) => (count === 0 ? 0 : prev % count));
  }, [count]);

  const goTo = useCallback((next: number) => {
    setIndex(next);
    setTick((t) => t + 1);
  }, []);

  const next = useCallback(() => {
    setIndex((prev) => (count === 0 ? 0 : (prev + 1) % count));
    setTick((t) => t + 1);
  }, [count]);

  const previous = useCallback(() => {
    setIndex((prev) => (count === 0 ? 0 : (prev - 1 + count) % count));
    setTick((t) => t + 1);
  }, [count]);

  const nextRef = useRef(next);
  nextRef.current = next;

  const duration = durations[Math.min(index, Math.max(0, count - 1))] ?? 20;

  useEffect(() => {
    if (paused || count <= 1) return;
    const seconds = Math.max(3, duration);
    const timer = window.setTimeout(() => nextRef.current(), seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [index, duration, paused, count, tick]);

  return { index: count === 0 ? 0 : Math.min(index, count - 1), next, previous, goTo, tick };
}

/** Arrow keys / space for walking the deck while setting a board up. */
export function useSlideshowKeys(controls: SlideshowControls, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        controls.next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        controls.previous();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controls, enabled]);
}
