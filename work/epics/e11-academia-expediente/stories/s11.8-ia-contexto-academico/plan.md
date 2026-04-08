# S11.8 — Implementation Plan

## Tasks

### T1: Scope commit
- Commit scope and plan artifacts
- Gate: branch exists, files committed

### T2: Add contact query and prompt sections
- After lead data is available in get-samurai-context/index.ts:
  1. Query contacts table for academic_record, dieta, alergias, motivo_curso
  2. Build academicContext string from academic_record
  3. Build profileContext string from dieta/alergias/motivo_curso
  4. Insert both into systemPrompt assembly
- Gate: function builds correctly

### T3: Verify build
- Run deno check / type validation
- Gate: no errors

### T4: Review and close
- Architecture review, quality review, retrospective
- Merge to main
