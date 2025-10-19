import { useEffect, useState } from "react";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { LatLng } from "@/lib/googleMaps";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

interface RideMapProps {
  pickup?: LatLng;
  dropoff?: LatLng;
  driverLocation?: LatLng;
  center?: LatLng;
  zoom?: number;
}

// Default center (San Francisco)
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

const MapContent = ({ pickup, dropoff, driverLocation, center, zoom = 13 }: RideMapProps) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Auto-fit bounds to show all markers
    const bounds = new google.maps.LatLngBounds();
    let hasMarkers = false;

    if (pickup) {
      bounds.extend(new google.maps.LatLng(pickup.lat, pickup.lng));
      hasMarkers = true;
    }
    if (dropoff) {
      bounds.extend(new google.maps.LatLng(dropoff.lat, dropoff.lng));
      hasMarkers = true;
    }
    if (driverLocation) {
      bounds.extend(new google.maps.LatLng(driverLocation.lat, driverLocation.lng));
      hasMarkers = true;
    }

    if (hasMarkers) {
      map.fitBounds(bounds);
    }
  }, [map, pickup, dropoff, driverLocation]);

  return (
    <>
      {pickup && (
        <Marker
          position={pickup}
          title="Pickup Location"
          icon={{
            url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
          }}
        />
      )}
      {dropoff && (
        <Marker
          position={dropoff}
          title="Dropoff Location"
          icon={{
            url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
          }}
        />
      )}
      {driverLocation && (
        <Marker
          position={driverLocation}
          title="Driver Location"
          icon={{
            url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          }}
        />
      )}
    </>
  );
};

const RideMap = (props: RideMapProps) => {
  // Determine the best center point
  const getInitialCenter = (): LatLng => {
    if (props.center) return props.center;
    if (props.pickup) return props.pickup;
    if (props.driverLocation) return props.driverLocation;
    return DEFAULT_CENTER;
  };

  const [mapCenter, setMapCenter] = useState<LatLng>(getInitialCenter());

  useEffect(() => {
    if (props.driverLocation) {
      setMapCenter(props.driverLocation);
    } else if (props.pickup) {
      setMapCenter(props.pickup);
    }
  }, [props.driverLocation, props.pickup]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground font-medium">Google Maps Not Configured</p>
          <p className="text-sm text-muted-foreground">
            Add VITE_GOOGLE_MAPS_API_KEY to environment
          </p>
        </div>
      </div>
    );
  }

  console.log('RideMap rendering with:', { 
    center: mapCenter, 
    pickup: props.pickup, 
    dropoff: props.dropoff,
    hasDriver: !!props.driverLocation 
  });

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
      <Map
        center={mapCenter}
        zoom={props.zoom || 13}
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: "100%", height: "100%" }}
        mapId="deedee-map"
      >
        <MapContent {...props} />
      </Map>
    </APIProvider>
  );
};

export default RideMap;
