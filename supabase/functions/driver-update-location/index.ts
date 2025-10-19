import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LocationUpdate {
  lat: number;
  lng: number;
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

    // Verify user is a driver
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'driver') {
      throw new Error('Only drivers can update location');
    }

    const { lat, lng }: LocationUpdate = await req.json();

    // Validate coordinates
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error('Invalid coordinates');
    }

    // Update driver location
    const { error: updateError } = await supabase
      .from('driver_profiles')
      .update({
        current_lat: lat,
        current_lng: lng,
        last_gps_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // Get active ride for this driver
    const { data: activeRide } = await supabase
      .from('rides')
      .select('id')
      .eq('driver_id', user.id)
      .in('status', ['driver_assigned', 'driver_arriving', 'in_progress'])
      .single();

    // If driver has an active ride, create location event
    if (activeRide) {
      await supabase
        .from('ride_events')
        .insert({
          ride_id: activeRide.id,
          type: 'driver_location',
          meta: { lat, lng, timestamp: new Date().toISOString() }
        });
    }

    console.log('Driver location updated:', {
      driver_id: user.id,
      lat,
      lng,
      has_active_ride: !!activeRide
    });

    return new Response(
      JSON.stringify({ success: true, has_active_ride: !!activeRide }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating driver location:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});