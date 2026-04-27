# Sprint 2026-04-27 — Informe Final

## Resumen

**16 commits | 5 épicas (E13-E17) | 15 stories | 56 tests verdes**
**Duración:** ~3 horas (2 sesiones)
**Estado:** Todo desplegado en producción

---

## Bugs encontrados en revisión final

### MEDIO — Corregir en próxima sesión

| # | Archivo | Bug | Impacto |
|---|---|---|---|
| 1 | `evaluate-segment/index.ts:85` | `buildOrCondition` recibe `value` undefined para ops `is_null`/`not_null` en modo OR | Filtros OR con "está vacío" generan clausula malformada |
| 2 | `FilterBuilder.tsx:95` | `Number(r.value)` puede retornar NaN para campos numéricos con texto | Query silenciosamente no filtra |
| 3 | `FilterBuilder.tsx:95` | `catch (_) { /* ignore */ }` suprime todos los errores incluyendo network | Sin feedback al usuario si evaluate-segment falla |

### BAJO — No afectan funcionalidad principal

| # | Archivo | Bug | Impacto |
|---|---|---|---|
| 4 | `ChannelsCatalog.tsx:104` | Cast `as CachedGroup[]` sin validación runtime | Riesgo bajo — Supabase siempre retorna el shape correcto |
| 5 | `VariantTabs.tsx:165` | Sin handling si usuario cancela file picker | No crash, solo no pasa nada |
| 6 | `ThemeToggle.tsx:6` | `useTheme()` asume ThemeProvider presente | Está en main.tsx, siempre presente |

### NO SON BUGS (falsos positivos del scanner)

- `sync-channel-groups:109` — `if (!upsertErr) groupsUpserted++` es correcto (incrementa cuando NO hay error)
- `academic-record.ts:29` — `.single()` retorna `{ data, error }`, no lanza excepción

---

## Cabos sueltos

### 1. Cambios uncommitted de sesiones anteriores (IMPORTANTE)

11 archivos modificados en el working tree que NO son de este sprint:
- `evolution-webhook/index.ts` — migración a invokeFunction
- `analyze-leads/index.ts` — migración a invokeFunction  
- `process-samurai-response/index.ts` — migración a invokeFunction
- `send-message-v3/index.ts` — migración a invokeFunction
- Y 7 más

**Estos son de la migración del 23 de abril** (memoria `project_invoke_migration_0423`). Fueron editados pero NUNCA commiteados ni desplegados. 

**Riesgo:** Si alguien hace `git add .` y commitea, incluiría estos cambios no testeados. Si se despliegan las funciones core con `deploy.sh`, usarían la versión **commitada** (sin invokeFunction), que es la que está en producción y funciona.

**Acción recomendada:** En próxima sesión, decidir si commitear estos cambios (después de verificar que funcionan) o descartarlos con `git checkout -- <file>`.

### 2. Cron S15.2 deshabilitado

El cron `sync-group-members-30min` está registrado pero `active=false`. Para activarlo:
```sql
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'sync-group-members-30min'),
  active := true
);
```
**Prerequisito:** Probar manualmente `sync-group-members` con canal Edith primero. Verificar que los leads auto-creados tengan `ai_paused=TRUE` y que las columnas `pos_*` estén en default.

### 3. Solo 1 curso vinculado a grupo

Para que Josué pueda usar la sección de campañas a grupos de curso, se necesitan vincular más cursos desde `/academic` → editar curso → "Vincular Grupo WhatsApp".

### 4. Regla temporal "no precios"

Activa desde 2026-04-18 en `get-samurai-context`. Gamey decide cuándo revertirla.

### 5. Instrucciones POS pendientes

Generar `D:/github/pos/INSTRUCCIONES_SESION.md` con:
- Plan POS ajustado (correcciones: endpoint Gowa, cron pattern, logo configurable)
- Instrucciones para ejecutar en sesión POS separada

---

## Verificaciones de integridad

| Check | Estado |
|---|---|
| TypeScript `tsc --noEmit` | 0 errores |
| Vitest | 56/56 verdes |
| Fix weekend (mensajes grupo @g.us) | NO TOCADO — intacto |
| evolution-webhook | NO TOCADO — intacto |
| analyze-leads | NO TOCADO — intacto |
| meta-capi-sender | NO TOCADO — intacto |
| get-samurai-context (no precios) | NO TOCADO — intacto |
| Tabla contacts (POS compartida) | Solo lectura en S15.1 (INSERT nuevos, no UPDATE pos_*) |
| deploy.sh | Actualizado con sync-channel-groups + evaluate-segment |

---

## Commits del sprint (cronológico)

```
735e9fd fix: bugfixes en campañas a grupos — SSRF, memory leak, error handling
d31f741 docs: plan de sprint 2026-04-27
d50f975 feat(E13.S1): add whatsapp_groups_cache table with course sync
d774a69 feat(E13.S2): add sync-channel-groups edge function
fb5b0a8 feat(E13.S3): schedule sync-channel-groups every 30 minutes
fae2cb3 feat(E13.S4): add /channels page
78284f3 feat(E14.S2): extend MassMessageDialog to support video and audio
548f0ae feat(E17.S1): add light/dark theme toggle and font size control
7711807 docs: sprint progress
bb61992 feat(E14.S3): add campaign variants with round-robin distribution
5595434 feat(E15.S3): protect auto-from-group leads from PERDIDO
eafe402 feat(E15.S1): sync-group-members auto-creates contacts and leads
e1fc20d feat(E15.S2): schedule sync-group-members cron (disabled)
d30b6b3 feat(E15.S4): autofill academic_record from course-linked groups
87a5072 feat(E16): add segment filters
87c137f feat(E17.S2): WCAG AA focus visible + contrast improvements
```
