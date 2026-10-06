// At most 30 new items per list per hour, counted from items.created_at (spec §5).
import { countItemsSince } from './db/items.js';

export const RATE_LIMIT = 30;
export const RATE_LIMIT_MESSAGE =
  'This list has had 30 items added in the last hour, which is the most allowed. Please try again later.';

export async function isRateLimited(db, listId, now = new Date()) {
  const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  return (await countItemsSince(db, listId, since)) >= RATE_LIMIT;
}
