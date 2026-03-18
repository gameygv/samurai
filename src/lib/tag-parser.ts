export function parseTagsSafe(jsonString: string | undefined | null) {
  if (!jsonString) return [];
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) return [];
    
    return parsed.map((t: any) => {
      if (typeof t === 'string') {
        return { id: t, text: t, color: '#475569' };
      }
      if (typeof t === 'object' && t !== null && t.text) {
        return {
          id: t.id || t.text,
          text: String(t.text),
          color: t.color || '#475569'
        };
      }
      return null;
    }).filter(Boolean);
  } catch (e) {
    return [];
  }
}

// NUEVO: Asegura que si la BD devuelve un Tag corrupto (como objeto), siempre extraigamos un String para React.
export function extractTagText(tag: any): string {
  if (typeof tag === 'string') return tag;
  if (typeof tag === 'object' && tag !== null) return String(tag.text || tag.name || tag.id || 'TAG');
  return String(tag || '');
}