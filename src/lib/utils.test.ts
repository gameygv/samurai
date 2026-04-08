import { cn } from './utils';

describe('cn', () => {
  it('merges multiple class strings', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('deduplicates conflicting Tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles conditional classes via clsx syntax', () => {
    expect(cn('base', false && 'hidden', 'extra')).toBe('base extra');
    expect(cn('base', true && 'visible')).toBe('base visible');
  });

  it('returns empty string for no args', () => {
    expect(cn()).toBe('');
  });
});
