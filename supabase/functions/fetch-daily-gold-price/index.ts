import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOLDAPI_URL = "https://www.goldapi.io/api/XAU/INR";
const GOLDAPI_KEY = "goldapi-1424smdvlf2mb-io";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching daily gold price...');

    // Fetch current gold price
    const resp = await fetch(GOLDAPI_URL, {
      headers: { 
        "x-access-token": GOLDAPI_KEY, 
        Accept: "application/json" 
      },
    });

    if (!resp.ok) {
      throw new Error(`GoldAPI HTTP ${resp.status}`);
    }

    const json = await resp.json();
    
    // Calculate both 24K and 22K price per gram
    let price24K = json.price_gram_24k ?? 
                  (json.price ? json.price / 31.1035 : null);
    let price22K = json.price_gram_22k ?? 
                  (price24K ? (22 / 24) * price24K : null);

    if (!price24K || !price22K) {
      throw new Error("Unable to get gold prices");
    }

    // Check if we already have a price entry for today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingEntry } = await supabase
      .from('gold_price_history')
      .select('id')
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`)
      .single();

    if (existingEntry) {
      console.log('Price already recorded for today');
      return new Response(
        JSON.stringify({ message: 'Price already recorded for today' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store both prices
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        price24K: price24K.toFixed(2),
        price22K: price22K.toFixed(2),
        message: 'Gold prices stored successfully' 
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