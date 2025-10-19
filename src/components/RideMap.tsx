import { useEffect, useState, useRef } from "react";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { LatLng } from "@/lib/googleMaps";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

interface RideMapProps {
  pickup?: LatLng;
  dropoff?: LatLng;
  driverLocation?: LatLng;
  currentLocation?: LatLng;
  center?: LatLng;
  zoom?: number;
  showRoute?: boolean;
  showMultipleRoutes?: boolean; // For driver to see multiple route options
}

// Default center (San Francisco)
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

const MapContent = ({ 
  pickup, 
  dropoff, 
  driverLocation, 
  currentLocation,
  showRoute = false,
  showMultipleRoutes = false
}: RideMapProps) => {
  const map = useMap();
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const alternateRenderersRef = useRef<google.maps.DirectionsRenderer[]>([]);

  // Display routes
  useEffect(() => {
    if (!map || !showRoute) return;

    const directionsService = new google.maps.DirectionsService();

    // Determine origin and destination
    let origin: LatLng | undefined;
    let destination: LatLng | undefined;

    if (driverLocation && pickup) {
      // Driver to pickup
      origin = driverLocation;
      destination = pickup;
    } else if (pickup && dropoff) {
      // Pickup to dropoff (rider view)
      origin = pickup;
      destination = dropoff;
    }

    if (!origin || !destination) return;

    // Clear existing renderers
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
    }
    alternateRenderersRef.current.forEach(renderer => renderer.setMap(null));
    alternateRenderersRef.current = [];

    // Request routes
    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.BICYCLING,
        provideRouteAlternatives: showMultipleRoutes,
      },
      (result, status) => {
        if (status === "OK" && result) {
          // Display primary route
          if (!directionsRendererRef.current) {
            directionsRendererRef.current = new google.maps.DirectionsRenderer({
              suppressMarkers: false,
              polylineOptions: {
                strokeColor: "#10b981",
                strokeWeight: 5,
                strokeOpacity: 0.8,
              },
            });
          }
          
          directionsRendererRef.current.setMap(map);
          directionsRendererRef.current.setDirections(result);

          // Display alternate routes if requested
          if (showMultipleRoutes && result.routes.length > 1) {
            for (let i = 1; i < result.routes.length; i++) {
              const alternateRenderer = new google.maps.DirectionsRenderer({
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: "#3b82f6",
                  strokeWeight: 4,
                  strokeOpacity: 0.5,
                },
                routeIndex: i,
              });
              
              alternateRenderer.setMap(map);
              alternateRenderer.setDirections(result);
              alternateRenderersRef.current.push(alternateRenderer);
            }
          }
        }
      }
    );

    return () => {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
      alternateRenderersRef.current.forEach(renderer => renderer.setMap(null));
    };
  }, [map, pickup, dropoff, driverLocation, showRoute, showMultipleRoutes]);

  // Auto-fit bounds to show all markers when not showing routes
  useEffect(() => {
    if (!map || showRoute) return;

    const bounds = new google.maps.LatLngBounds();
    let hasMarkers = false;

    if (currentLocation) {
      bounds.extend(new google.maps.LatLng(currentLocation.lat, currentLocation.lng));
      hasMarkers = true;
    }
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
      map.fitBounds(bounds, 50);
    }
  }, [map, pickup, dropoff, driverLocation, currentLocation, showRoute]);

  return (
    <>
      {/* Only show markers if not showing routes (routes have their own markers) */}
      {!showRoute && (
        <>
          {currentLocation && (
            <Marker
              position={currentLocation}
              title="Your Location"
              icon={{
                url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
              }}
            />
          )}
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
                url: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png",
              }}
            />
          )}
        </>
      )}
    </>
  );
};

const RideMap = (props: RideMapProps) => {
  // Determine the best center point - ALWAYS have a valid center
  const getInitialCenter = (): LatLng => {
    if (props.center) return props.center;
    if (props.currentLocation) return props.currentLocation;
    if (props.driverLocation) return props.driverLocation;
    if (props.pickup) return props.pickup;
    return DEFAULT_CENTER;
  };

  const [mapCenter] = useState<LatLng>(getInitialCenter());

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
    currentLocation: props.currentLocation,
    hasDriver: !!props.driverLocation,
    showRoute: props.showRoute
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
