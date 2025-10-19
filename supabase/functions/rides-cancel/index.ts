import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CancelRideRequest {
  ride_id: string;
  reason?: string;
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

    const { ride_id, reason }: CancelRideRequest = await req.json();

    // Get ride details
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*, rider:users!rides_rider_id_fkey(full_name), driver:users!rides_driver_id_fkey(full_name)')
      .eq('id', ride_id)
      .single();

    if (rideError || !ride) {
      throw new Error('Ride not found');
    }

    // Verify user is part of this ride
    if (ride.rider_id !== user.id && ride.driver_id !== user.id) {
      throw new Error('Unauthorized: not part of this ride');
    }

    // Check if ride can be cancelled
    if (['completed', 'cancelled_by_rider', 'cancelled_by_driver'].includes(ride.status)) {
      throw new Error('Ride cannot be cancelled');
    }

    // Determine cancellation status
    const cancelStatus = ride.rider_id === user.id ? 'cancelled_by_rider' : 'cancelled_by_driver';

    // Update ride status
    const { error: updateError } = await supabase
      .from('rides')
      .update({ status: cancelStatus })
      .eq('id', ride_id);

    if (updateError) throw updateError;

    // Create cancellation event
    await supabase.from('ride_events').insert({
      ride_id: ride_id,
      type: 'ride_cancelled',
      meta: {
        cancelled_by: user.id,
        cancelled_by_role: ride.rider_id === user.id ? 'rider' : 'driver',
        reason,
        timestamp: new Date().toISOString(),
      }
    });

    console.log(`🚫 Ride ${ride_id} cancelled by ${cancelStatus}`);

    // TODO: Handle refunds if payment was processed
    // TODO: Notify other party of cancellation

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Ride cancelled successfully',
        status: cancelStatus
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error cancelling ride:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
