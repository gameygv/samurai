// @ts-nocheck
// ... (mantenemos lógica de parsing de mensajes igual)
// Solo actualizo la llamada al contexto:

    // ... código anterior ...
    
    // OBTENER CONTEXTO (Inyectando metadatos del canal)
    const contextRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/get-samurai-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ 
          lead, 
          platform: 'WHATSAPP', // <--- Clave para tu nuevo prompt
          has_phone: true 
        })
    });
    const { system_prompt } = await contextRes.json();

    // ... resto de la lógica de OpenAI y Evolution ...