# S11.8 — get-samurai-context includes academic_record del contacto

## Goal
Enrich the AI system prompt with the contact's academic history so the AI does not re-offer courses already taken and suggests next-level or complementary courses instead.

## Scope
- Query `contacts` table by `lead_id` to get `academic_record`, `dieta`, `alergias`, `motivo_curso`
- Parse `academic_record` JSONB into a prompt section listing completed courses
- Add student profile section (diet, allergies, motivation) when available
- Insert both sections into the system prompt in `get-samurai-context/index.ts`

## Out of Scope
- Modifying academic_record structure
- Changes to process-samurai-response
- UI changes

## Acceptance Criteria
1. When a contact has academic_record, the system prompt includes the academic history section
2. The prompt instructs the AI not to re-offer completed courses
3. Student profile info (dieta, alergias, motivo_curso) is included when present
4. When no contact exists for a lead, behavior is unchanged
