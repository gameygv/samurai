/**
 * Extrae texto de una etiqueta sin importar si la base de datos devolvió un string o un objeto.
 * Evita el error 'Objects are not valid as a React child'.
 */
export function extractTagText(tag: any): string {
  if (!tag) return '';
  if (typeof tag === 'string') return tag;
  if (typeof tag === 'object') {
    return String(tag.text || tag.name || tag.label || tag.id || 'Tag');
  }
  return String(tag);
}

/**
 * Parsea un JSON de configuración de etiquetas de forma segura.
 */
export function parseTagsSafe(jsonString: any) {
  if (!jsonString) return [];
  let parsed = [];
  try {
    parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
  } catch (e) {
    return [];
  }
  
  if (!Array.isArray(parsed)) return [];
  
  return parsed.map((t: any) => {
    if (typeof t === 'string') return { id: t, text: t, color: '#475569' };
    if (typeof t === 'object' && t !== null) {
      return {
        id: String(t.id || t.text || Math.random()),
        text: extractTagText(t),
        color: String(t.color || '#475569')
      };
    }
    return null;
  }).filter(Boolean);
}