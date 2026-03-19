// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  console.log("[process-campaign-queue] Revisando campañas programadas...");

  try {
      const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      
      const { data: config } = await supabaseClient.from('app_config').select('*').eq('key', 'scheduled_campaigns').maybeSingle();
      if (!config || !config.value) return new Response(JSON.stringify({ message: "No queue" }), { headers: corsHeaders });
      
      let campaigns = [];
      try { campaigns = JSON.parse(config.value); } catch(e) { return new Response(JSON.stringify({ message: "Invalid JSON" }), { headers: corsHeaders }); }
      
      const now = new Date();
      let updated = false;
      let messagesSentCount = 0;

      for (let i = 0; i < campaigns.length; i++) {
          const camp = campaigns[i];
          if (camp.status === 'completed') continue;
          
          const scheduledTime = new Date(camp.scheduledAt);
          if (scheduledTime > now) continue;

          camp.status = 'processing';
          const pendingContacts = camp.contacts.filter(c => c.status === 'pending');
          
          if (pendingContacts.length === 0) {
              camp.status = 'completed';
              updated = true;
              continue;
          }

          // Lote pequeño para no saturar WhatsApp y mantenernos seguros
          const batchSize = 4; 
          const batch = pendingContacts.slice(0, batchSize);
          
          for (const contact of batch) {
              try {
                  const clientName = contact.nombre?.split(' ')[0] || 'amigo';
                  const personalizedMsg = camp.message
                      .replace(/{nombre}/g, clientName)
                      .replace(/{ciudad}/g, contact.ciudad || '');
                  
                  await supabaseClient.functions.invoke('send-message-v3', {
                      body: { phone: contact.telefono, message: personalizedMsg, mediaData: camp.mediaData }
                  });
                  
                  if (contact.lead_id) {
                       await supabaseClient.from('conversaciones').insert({ 
                          lead_id: contact.lead_id, 
                          mensaje: personalizedMsg || (camp.mediaData ? `[ARCHIVO ENVIADO]` : ''), 
                          emisor: 'SISTEMA', 
                          platform: 'CAMPAÑA_AUTO',
                          metadata: { campaign: camp.name }
                      });
                  }

                  contact.status = 'sent';
              } catch(e) {
                  console.error(`Error sending to ${contact.telefono}:`, e.message);
                  contact.status = 'error';
              }
              messagesSentCount++;
              updated = true;
          }
          
          // Solo procesamos 1 campaña por ejecución (hasta 4 mensajes x min)
          if (messagesSentCount >= batchSize) break; 
      }

      if (updated) {
          await supabaseClient.from('app_config').update({ value: JSON.stringify(campaigns) }).eq('key', 'scheduled_campaigns');
      }

      return new Response(JSON.stringify({ success: true, processed: messagesSentCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
      console.error("[process-campaign-queue] Error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})