/**
 * Helper para agregar entrada en contacts.academic_record (jsonb array).
 * Idempotente: no duplica si ya existe entrada con ese course_id.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

interface AcademicEntry {
  course_id: string;
  course_name: string;
  professor_name: string | null;
  sede: string | null;
  fecha_curso: string | null;
  source: string;
  added_at: string;
}

export async function appendAcademicRecord(
  supabase: SupabaseClient,
  contactId: string,
  courseId: string
): Promise<{ added: boolean; reason?: string }> {
  // 1. Leer academic_record actual (SELECT explícito)
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, academic_record')
    .eq('id', contactId)
    .single();

  if (!contact) return { added: false, reason: 'contact_not_found' };

  const existingRecords: AcademicEntry[] = Array.isArray(contact.academic_record)
    ? contact.academic_record
    : [];

  // 2. Verificar si ya existe
  if (existingRecords.some(r => r.course_id === courseId)) {
    return { added: false, reason: 'already_exists' };
  }

  // 3. Obtener datos del curso (SELECT explícito)
  const { data: course } = await supabase
    .from('courses')
    .select('id, title, profesor, sede, fecha_inicio')
    .eq('id', courseId)
    .single();

  if (!course) return { added: false, reason: 'course_not_found' };

  // 4. Agregar entrada
  const newEntry: AcademicEntry = {
    course_id: courseId,
    course_name: course.title || '',
    professor_name: course.profesor || null,
    sede: course.sede || null,
    fecha_curso: course.fecha_inicio || null,
    source: 'auto-from-group',
    added_at: new Date().toISOString(),
  };

  const updatedRecords = [...existingRecords, newEntry];

  const { error } = await supabase
    .from('contacts')
    .update({ academic_record: updatedRecords })
    .eq('id', contactId);

  if (error) return { added: false, reason: error.message };

  return { added: true };
}
