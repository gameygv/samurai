import { extractTagText, parseTagsSafe } from './tag-parser';

describe('extractTagText', () => {
  it('returns empty string for null', () => {
    expect(extractTagText(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(extractTagText(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(extractTagText('')).toBe('');
  });

  it('returns string input unchanged', () => {
    expect(extractTagText('VIP')).toBe('VIP');
  });

  it('extracts .text from object', () => {
    expect(extractTagText({ text: 'Nuevo' })).toBe('Nuevo');
  });

  it('falls back to .name when .text is missing', () => {
    expect(extractTagText({ name: 'Activo' })).toBe('Activo');
  });

  it('falls back to .label when .text and .name are missing', () => {
    expect(extractTagText({ label: 'Premium' })).toBe('Premium');
  });

  it('falls back to .id when .text, .name, .label are missing', () => {
    expect(extractTagText({ id: 'tag-99' })).toBe('tag-99');
  });

  it('returns "Tag" when object has no known fields', () => {
    expect(extractTagText({ color: '#ff0000' })).toBe('Tag');
  });

  it('stringifies non-string non-object values', () => {
    expect(extractTagText(42)).toBe('42');
    expect(extractTagText(true)).toBe('true');
  });
});

describe('parseTagsSafe', () => {
  it('returns empty array for null', () => {
    expect(parseTagsSafe(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(parseTagsSafe(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseTagsSafe('')).toEqual([]);
  });

  it('parses JSON string array of strings', () => {
    const result = parseTagsSafe('["VIP","Nuevo"]');
    expect(result).toEqual([
      { id: 'VIP', text: 'VIP', color: '#475569' },
      { id: 'Nuevo', text: 'Nuevo', color: '#475569' },
    ]);
  });

  it('parses JSON string array of objects preserving id/text/color', () => {
    const input = JSON.stringify([{ id: 'a', text: 'Alpha', color: '#ff0000' }]);
    const result = parseTagsSafe(input);
    expect(result).toEqual([{ id: 'a', text: 'Alpha', color: '#ff0000' }]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseTagsSafe('{bad json')).toEqual([]);
  });

  it('returns empty array for non-array parsed result', () => {
    expect(parseTagsSafe('{"key":"value"}')).toEqual([]);
  });

  it('filters out null entries from non-string non-object items', () => {
    const result = parseTagsSafe([42, 'ok', null]);
    expect(result).toEqual([{ id: 'ok', text: 'ok', color: '#475569' }]);
  });

  it('generates fallback id as tag-{idx} when object has no id or text', () => {
    const result = parseTagsSafe([{ color: '#00ff00' }]);
    expect(result).toEqual([{ id: 'tag-0', text: 'Tag', color: '#00ff00' }]);
  });

  it('accepts pre-parsed array directly', () => {
    const result = parseTagsSafe(['Hello', 'World']);
    expect(result).toEqual([
      { id: 'Hello', text: 'Hello', color: '#475569' },
      { id: 'World', text: 'World', color: '#475569' },
    ]);
  });
});
