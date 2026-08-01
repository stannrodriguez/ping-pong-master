import { useEffect, useRef, useState } from 'react';

/**
 * Measure an element so an SVG can be laid out in real pixels. Charts here are
 * drawn to a uniform metres-per-pixel scale, which means they need to know their
 * actual box rather than relying on `viewBox` stretching (that would rescale the
 * two axes independently and silently distort every distance on screen).
 */
export function useSize<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((previous) =>
        // Sub-pixel churn from the observer would re-render on every frame.
        Math.abs(previous.width - width) < 0.5 && Math.abs(previous.height - height) < 0.5
          ? previous
          : { width, height },
      );
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
}

/**
 * A monotonic clock that ticks each animation frame while `active`, for scrubbing
 * a trajectory in real time. Returns seconds since the run started.
 */
export function useClock(active: boolean, speed = 1) {
  const [elapsed, setElapsed] = useState(0);
  const frame = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    if (!active) return;
    last.current = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last.current) / 1000);
      last.current = now;
      setElapsed((t) => t + dt * speed);
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [active, speed]);

  return [elapsed, setElapsed] as const;
}
