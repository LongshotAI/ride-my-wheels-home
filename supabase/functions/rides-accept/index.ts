import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AcceptRideRequest {
  ride_id: string;
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

    const { ride_id }: AcceptRideRequest = await req.json();

    // Verify driver is approved and online
    const { data: driverProfile, error: driverError } = await supabase
      .from('driver_profiles')
      .select('status, online, background_check_status')
      .eq('id', user.id)
      .single();

    if (driverError || !driverProfile) {
      throw new Error('Driver profile not found');
    }

    if (driverProfile.status !== 'approved') {
      throw new Error('Driver not approved');
    }

    if (!driverProfile.online) {
      throw new Error('Driver must be online to accept rides');
    }

    if (driverProfile.background_check_status !== 'clear') {
      throw new Error('Background check must be clear');
    }

    // Check if ride is still available
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', ride_id)
      .single();

    if (rideError || !ride) {
      throw new Error('Ride not found');
    }

    if (ride.status !== 'requested') {
      throw new Error('Ride is no longer available');
    }

    // Assign driver to ride
    const { data: updatedRide, error: updateError } = await supabase
      .from('rides')
      .update({
        driver_id: user.id,
        status: 'driver_assigned',
      })
      .eq('id', ride_id)
      .eq('status', 'requested') // Double-check status hasn't changed
      .select()
      .single();

    if (updateError) {
      if (updateError.message.includes('0 rows')) {
        throw new Error('Ride was just accepted by another driver');
      }
      throw updateError;
    }

    // Create ride event
    await supabase.from('ride_events').insert({
      ride_id: ride_id,
      type: 'driver_assigned',
      meta: {
        driver_id: user.id,
        timestamp: new Date().toISOString(),
      }
    });

    console.log(`✅ Ride ${ride_id} accepted by driver ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        ride: updatedRide,
        message: 'Ride accepted successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error accepting ride:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
