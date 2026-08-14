/** Interval runner that never throws into the event loop. */
export function startInterval(
  name: string,
  ms: number,
  fn: () => Promise<void>,
): NodeJS.Timeout {
  const run = async () => {
    try {
      await fn();
    } catch (err: any) {
      console.error(`[scheduler:${name}]`, err?.message ?? err);
    }
  };
  const timer = setInterval(() => {
    void run();
  }, ms);
  timer.unref?.();
  return timer;
}
