// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  console.log("[process-credit-reminders] Iniciando Motor de Cobranza A/B/C/D...");

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: installments, error: fetchErr } = await supabaseClient
      .from('credit_installments')
      .select(`
         id, amount, due_date, status, 
         sale:credit_sales(id, concept, seq_pre_days, seq_post1_days, seq_post2_days, seq_abandon_days, msg_pre, msg_post1, msg_post2, msg_abandon_agent, responsible_id, contact:contacts(id, nombre, telefono, lead_id, financial_status))
      `)
      .in('status', ['PENDING', 'LATE']);

    if (fetchErr) throw fetchErr;

    if (!installments || installments.length === 0) {
       return new Response(JSON.stringify({ message: "No hay parcialidades para auditar hoy." }), { headers: corsHeaders });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);
    let messagesSent = 0;

    for (const inst of installments) {
       const sale = inst.sale;
       if (!sale || !sale.contact) continue;

       const dueDate = new Date(inst.due_date);
       const diffTime = todayDate.getTime() - dueDate.getTime();
       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Positivo = Días pasados desde el vencimiento, Negativo = Faltan días

       const clientName = sale.contact.nombre?.split(' ')[0] || 'Cliente';
       const amountStr = `$${Number(inst.amount).toLocaleString()}`;
       const dateStr = inst.due_date;

       let msgClient = null;
       let msgAgent = null;
       let newStatus = null;
       let newFinancialStatus = null;

       // Evaluando Línea de Tiempo A/B/C/D
       if (diffDays === -(sale.seq_pre_days || 1)) {
           // FASE A: PRE-AVISO
           msgClient = sale.msg_pre;
       } 
       else if (diffDays === (sale.seq_post1_days || 1)) {
           // FASE B: 1ER ATRASO
           msgClient = sale.msg_post1;
           newStatus = 'LATE';
           newFinancialStatus = 'Atrasado';
       } 
       else if (diffDays === (sale.seq_post2_days || 8)) {
           // FASE C: 2DO ATRASO
           msgClient = sale.msg_post2;
           newStatus = 'LATE';
           newFinancialStatus = 'Muy atrasado';
       } 
       else if (diffDays === (sale.seq_abandon_days || 15)) {
           // FASE D: ABANDONADO (QUIEBRE)
           msgAgent = sale.msg_abandon_agent;
           newStatus = 'LATE';
           newFinancialStatus = 'Abandonado';
       }

       if (!msgClient && !msgAgent && !newFinancialStatus) continue;

       // 1. Reemplazo de variables
       if (msgClient) msgClient = msgClient.replace(/{nombre}/g, clientName).replace(/{monto}/g, amountStr).replace(/{fecha}/g, dateStr);
       if (msgAgent) msgAgent = msgAgent.replace(/{nombre}/g, clientName).replace(/{monto}/g, amountStr).replace(/{fecha}/g, dateStr);

       // 2. Envíos
       if (msgClient && sale.contact.telefono) {
           await supabaseClient.functions.invoke('send-message-v3', {
               body: { phone: sale.contact.telefono, message: msgClient }
           });
           messagesSent++;
       }

       if (msgAgent && sale.responsible_id) {
           const { data: agentProfile } = await supabaseClient.from('profiles').select('phone').eq('id', sale.responsible_id).single();
           if (agentProfile?.phone) {
               await supabaseClient.functions.invoke('send-message-v3', {
                   body: { phone: agentProfile.phone, message: msgAgent }
               });
               messagesSent++;
           }
       }

       // 3. Actualizaciones de BD
       if (newStatus && newStatus !== inst.status) {
           await supabaseClient.from('credit_installments').update({ status: newStatus }).eq('id', inst.id);
       }
       if (newFinancialStatus && sale.contact.financial_status !== 'Abandonado') {
           // Si ya está abandonado no lo bajamos de nivel. 
           await supabaseClient.from('contacts').update({ financial_status: newFinancialStatus }).eq('id', sale.contact.id);
       }

       await supabaseClient.from('credit_installments').update({ reminder_sent_at: new Date().toISOString() }).eq('id', inst.id);
    }

    return new Response(JSON.stringify({ success: true, messagesSent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("[Cobranza Error]:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})