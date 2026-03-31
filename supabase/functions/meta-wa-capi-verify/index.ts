// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { waba_id, access_token, wa_channel_token, test_event_code } = await req.json();

    if (!waba_id || (!access_token && !wa_channel_token)) {
      throw new Error('WABA_ID y al menos un Access Token son requeridos.');
    }

    // Intentar primero con el token del canal WA (tiene whatsapp_business_management),
    // fallback al token CAPI
    const tokenForWaba = wa_channel_token || access_token;

    const results: any = { steps: [] };

    // STEP 1: Obtener DATASET_ID del WABA
    const datasetUrl = `https://graph.facebook.com/v21.0/${waba_id}/dataset?access_token=${tokenForWaba}`;
    const datasetRes = await fetch(datasetUrl);
    const datasetData = await datasetRes.json();

    let datasetId = null;

    if (datasetData.data && datasetData.data.length > 0) {
      datasetId = datasetData.data[0].id;
      results.steps.push({ step: 'GET dataset', status: 'ok', detail: `Dataset encontrado: ${datasetId}` });
    } else {
      // No hay dataset — crear uno
      results.steps.push({ step: 'GET dataset', status: 'warning', detail: 'No hay dataset. Creando uno nuevo...' });

      const createUrl = `https://graph.facebook.com/v21.0/${waba_id}/dataset?access_token=${tokenForWaba}`;
      const createRes = await fetch(createUrl, { method: 'POST' });
      const createData = await createRes.json();

      if (createData.id) {
        datasetId = createData.id;
        results.steps.push({ step: 'CREATE dataset', status: 'ok', detail: `Dataset creado: ${datasetId}` });
      } else if (createData.error) {
        results.steps.push({ step: 'CREATE dataset', status: 'error', detail: `Error creando dataset: ${createData.error.message} (code: ${createData.error.code})` });
      } else {
        results.steps.push({ step: 'CREATE dataset', status: 'warning', detail: `Respuesta: ${JSON.stringify(createData).substring(0, 200)}` });
      }
    }

    // STEP 2: Enviar evento de prueba al DATASET (si tenemos ID)
    if (datasetId) {
      // Intentar múltiples combinaciones hasta que una funcione
      const attempts = [
        {
          name: 'LeadSubmitted + ctwa_clid ficticio',
          payload: {
            data: [{
              event_name: 'LeadSubmitted',
              event_time: Math.floor(Date.now() / 1000),
              event_id: `wa_verify_${Date.now()}_1`,
              action_source: 'business_messaging',
              messaging_channel: 'whatsapp',
              user_data: {
                whatsapp_business_account_id: waba_id,
                ctwa_clid: 'samurai_test_verification_click_id'
              },
              custom_data: { currency: 'MXN', value: 0 }
            }],
            ...(test_event_code && { test_event_code })
          }
        },
        {
          name: 'Purchase + solo waba_id',
          payload: {
            data: [{
              event_name: 'Purchase',
              event_time: Math.floor(Date.now() / 1000),
              event_id: `wa_verify_${Date.now()}_2`,
              action_source: 'business_messaging',
              messaging_channel: 'whatsapp',
              user_data: {
                whatsapp_business_account_id: waba_id
              },
              custom_data: { currency: 'MXN', value: 100 }
            }],
            ...(test_event_code && { test_event_code })
          }
        },
        {
          name: 'LeadSubmitted + solo waba_id',
          payload: {
            data: [{
              event_name: 'LeadSubmitted',
              event_time: Math.floor(Date.now() / 1000),
              event_id: `wa_verify_${Date.now()}_3`,
              action_source: 'business_messaging',
              messaging_channel: 'whatsapp',
              user_data: {
                whatsapp_business_account_id: waba_id
              },
              custom_data: { currency: 'MXN', value: 0 }
            }],
            ...(test_event_code && { test_event_code })
          }
        }
      ];

      let eventPayload = null;
      for (const attempt of attempts) {
        const eventUrl = `https://graph.facebook.com/v21.0/${datasetId}/events?access_token=${tokenForWaba}`;
        const eventRes = await fetch(eventUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attempt.payload)
        });
        const eventData = await eventRes.json();

        if (eventData.events_received) {
          results.steps.push({ step: `POST event (${attempt.name})`, status: 'ok', detail: `events_received: ${eventData.events_received}` });
          results.success = true;
          eventPayload = attempt.payload;
          break;
        } else {
          const errMsg = eventData.error?.message || JSON.stringify(eventData).substring(0, 150);
          results.steps.push({ step: `POST event (${attempt.name})`, status: 'error', detail: errMsg });
        }
      }

      results.dataset_id = datasetId;
      if (eventPayload) results.event_payload = eventPayload;

      // (resultados ya registrados en el loop de attempts)
    }

    // STEP 3: También enviar al Pixel estándar como fallback
    // (por si Meta cuenta ambos)
    results.steps.push({ step: 'info', status: 'ok', detail: 'La prueba de Pixel CAPI estándar se ejecuta en el botón principal de verificación.' });

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, steps: [{ step: 'crash', status: 'error', detail: error.message }] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
