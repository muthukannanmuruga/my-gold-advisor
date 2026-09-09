import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOLDAPI_URL = "https://www.goldapi.io/api/XAU/INR";
const SILVERAPI_URL = "https://www.goldapi.io/api/XAG/INR";

const GOLDAPI_KEYS = [
  "goldapi-1424smdvlf2mb-io",
  "goldapi-3e0c1smdzgsi9r-io", 
  "goldapi-3e0c1smdzgv381-io",
  "goldapi-3e0c1smdzgwsdi-io",
  "goldapi-bjf1f9sme3wjm5d-io",
  "goldapi-bjf1f9sme42prdt-io",
  "goldapi-1cey8cmsme52xgpr-io",
  "goldapi-1amhsme530vnf-io",
  "goldapi-1amhsme534dyb-io"
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching daily gold price...');

    let isApiSuccess = false;
    let price24K: number | null = null;
    let price22K: number | null = null;

    // Try each API key in sequence
    for (let i = 0; i < GOLDAPI_KEYS.length; i++) {
      try {
        console.log(`Trying API key ${i}...`);
        
        const resp = await fetch(GOLDAPI_URL, {
          headers: { 
            "x-access-token": GOLDAPI_KEYS[i], 
            Accept: "application/json" 
          },
        });

        if (!resp.ok) {
          throw new Error(`GoldAPI HTTP ${resp.status}`);
        }

        const json = await resp.json();
        
        // Calculate both 24K and 22K price per gram
        price24K = json.price_gram_24k ?? 
                      (json.price ? json.price / 31.1035 : null);
        price22K = json.price_gram_22k ?? 
                      (price24K ? (22 / 24) * price24K : null);

        if (price24K && price22K) {
          console.log(`Successfully fetched prices with API key ${i}`);
          isApiSuccess = true;
          break;
        }
      } catch (error) {
        console.warn(`API key ${i} failed:`, error.message);
        if (i === GOLDAPI_KEYS.length - 1) {
          console.error("All API keys exhausted");
        }
      }
    }

    if (!isApiSuccess || !price24K || !price22K) {
      throw new Error("Unable to get gold prices from any API key");
    }

    // Check if we already have a price entry for today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingEntry } = await supabase
      .from('gold_price_history')
      .select('id')
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`)
      .maybeSingle();

    if (existingEntry) {
      console.log('Gold price already recorded for today');
    } else {
      const { error: insertError } = await supabase
        .from('gold_price_history')
        .insert({
          price_inr_per_gram: Number(price24K.toFixed(2)),
          price_inr_per_gram_22k: Number(price22K.toFixed(2)),
          source: 'scheduled-api'
        });

      if (insertError) {
        throw insertError;
      }

      console.log(`Stored gold prices: 24K ₹${price24K.toFixed(2)}, 22K ₹${price22K.toFixed(2)} per gram`);
    }

    // --- Silver ---
    let silverPrice: number | null = null;
    for (let i = 0; i < GOLDAPI_KEYS.length; i++) {
      try {
        const resp = await fetch(SILVERAPI_URL, {
          headers: { "x-access-token": GOLDAPI_KEYS[i], Accept: "application/json" },
        });
        if (!resp.ok) throw new Error(`GoldAPI HTTP ${resp.status}`);
        const json = await resp.json();
        silverPrice = json.price_gram_24k ?? (json.price ? json.price / 31.1035 : null);
        if (silverPrice) break;
      } catch (error) {
        console.warn(`Silver API key ${i} failed:`, error.message);
      }
    }

    if (silverPrice) {
      const { data: existingSilver } = await supabase
        .from('silver_price_history')
        .select('id')
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`)
        .maybeSingle();

      if (existingSilver) {
        console.log('Silver price already recorded for today');
      } else {
        const { error: silverInsertError } = await supabase
          .from('silver_price_history')
          .insert({
            price_inr_per_gram: Number(silverPrice.toFixed(2)),
            source: 'scheduled-api'
          });
        if (silverInsertError) {
          console.error('Failed to store silver price:', silverInsertError.message);
        } else {
          console.log(`Stored silver price: ₹${silverPrice.toFixed(2)} per gram`);
        }
      }
    } else {
      console.error('Unable to get silver price from any API key');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        price24K: price24K.toFixed(2),
        price22K: price22K.toFixed(2),
        silverPrice: silverPrice ? silverPrice.toFixed(2) : null,
        message: 'Prices stored successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );


  } catch (error) {
    console.error('Error in fetch-daily-gold-price:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});