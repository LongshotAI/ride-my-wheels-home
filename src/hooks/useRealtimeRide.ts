import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

interface RideEvent {
  id: string;
  ride_id: string;
  type: string;
  meta: any;
  created_at: string;
}

interface Message {
  id: string;
  ride_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export const useRealtimeRide = (rideId: string | null) => {
  const [rideEvents, setRideEvents] = useState<RideEvent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!rideId) return;

    let channel: RealtimeChannel;

    const setupRealtime = async () => {
      // Subscribe to ride events
      channel = supabase
        .channel(`ride:${rideId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'ride_events',
            filter: `ride_id=eq.${rideId}`,
          },
          (payload) => {
            const newEvent = payload.new as RideEvent;
            console.log('New ride event:', newEvent);
            
            setRideEvents((prev) => [...prev, newEvent]);
            
            // Update driver location if it's a location event
            if (newEvent.type === 'driver_location' && newEvent.meta) {
              setDriverLocation({
                lat: newEvent.meta.lat,
                lng: newEvent.meta.lng,
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `ride_id=eq.${rideId}`,
          },
          (payload) => {
            const newMessage = payload.new as Message;
            console.log('New message:', newMessage);
            setMessages((prev) => [...prev, newMessage]);
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
        });

      // Load initial events and messages
      const { data: events } = await supabase
        .from('ride_events')
        .select('*')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true });

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true });

      if (events) setRideEvents(events);
      if (msgs) setMessages(msgs);

      // Get latest driver location from events
      const locationEvent = events?.find(e => e.type === 'driver_location');
      if (locationEvent?.meta && typeof locationEvent.meta === 'object') {
        const metaObj = locationEvent.meta as { lat?: number; lng?: number };
        if (metaObj.lat && metaObj.lng) {
          setDriverLocation({
            lat: metaObj.lat,
            lng: metaObj.lng,
          });
        }
      }
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [rideId]);

  return { rideEvents, messages, driverLocation };
};