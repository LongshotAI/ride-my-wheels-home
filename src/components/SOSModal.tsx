import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Phone } from "lucide-react";
import { toast } from "sonner";

interface SOSModalProps {
  open: boolean;
  onClose: () => void;
  rideId: string;
}

const SOSModal = ({ open, onClose, rideId }: SOSModalProps) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const getLocation = () => {
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
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
        }
      );
    });
  };

  const handleSOS = async () => {
    try {
      setSending(true);

      // Get current location
      const currentLocation = await getLocation();
      setLocation(currentLocation);

      // Call SOS edge function
      const { data, error } = await supabase.functions.invoke("rides-sos", {
        body: {
          ride_id: rideId,
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          message: message.trim() || undefined,
        },
      });

      if (error) throw error;

      console.log("SOS triggered:", data);

      toast.success("Emergency alert sent! Help is on the way.", {
        duration: 10000,
      });

      onClose();
    } catch (error: any) {
      console.error("Error triggering SOS:", error);
      toast.error(error.message || "Failed to send emergency alert. Please call 911.");
    } finally {
      setSending(false);
    }
  };

  const handleCall911 = () => {
    window.location.href = "tel:911";
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="border-destructive">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="w-8 h-8" />
            <AlertDialogTitle className="text-2xl">Emergency SOS</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            This will immediately alert emergency contacts, the driver, and DeeDee support with your
            current location.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          {/* Emergency Message */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              What's happening? (Optional)
            </label>
            <Textarea
              placeholder="Describe the emergency..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              rows={3}
              className="border-destructive/50"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleSOS}
              disabled={sending}
              className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              size="lg"
            >
              {sending ? "Sending Alert..." : "Send SOS Alert"}
            </Button>

            <Button
              onClick={handleCall911}
              variant="outline"
              className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              size="lg"
            >
              <Phone className="w-4 h-4 mr-2" />
              Call 911
            </Button>

            <Button
              onClick={onClose}
              variant="ghost"
              disabled={sending}
              className="w-full"
            >
              Cancel
            </Button>
          </div>

          {/* Safety Info */}
          <div className="bg-muted p-3 rounded-lg text-xs text-muted-foreground">
            <p className="font-medium mb-1">🛡️ Your Safety is Priority</p>
            <p>
              This alert will share your live location, ride details, and emergency message with
              authorities and DeeDee's safety team. If you're in immediate danger, call 911 directly.
            </p>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SOSModal;