import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AvailableDriversRequest {
  pickup: { lat: number; lng: number };
  max_distance_mi?: number;
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

    const { pickup, max_distance_mi = 10 }: AvailableDriversRequest = await req.json();

    // Get online drivers with clear background checks
    const { data: drivers, error } = await supabase
      .from('driver_profiles')
      .select('id, current_lat, current_lng, rating_avg, last_gps_at, user:users!driver_profiles_id_fkey!inner(full_name)')
      .eq('online', true)
      .eq('status', 'approved')
      .eq('background_check_status', 'clear')
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null);

    if (error) throw error;

    // Calculate distances and filter by max distance
    const driversWithDistance = drivers
      ?.map((driver) => {
        const toRad = (deg: number) => deg * (Math.PI / 180);
        const R = 3959; // Earth radius in miles
        
        const dLat = toRad(pickup.lat - driver.current_lat);
        const dLon = toRad(pickup.lng - driver.current_lng);
        
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(toRad(pickup.lat)) * Math.cos(toRad(driver.current_lat)) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance_mi = R * c;

        const eta_min = (distance_mi / 15) * 60; // Bike speed ~15 mph

        return {
          driver_id: driver.id,
          driver_name: (driver.user as any)?.full_name || 'Unknown',
          distance_mi: parseFloat(distance_mi.toFixed(2)),
          eta_min: parseFloat(eta_min.toFixed(1)),
          rating: driver.rating_avg,
          last_seen: driver.last_gps_at
        };
      })
      .filter((d) => d.distance_mi <= max_distance_mi)
      .sort((a, b) => a.distance_mi - b.distance_mi) || [];

    console.log(`Found ${driversWithDistance.length} available drivers within ${max_distance_mi} miles`);

    return new Response(
      JSON.stringify({ drivers: driversWithDistance }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error finding available drivers:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});