import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SOSRequest {
  ride_id: string;
  lat: number;
  lng: number;
  message?: string;
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { ride_id, lat, lng, message }: SOSRequest = await req.json();

    // Verify user is part of this ride
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*, rider:users!rides_rider_id_fkey(full_name, phone), driver:users!rides_driver_id_fkey(full_name, phone)')
      .eq('id', ride_id)
      .single();

    if (rideError || !ride) {
      throw new Error('Ride not found');
    }

    if (ride.rider_id !== user.id && ride.driver_id !== user.id) {
      throw new Error('Unauthorized: not part of this ride');
    }

    // Create SOS event
    const { error: eventError } = await supabase
      .from('ride_events')
      .insert({
        ride_id,
        type: 'sos',
        meta: {
          lat,
          lng,
          message,
          triggered_by: user.id,
          timestamp: new Date().toISOString()
        }
      });

    if (eventError) throw eventError;

    // Log critical alert
    console.error('🚨 SOS ALERT:', {
      ride_id,
      user_id: user.id,
      location: { lat, lng },
      message,
      rider: ride.rider,
      driver: ride.driver,
      timestamp: new Date().toISOString()
    });

    // In production, this would:
    // 1. Alert emergency contacts
    // 2. Notify admin dashboard
    // 3. Send SMS to rider/driver emergency contacts
    // 4. Create high-priority support ticket
    // 5. Share live location with authorities if needed

    return new Response(
      JSON.stringify({
        success: true,
        message: 'SOS alert triggered successfully',
        emergency_services_notified: false, // Would be true in production
        ride_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error handling SOS:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});