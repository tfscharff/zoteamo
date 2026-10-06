// Page order (spec §4): up next by meeting date then votes; suggested by votes then newest; discussed by latest meeting.
const ascNullsLast = (a, b) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a.localeCompare(b));
const descNullsLast = (a, b) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : b.localeCompare(a));

export function orderItems(items) {
  const groups = { up_next: [], suggested: [], discussed: [] };
  for (const item of items) (groups[item.status] ?? groups.suggested).push(item);
  groups.up_next.sort((a, b) =>
    ascNullsLast(a.meeting_date ?? null, b.meeting_date ?? null) || b.votes - a.votes || a.created_at.localeCompare(b.created_at));
  groups.suggested.sort((a, b) => b.votes - a.votes || b.created_at.localeCompare(a.created_at));
  groups.discussed.sort((a, b) =>
    descNullsLast(a.meeting_date ?? null, b.meeting_date ?? null) || b.updated_at.localeCompare(a.updated_at));
  return { upNext: groups.up_next, suggested: groups.suggested, discussed: groups.discussed };
}

export const flattenOrdered = ({ upNext, suggested, discussed }) => [...upNext, ...suggested, ...discussed];
