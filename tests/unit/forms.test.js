import { describe, expect, it } from 'vitest';
import { errorSummary, styleRadios, textField } from '../../functions/_lib/views/forms.js';

describe('form views', () => {
  it('links the error summary to each field', () => {
    const out = String(errorSummary([{ field: 'title', message: 'Enter a name.' }], 'list-'));
    expect(out).toContain('role="alert"');
    expect(out).toContain('<a href="#list-title">Enter a name.</a>');
  });

  it('renders nothing without errors', () => {
    expect(String(errorSummary([]))).toBe('');
  });

  it('ties hints and errors to the input', () => {
    const out = String(textField({ id: 'title', label: 'List name', value: '<x>', hint: 'Short', error: 'Too long', required: true }));
    expect(out).toContain('<label for="title">List name</label>');
    expect(out).toContain('aria-describedby="title-hint title-error"');
    expect(out).toContain('aria-invalid="true"');
    expect(out).toContain(' required');
    expect(out).toContain('value="&lt;x&gt;"');
  });

  it('always emits an explicit input type, after the value', () => {
    const out = String(textField({ id: 'title', label: 'List name', value: 'A Book' }));
    expect(out).toContain('id="title" name="title" value="A Book" type="text"');
  });

  it('gives the first style radio the bare id so error links land on it', () => {
    const out = String(styleRadios({ prefix: 'list-', selected: 'mla' }));
    expect(out).toContain('id="list-default_style" name="default_style" value="apa"');
    expect(out).toMatch(/value="mla" checked/);
  });
});
