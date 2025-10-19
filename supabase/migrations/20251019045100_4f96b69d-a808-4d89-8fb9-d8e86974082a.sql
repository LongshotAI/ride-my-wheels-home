-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create ENUM types
CREATE TYPE app_role AS ENUM ('rider', 'driver', 'admin');
CREATE TYPE driver_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE background_check_status AS ENUM ('not_started', 'pending', 'clear', 'failed');
CREATE TYPE ride_status AS ENUM (
  'requested',
  'driver_assigned',
  'driver_arriving',
  'in_progress',
  'completed',
  'cancelled_by_rider',
  'cancelled_by_driver'
);
CREATE TYPE ride_event_type AS ENUM (
  'requested',
  'accepted',
  'driver_location',
  'arrived_pickup',
  'started',
  'sos',
  'arrived_dropoff',
  'completed',
  'cancelled'
);

-- Users table (extends auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'rider',
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Driver profiles
CREATE TABLE public.driver_profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  status driver_status NOT NULL DEFAULT 'pending',
  license_number TEXT,
  license_state TEXT,
  background_check_status background_check_status NOT NULL DEFAULT 'not_started',
  vehicle_experience_years INTEGER,
  bike_type TEXT,
  stripe_account_id TEXT,
  online BOOLEAN NOT NULL DEFAULT FALSE,
  current_lat NUMERIC(10, 6),
  current_lng NUMERIC(10, 6),
  last_gps_at TIMESTAMPTZ,
  rating_avg NUMERIC(3, 2) DEFAULT 0.00,
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rider profiles
CREATE TABLE public.rider_profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  default_address JSONB,
  emergency_contact JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rides table
CREATE TABLE public.rides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status ride_status NOT NULL DEFAULT 'requested',
  scheduled_for TIMESTAMPTZ,
  pickup JSONB NOT NULL,
  dropoff JSONB NOT NULL,
  route_polyline TEXT,
  quoted_price_cents INTEGER NOT NULL,
  final_price_cents INTEGER,
  distance_mi NUMERIC(6, 2),
  duration_min NUMERIC(6, 2),
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ride events (immutable audit log)
CREATE TABLE public.ride_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  type ride_event_type NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages (in-ride chat)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ratings
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE UNIQUE,
  rider_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pricing rules
CREATE TABLE public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_fare_cents INTEGER NOT NULL DEFAULT 500,
  per_mi_cents INTEGER NOT NULL DEFAULT 150,
  per_min_cents INTEGER NOT NULL DEFAULT 25,
  surge_multiplier NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
  city TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_rides_status_created ON public.rides(status, created_at);
CREATE INDEX idx_rides_rider_id ON public.rides(rider_id);
CREATE INDEX idx_rides_driver_id ON public.rides(driver_id);
CREATE INDEX idx_driver_profiles_online ON public.driver_profiles(online, last_gps_at);
CREATE INDEX idx_messages_ride_id ON public.messages(ride_id, created_at);
CREATE INDEX idx_ride_events_ride_id ON public.ride_events(ride_id, created_at);
CREATE INDEX idx_users_role ON public.users(role);

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update_updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_profiles_updated_at BEFORE UPDATE ON public.driver_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rider_profiles_updated_at BEFORE UPDATE ON public.rider_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create user profile after auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'rider')
  );
  
  -- Create role-specific profile
  IF (NEW.raw_user_meta_data->>'role' = 'driver') THEN
    INSERT INTO public.driver_profiles (id) VALUES (NEW.id);
  ELSIF (NEW.raw_user_meta_data->>'role' = 'rider' OR NEW.raw_user_meta_data->>'role' IS NULL) THEN
    INSERT INTO public.rider_profiles (id) VALUES (NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON public.users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for driver_profiles
CREATE POLICY "Drivers can view their own profile"
  ON public.driver_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Drivers can update their own profile"
  ON public.driver_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Riders can view assigned driver profile"
  ON public.driver_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.driver_id = driver_profiles.id
        AND rides.rider_id = auth.uid()
        AND rides.status IN ('driver_assigned', 'driver_arriving', 'in_progress')
    )
  );

CREATE POLICY "Admins can manage all driver profiles"
  ON public.driver_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for rider_profiles
CREATE POLICY "Riders can view their own profile"
  ON public.rider_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Riders can update their own profile"
  ON public.rider_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all rider profiles"
  ON public.rider_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for rides
CREATE POLICY "Riders can view their own rides"
  ON public.rides FOR SELECT
  USING (auth.uid() = rider_id);

CREATE POLICY "Riders can create rides"
  ON public.rides FOR INSERT
  WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Riders can update their own rides"
  ON public.rides FOR UPDATE
  USING (auth.uid() = rider_id);

CREATE POLICY "Drivers can view assigned rides"
  ON public.rides FOR SELECT
  USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can update assigned rides"
  ON public.rides FOR UPDATE
  USING (auth.uid() = driver_id);

CREATE POLICY "Admins can manage all rides"
  ON public.rides FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for ride_events
CREATE POLICY "Users can view events for their rides"
  ON public.ride_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = ride_events.ride_id
        AND (rides.rider_id = auth.uid() OR rides.driver_id = auth.uid())
    )
  );

CREATE POLICY "Drivers and riders can insert events for their rides"
  ON public.ride_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = ride_events.ride_id
        AND (rides.rider_id = auth.uid() OR rides.driver_id = auth.uid())
    )
  );

CREATE POLICY "Admins can view all ride events"
  ON public.ride_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for messages
CREATE POLICY "Participants can view messages in their rides"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = messages.ride_id
        AND (rides.rider_id = auth.uid() OR rides.driver_id = auth.uid())
    )
  );

CREATE POLICY "Participants can send messages in their rides"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = messages.ride_id
        AND (rides.rider_id = auth.uid() OR rides.driver_id = auth.uid())
    )
    AND auth.uid() = sender_id
  );

CREATE POLICY "Admins can view all messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for ratings
CREATE POLICY "Riders can view their own ratings"
  ON public.ratings FOR SELECT
  USING (auth.uid() = rider_id);

CREATE POLICY "Drivers can view ratings about them"
  ON public.ratings FOR SELECT
  USING (auth.uid() = driver_id);

CREATE POLICY "Riders can create ratings for their completed rides"
  ON public.ratings FOR INSERT
  WITH CHECK (
    auth.uid() = rider_id
    AND EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = ratings.ride_id
        AND rides.rider_id = auth.uid()
        AND rides.status = 'completed'
    )
  );

CREATE POLICY "Admins can view all ratings"
  ON public.ratings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- RLS Policies for pricing_rules
CREATE POLICY "Anyone can view active pricing rules"
  ON public.pricing_rules FOR SELECT
  USING (active = TRUE);

CREATE POLICY "Admins can manage pricing rules"
  ON public.pricing_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_events;

-- Insert default pricing rule
INSERT INTO public.pricing_rules (base_fare_cents, per_mi_cents, per_min_cents, city, active)
VALUES (500, 150, 25, 'Default', TRUE);

-- Create admin user function for seeding
CREATE OR REPLACE FUNCTION create_admin_user(
  admin_email TEXT,
  admin_password TEXT,
  admin_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- This is a helper function for development
  -- In production, admins should be created through proper channels
  RETURN NULL;
END;
$$;