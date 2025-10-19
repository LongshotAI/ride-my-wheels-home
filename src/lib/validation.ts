import { z } from "zod";

// Ride booking validation
export const bookRideSchema = z.object({
  pickup: z.object({
    address: z.string().min(3, "Pickup address required"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  dropoff: z.object({
    address: z.string().min(3, "Dropoff address required"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  scheduled_for: z.string().datetime().optional(),
});

// Driver location update validation
export const locationUpdateSchema = z.object({
  lat: z.number().min(-90).max(90, "Invalid latitude"),
  lng: z.number().min(-180).max(180, "Invalid longitude"),
});

// Message validation
export const messageSchema = z.object({
  ride_id: z.string().uuid("Invalid ride ID"),
  body: z.string().min(1, "Message cannot be empty").max(1000, "Message too long"),
});

// Rating validation
export const ratingSchema = z.object({
  ride_id: z.string().uuid("Invalid ride ID"),
  stars: z.number().int().min(1, "Minimum 1 star").max(5, "Maximum 5 stars"),
  comment: z.string().max(500, "Comment too long").optional(),
});

// SOS validation
export const sosSchema = z.object({
  ride_id: z.string().uuid("Invalid ride ID"),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  message: z.string().max(500).optional(),
});

export type BookRideInput = z.infer<typeof bookRideSchema>;
export type LocationUpdateInput = z.infer<typeof locationUpdateSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type RatingInput = z.infer<typeof ratingSchema>;
export type SOSInput = z.infer<typeof sosSchema>;