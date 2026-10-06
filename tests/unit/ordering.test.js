import { describe, expect, it } from 'vitest';
import { flattenOrdered, orderItems } from '../../functions/_lib/ordering.js';

const item = (id, status, { votes = 0, date = null, created = '2026-01-01', updated = created } = {}) =>
  ({ id, status, votes, meeting_date: date, created_at: created, updated_at: updated });

describe('orderItems', () => {
  it('orders up next by meeting date then votes, undated last', () => {
    const { upNext } = orderItems([
      item('late', 'up_next', { date: '2026-11-01' }),
      item('none', 'up_next', { votes: 9 }),
      item('soon-1', 'up_next', { date: '2026-10-20', votes: 1 }),
      item('soon-3', 'up_next', { date: '2026-10-20', votes: 3 }),
    ]);
    expect(upNext.map((i) => i.id)).toEqual(['soon-3', 'soon-1', 'late', 'none']);
  });

  it('orders suggestions by votes then newest', () => {
    const { suggested } = orderItems([
      item('old', 'suggested', { created: '2026-01-01' }),
      item('new', 'suggested', { created: '2026-02-01' }),
      item('popular', 'suggested', { votes: 2 }),
    ]);
    expect(suggested.map((i) => i.id)).toEqual(['popular', 'new', 'old']);
  });

  it('orders discussed by most recent meeting, undated last', () => {
    const { discussed } = orderItems([
      item('march', 'discussed', { date: '2026-03-01' }),
      item('undated', 'discussed'),
      item('may', 'discussed', { date: '2026-05-01' }),
    ]);
    expect(discussed.map((i) => i.id)).toEqual(['may', 'march', 'undated']);
  });

  it('flattens in page order', () => {
    const groups = orderItems([item('d', 'discussed'), item('s', 'suggested'), item('u', 'up_next')]);
    expect(flattenOrdered(groups).map((i) => i.id)).toEqual(['u', 's', 'd']);
  });
});
