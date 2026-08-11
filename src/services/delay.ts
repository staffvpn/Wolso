/**
 * Every service function awaits this before resolving — it stands in for
 * network latency today, so swapping the body for a real `fetch` later
 * doesn't change how any store or screen calls it.
 */
export function delay(ms = 260) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
