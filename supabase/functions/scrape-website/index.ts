import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()

    if (!url) {
      throw new Error('URL is required')
    }

    console.log(`Scraping URL: ${url}`);

    // 1. Fetch the HTML
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SamuraiBot/1.0; +http://dyad.sh)'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch website: ${response.statusText}`);
    }

    const html = await response.text();

    // 2. Load into Cheerio to parse
    const $ = cheerio.load(html);

    // 3. Remove junk (scripts, styles, hidden elements, navbars if possible)
    $('script').remove();
    $('style').remove();
    $('noscript').remove();
    $('iframe').remove();
    $('svg').remove();
    $('header').remove(); // Optional: remove header to reduce noise
    $('footer').remove();

    // 4. Extract text
    // We target the body or a specific main container if known
    let text = $('body').text();

    // 5. Clean whitespace (collapse multiple spaces/newlines into one)
    text = text.replace(/\s+/g, ' ').trim();

    // Limit text length to avoid token overflow context (e.g. 4000 chars)
    const truncatedText = text.substring(0, 5000);

    return new Response(
      JSON.stringify({ 
        success: true, 
        title: $('title').text() || url,
        content: truncatedText,
        length: truncatedText.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Scrape Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})