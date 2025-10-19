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
  if (googleMapsLoaded) {
    return Promise.resolve();
  }

  if (googleMapsLoadingPromise) {
    return googleMapsLoadingPromise;
  }

  googleMapsLoadingPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) {
      googleMapsLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      googleMapsLoaded = true;
      resolve();
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
