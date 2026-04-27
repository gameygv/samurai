import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FilterRule {
  type: 'leaf' | 'group' | 'not_exists';
  field?: string;
  op?: string;
  value?: unknown;
  logic?: 'AND' | 'OR';
  rules?: FilterRule[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { filter_json, mode = 'count' } = await req.json();

    if (!filter_json?.root) {
      return new Response(JSON.stringify({ error: 'filter_json.root requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build query from filter tree
    let query = supabase.from('leads').select(
      mode === 'count' ? 'id' : 'id, nombre, telefono, ciudad, buying_intent',
      mode === 'count' ? { count: 'exact', head: true } : {}
    );

    // Apply filters recursively (simplified — handles common cases)
    query = applyFilters(query, filter_json.root);

    const result = await query;

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      count: result.count ?? result.data?.length ?? 0,
      lead_ids: mode === 'ids' ? (result.data || []).map((r: { id: string }) => r.id) : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[evaluate-segment] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// deno-lint-ignore no-explicit-any
function applyFilters(query: any, rule: FilterRule): any {
  if (rule.type === 'leaf' && rule.field && rule.op) {
    return applyLeafFilter(query, rule.field, rule.op, rule.value);
  }

  if (rule.type === 'group' && rule.rules && rule.rules.length > 0) {
    // For AND groups, apply each filter sequentially
    if (rule.logic === 'AND') {
      let q = query;
      for (const sub of rule.rules) {
        q = applyFilters(q, sub);
      }
      return q;
    }
    // OR is more complex with supabase-js — use .or() string
    if (rule.logic === 'OR') {
      const orParts = rule.rules
        .filter(r => r.type === 'leaf' && r.field && r.op)
        .map(r => buildOrCondition(r.field!, r.op!, r.value));
      if (orParts.length > 0) {
        return query.or(orParts.join(','));
      }
    }
  }

  // not_exists handled at query level — simplified
  if (rule.type === 'not_exists' && rule.field && rule.value) {
    // For academic_record not_exists, we can't do subquery in supabase-js
    // Log warning and skip — this requires RPC or raw SQL
    console.warn('[evaluate-segment] not_exists filter not fully supported in client mode');
  }

  return query;
}

// deno-lint-ignore no-explicit-any
function applyLeafFilter(query: any, field: string, op: string, value: unknown): any {
  switch (op) {
    case 'eq': return query.eq(field, value);
    case 'neq': return query.neq(field, value);
    case 'gt': return query.gt(field, value);
    case 'gte': return query.gte(field, value);
    case 'lt': return query.lt(field, value);
    case 'lte': return query.lte(field, value);
    case 'like': return query.ilike(field, `%${value}%`);
    case 'contains': return query.ilike(field, `%${value}%`);
    case 'in': return query.in(field, Array.isArray(value) ? value : [value]);
    case 'is_null': return query.is(field, null);
    case 'not_null': return query.not(field, 'is', null);
    default: return query;
  }
}

function buildOrCondition(field: string, op: string, value: unknown): string {
  switch (op) {
    case 'eq': return `${field}.eq.${value}`;
    case 'neq': return `${field}.neq.${value}`;
    case 'like':
    case 'contains': return `${field}.ilike.%${value}%`;
    case 'in': return `${field}.in.(${Array.isArray(value) ? value.join(',') : value})`;
    case 'is_null': return `${field}.is.null`;
    case 'not_null': return `${field}.not.is.null`;
    case 'gt': return `${field}.gt.${value}`;
    case 'lt': return `${field}.lt.${value}`;
    default: return `${field}.eq.${value}`;
  }
}
