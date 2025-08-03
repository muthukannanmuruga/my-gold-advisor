import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching current gold price...');
    
    // Using metals-api.com for gold prices (free tier available)
    // Alternative APIs: goldapi.io, rapidapi.com/metals-api
    const response = await fetch('https://api.metals.live/v1/spot/gold');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Convert USD to INR (approximate rate, in production you'd fetch real rates)
    const usdToInrRate = 83.5; // This should be fetched from a currency API
    const goldPriceUsd = data.price; // Price per troy ounce in USD
    const goldPriceInrPerOunce = goldPriceUsd * usdToInrRate;
    
    // Convert to price per gram (1 troy ounce = 31.1035 grams)
    const goldPriceInrPerGram = goldPriceInrPerOunce / 31.1035;
    
    console.log(`Gold price fetched: $${goldPriceUsd}/oz, ₹${goldPriceInrPerGram.toFixed(2)}/gram`);
    
    return new Response(JSON.stringify({
      priceInrPerGram: Math.round(goldPriceInrPerGram * 100) / 100,
      priceUsdPerOunce: goldPriceUsd,
      lastUpdated: new Date().toISOString(),
      source: 'metals.live'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching gold price:', error);
    
    // Fallback to approximate current gold price if API fails
    const fallbackPrice = 7200; // Approximate INR per gram
    
    return new Response(JSON.stringify({
      priceInrPerGram: fallbackPrice,
      priceUsdPerOunce: 2650,
      lastUpdated: new Date().toISOString(),
      source: 'fallback',
      error: 'API unavailable, using fallback price'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});