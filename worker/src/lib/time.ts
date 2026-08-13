/** Cloudflare Workers run on UTC, but every date this app deals in (a shift
 *  date the employer picked, "has this shift already happened") is
 *  implicitly Moscow time — this app's only market, and Russia hasn't
 *  observed DST since 2014, so a fixed +3h offset is safe year-round.
 *  Comparing a shift's date against a UTC "today" made shifts that had
 *  already ended hours ago (by the employer's own clock) still look like
 *  they hadn't happened yet for a few hours around local midnight. */
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

export function mskTodayStr(): string {
  return new Date(Date.now() + MSK_OFFSET_MS).toISOString().slice(0, 10);
}
