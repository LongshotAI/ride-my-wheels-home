// Google Maps API utilities
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Address {
  address: string;
  lat: number;
  lng: number;
}

export interface RouteInfo {
  distance_mi: number;
  duration_min: number;
  polyline: string;
}

/**
 * Geocode an address to lat/lng coordinates
 */
export const geocodeAddress = async (address: string): Promise<Address> => {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key not configured");
  }

  const geocoder = new google.maps.Geocoder();
  
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const location = results[0].geometry.location;
        resolve({
          address: results[0].formatted_address,
          lat: location.lat(),
          lng: location.lng(),
        });
      } else {
        reject(new Error(`Geocoding failed: ${status}`));
      }
    });
  });
};

/**
 * Get route information between two points
 */
export const getRouteInfo = async (
  origin: LatLng,
  destination: LatLng
): Promise<RouteInfo> => {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key not configured");
  }

  const directionsService = new google.maps.DirectionsService();

  return new Promise((resolve, reject) => {
    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.BICYCLING,
      },
      (result, status) => {
        if (status === "OK" && result) {
          const route = result.routes[0];
          const leg = route.legs[0];
          
          resolve({
            distance_mi: (leg.distance?.value || 0) / 1609.34, // meters to miles
            duration_min: (leg.duration?.value || 0) / 60, // seconds to minutes
            polyline: route.overview_polyline || "",
          });
        } else {
          reject(new Error(`Directions request failed: ${status}`));
        }
      }
    );
  });
};

/**
 * Calculate Haversine distance between two points (fallback when Maps API unavailable)
 */
export const calculateDistance = (point1: LatLng, point2: LatLng): number => {
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const R = 3959; // Earth radius in miles

  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lng - point1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
      Math.cos(toRad(point2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Get current user location
 */
export const getCurrentLocation = (): Promise<LatLng> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};
