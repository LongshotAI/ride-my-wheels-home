import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RideRequest {
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  scheduled_for?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { pickup, dropoff, scheduled_for }: RideRequest = await req.json();

    // Validate coordinates
    if (!pickup.lat || !pickup.lng || !dropoff.lat || !dropoff.lng) {
      throw new Error('Invalid pickup or dropoff coordinates');
    }

    // Get pricing quote
    const { data: quoteData, error: quoteError } = await supabase.functions.invoke('rides-quote', {
      body: { pickup, dropoff }
    });

    if (quoteError) {
      console.error('Quote error:', quoteError);
      throw new Error('Failed to calculate pricing');
    }

    // Create ride
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .insert({
        rider_id: user.id,
        pickup,
        dropoff,
        quoted_price_cents: quoteData.quoted_price_cents,
        distance_mi: quoteData.distance_mi,
        duration_min: quoteData.eta_min,
        route_polyline: quoteData.route_polyline,
        scheduled_for,
        status: scheduled_for ? 'scheduled' : 'requested',
      })
      .select()
      .single();

    if (rideError) throw rideError;

    // Create ride event
    await supabase.from('ride_events').insert({
      ride_id: ride.id,
      type: 'ride_requested',
      meta: {
        pickup: pickup.address,
        dropoff: dropoff.address,
        quoted_price: quoteData.quoted_price_cents,
      }
    });

    console.log(`✅ Ride requested: ${ride.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        ride,
        quote: quoteData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating ride:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
