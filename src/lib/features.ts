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
  /** Anything that claims to know where a shift is relative to the person:
   *  the "радиус" filter and the distance chip on a card. The API accepts
   *  radiusKm and then ignores it (see routes/feed.ts) because no latitude
   *  or longitude is captured anywhere, so the filter looked like it worked
   *  and silently did nothing — worse than not offering it. Turn on once
   *  coordinates exist. */
  geo: false,
  /** Paid extras — boost, undo, unlimited swipes, top vacancy, priority
   *  support. All five open a "скоро" sheet and there is no purchase flow
   *  behind any of them, so every entry point is a promise the app can't
   *  keep. Turn on together with a real payment provider. */
  premium: false,
  /** ИНН entry (CompleteEmployerProfile) and the admin-approval gate
   *  (AuthGate's EmployerVerificationGate) — paused temporarily. Off means
   *  a complete profile is enough to use the app; nothing about the
   *  verification_status column or the admin queue changes underneath, so
   *  turning this back on picks up right where it left off. Mirror of
   *  COMPANY_VERIFICATION_ENABLED on the worker (routes/employer.ts) — flip
   *  both together. */
  companyVerification: false,
} as const;
