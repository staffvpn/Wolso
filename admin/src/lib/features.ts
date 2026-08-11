/**
 * Feature flags for things that are built but not launched yet.
 * `payments` covers the whole money surface — the Финансы section,
 * running payouts, commission/payout-schedule settings. Off for the
 * first real release on purpose; flip it on once a payout provider is
 * actually wired up. RBAC (roles, the "Финансы и выплаты" access
 * toggle, audit log) stays fully functional regardless — that's
 * internal team tooling, not money moving in front of real users.
 */
export const FEATURES = {
  payments: false,
} as const;
