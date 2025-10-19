import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuoteRequest {
  pickup: { lat: number; lng: number; address?: string };
  dropoff: { lat: number; lng: number; address?: string };
  scheduled_for?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { pickup, dropoff, scheduled_for }: QuoteRequest = await req.json();

    // Calculate distance using Haversine formula
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const R = 3959; // Earth radius in miles
    
    const dLat = toRad(dropoff.lat - pickup.lat);
    const dLon = toRad(dropoff.lng - pickup.lng);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRad(pickup.lat)) * Math.cos(toRad(dropoff.lat)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance_mi = R * c;

    // Estimate duration (avg speed 30 mph in city)
    const duration_min = (distance_mi / 30) * 60;

    // Get active pricing rule
    const { data: pricingRule } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('active', true)
      .limit(1)
      .single();

    if (!pricingRule) {
      throw new Error('No active pricing rule found');
    }

    // Calculate price
    const base = pricingRule.base_fare_cents;
    const perMile = pricingRule.per_mi_cents * distance_mi;
    const perMin = pricingRule.per_min_cents * duration_min;
    const surge = pricingRule.surge_multiplier;
    
    const quoted_price_cents = Math.round((base + perMile + perMin) * surge);

    console.log('Quote calculated:', {
      distance_mi,
      duration_min,
      quoted_price_cents,
      surge_multiplier: surge
    });

    return new Response(
      JSON.stringify({
        distance_mi: parseFloat(distance_mi.toFixed(2)),
        duration_min: parseFloat(duration_min.toFixed(1)),
        quoted_price_cents,
        eta_min: parseFloat(duration_min.toFixed(1)),
        surge_multiplier: surge
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error calculating quote:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});