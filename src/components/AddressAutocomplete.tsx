import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";

interface AddressAutocompleteProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (address: string, lat?: number, lng?: number) => void;
  icon?: React.ReactNode;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

// Global flag to track if Google Maps is loaded
let googleMapsLoaded = false;
let googleMapsLoadingPromise: Promise<void> | null = null;

const loadGoogleMaps = (): Promise<void> => {
  // Check if places library is already loaded
  if (googleMapsLoaded && window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (googleMapsLoadingPromise) {
    return googleMapsLoadingPromise;
  }

  googleMapsLoadingPromise = new Promise((resolve, reject) => {
    // If google maps is already loaded (by RideMap), just wait for places
    if (window.google?.maps) {
      // Check if places library is available
      const checkPlaces = () => {
        if (window.google?.maps?.places) {
          googleMapsLoaded = true;
          resolve();
        } else {
          // If places not available, load it
          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
          script.async = true;
          script.defer = true;
          script.onload = () => {
            // Wait a bit for places to initialize
            setTimeout(() => {
              if (window.google?.maps?.places) {
                googleMapsLoaded = true;
                resolve();
              } else {
                reject(new Error("Places library failed to load"));
              }
            }, 100);
          };
          script.onerror = () => reject(new Error("Failed to load Google Maps Places"));
          document.head.appendChild(script);
        }
      };
      checkPlaces();
      return;
    }

    // Google Maps not loaded at all, load it with places
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // Wait a bit for places to initialize
      setTimeout(() => {
        if (window.google?.maps?.places) {
          googleMapsLoaded = true;
          resolve();
        } else {
          reject(new Error("Places library failed to initialize"));
        }
      }, 100);
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return googleMapsLoadingPromise;
};

const AddressAutocomplete = ({
  label,
  placeholder,
  value,
  onChange,
  icon,
}: AddressAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !inputRef.current) return;

    loadGoogleMaps()
      .then(() => {
        if (!inputRef.current) return;

        // Double-check places is available
        if (!window.google?.maps?.places) {
          console.error("Google Maps Places library not available");
          return;
        }

        const autocompleteInstance = new google.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          fields: ["formatted_address", "geometry"],
        });

        autocompleteInstance.addListener("place_changed", () => {
          const place = autocompleteInstance.getPlace();
          if (place.geometry && place.geometry.location) {
            onChange(
              place.formatted_address || "",
              place.geometry.location.lat(),
              place.geometry.location.lng()
            );
          }
        });

        setAutocomplete(autocompleteInstance);
      })
      .catch((error) => {
        console.error("Error loading Google Maps API:", error);
      });

    return () => {
      if (autocomplete) {
        google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [onChange]);

  return (
    <div className="space-y-2">
      <Label htmlFor={label}>{label}</Label>
      <div className="relative">
        <div className="absolute left-3 top-3 text-muted-foreground">
          {icon || <MapPin className="w-4 h-4" />}
        </div>
        <Input
          ref={inputRef}
          id={label}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-10"
        />
      </div>
    </div>
  );
};

export default AddressAutocomplete;
