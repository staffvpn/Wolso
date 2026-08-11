/**
 * Feature flags for things that are built but not launched yet.
 * `payments` covers the whole money surface — worker wallet/payouts,
 * employer/admin payout runs, card linking. Off for the first real
 * release on purpose (see project history); flip it on once a payout
 * provider is actually wired up.
 */
export const FEATURES = {
  payments: false,
  /** The map view needs a real location source (Telegram's location API or
   *  geocoded addresses) to place pins honestly — not wired up yet. */
  map: false,
} as const;
