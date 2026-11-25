import { describe, expect, it } from 'vitest';
import { readForm } from '../../functions/_lib/http.js';
import { LIMITS, validateAddItem, validateListSettings, validateStatus } from '../../functions/_lib/validate.js';

// Build the same form reader the handlers use, so trimming and missing fields behave as in production.
const form = (fields) => readForm(new Request('https://x.test/', { method: 'POST', body: new URLSearchParams(fields) }));
const fieldsOf = (errors) => errors.map((e) => e.field);

describe('validateListSettings', () => {
  it('accepts a name at the limit and rejects one past it', async () => {
    const ok = validateListSettings(await form({ title: 'x'.repeat(LIMITS.title), description: '', default_style: 'apa' }));
    expect(ok.errors).toEqual([]);
    const long = validateListSettings(await form({ title: 'x'.repeat(LIMITS.title + 1), description: '', default_style: 'apa' }));
    expect(long.errors).toEqual([{ field: 'title', message: 'Keep the list name to 300 characters or fewer.' }]);
  });

  it('rejects a long description and a style that is not offered', async () => {
    const { errors } = validateListSettings(await form({ title: 'T', description: 'd'.repeat(LIMITS.description + 1), default_style: 'harvard' }));
    expect(fieldsOf(errors)).toEqual(['description', 'default_style']);
  });

  it('treats missing and whitespace-only fields as empty rather than throwing', async () => {
    const { values, errors } = validateListSettings(await form({ title: '   ' }));
    expect(values).toEqual({ title: '', description: '', defaultStyle: '' });
    expect(fieldsOf(errors)).toEqual(['title', 'default_style']);
  });
});

describe('validateAddItem', () => {
  it('enforces each length limit on its own field', async () => {
    const { errors } = validateAddItem(await form({
      input: 'i'.repeat(LIMITS.input + 1), added_by: 'n'.repeat(LIMITS.addedBy + 1), note: 'o'.repeat(LIMITS.note + 1),
    }));
    expect(fieldsOf(errors)).toEqual(['input', 'added_by', 'note']);
  });

  it('accepts every field at its limit, and leaves empty input to detection', async () => {
    const atLimit = validateAddItem(await form({ input: 'i'.repeat(LIMITS.input), added_by: 'n'.repeat(LIMITS.addedBy), note: 'o'.repeat(LIMITS.note) }));
    expect(atLimit.errors).toEqual([]);
    expect(validateAddItem(await form({})).errors).toEqual([]);
  });
});

describe('validateStatus', () => {
  it('rejects a status that is not one of the three', async () => {
    const { errors } = validateStatus(await form({ status: 'archived', meeting_date: '', note: '' }));
    expect(errors).toEqual([{ field: 'status', message: 'Choose a status.' }]);
  });

  it.each([
    ['2028-02-29', true],
    ['2026-02-29', false],
    ['2026-04-31', false],
    ['2026-13-01', false],
    ['2026-1-05', false],
    ['20261020', false],
    ['2026-10-20T10:00', false],
    ['next week', false],
  ])('meeting date %s valid: %s', async (date, valid) => {
    const { errors } = validateStatus(await form({ status: 'up_next', meeting_date: date, note: '' }));
    expect(fieldsOf(errors)).toEqual(valid ? [] : ['meeting_date']);
  });

  it('allows no meeting date but limits the note', async () => {
    expect(validateStatus(await form({ status: 'suggested', meeting_date: '', note: 'o'.repeat(LIMITS.note) })).errors).toEqual([]);
    const { errors } = validateStatus(await form({ status: 'suggested', meeting_date: '', note: 'o'.repeat(LIMITS.note + 1) }));
    expect(fieldsOf(errors)).toEqual(['note']);
  });
});
