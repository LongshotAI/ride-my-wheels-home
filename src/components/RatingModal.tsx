import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { ratingSchema } from "@/lib/validation";

interface RatingModalProps {
  open: boolean;
  onClose: () => void;
  rideId: string;
  driverId: string;
  driverName: string;
}

const RatingModal = ({ open, onClose, rideId, driverId, driverName }: RatingModalProps) => {
  const [stars, setStars] = useState(0);
  const [hoveredStars, setHoveredStars] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (stars === 0) {
      toast.error("Please select a rating");
      return;
    }

    try {
      // Validate input
      const validated = ratingSchema.parse({
        ride_id: rideId,
        stars,
        comment: comment.trim() || undefined,
      });

      setSubmitting(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("ratings").insert({
        ride_id: validated.ride_id,
        rider_id: user.id,
        driver_id: driverId,
        stars: validated.stars,
        comment: validated.comment,
      });

      if (error) throw error;

      // Update driver's average rating
      const { data: allRatings } = await supabase
        .from("ratings")
        .select("stars")
        .eq("driver_id", driverId);

      if (allRatings) {
        const avgRating =
          allRatings.reduce((sum, r) => sum + r.stars, 0) / allRatings.length;
        
        await supabase
          .from("driver_profiles")
          .update({
            rating_avg: parseFloat(avgRating.toFixed(2)),
            rating_count: allRatings.length,
          })
          .eq("id", driverId);
      }

      toast.success("Thanks for your feedback!");
      onClose();
    } catch (error: any) {
      console.error("Error submitting rating:", error);
      toast.error(error.message || "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Your Driver</DialogTitle>
          <DialogDescription>
            How was your experience with {driverName}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="transition-transform hover:scale-110"
                onClick={() => setStars(star)}
                onMouseEnter={() => setHoveredStars(star)}
                onMouseLeave={() => setHoveredStars(0)}
              >
                <Star
                  className={`w-12 h-12 ${
                    star <= (hoveredStars || stars)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>

          {stars > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              {stars === 5 && "Excellent!"}
              {stars === 4 && "Very Good"}
              {stars === 3 && "Good"}
              {stars === 2 && "Fair"}
              {stars === 1 && "Poor"}
            </p>
          )}

          {/* Optional Comment */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Additional Comments (Optional)
            </label>
            <Textarea
              placeholder="Tell us about your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={4}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500
            </p>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={submitting || stars === 0}
            className="w-full"
          >
            {submitting ? "Submitting..." : "Submit Rating"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RatingModal;