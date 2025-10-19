import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { MapPin, Clock, DollarSign, User, LogOut, Navigation, MessageSquare, AlertTriangle, Star } from "lucide-react";
import RideMap from "@/components/RideMap";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import RideChat from "@/components/RideChat";
import RatingModal from "@/components/RatingModal";
import SOSModal from "@/components/SOSModal";
import { useRealtimeRide } from "@/hooks/useRealtimeRide";
import { geocodeAddress } from "@/lib/googleMaps";

const RiderDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pickup, setPickup] = useState({ address: "", lat: undefined as number | undefined, lng: undefined as number | undefined });
  const [dropoff, setDropoff] = useState({ address: "", lat: undefined as number | undefined, lng: undefined as number | undefined });
  const [activeRide, setActiveRide] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showSOS, setShowSOS] = useState(false);
  const [booking, setBooking] = useState(false);
  
  const { rideEvents, messages, driverLocation } = useRealtimeRide(activeRide?.id);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: userData } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.user.id)
      .single();

    // Check if user has super_admin role (god mode access)
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const roles = userRoles?.map(r => r.role) || [];
    const isSuperAdmin = roles.includes("super_admin" as any);

    // Super admins can access everything, otherwise check role
    if (!isSuperAdmin && userData?.role !== "rider") {
      navigate(`/${userData?.role || "auth"}`);
      return;
    }

    setUser(userData);
    loadActiveRide();
    setLoading(false);
  };

  const loadActiveRide = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: rides } = await supabase
      .from("rides")
      .select("*, driver:users!rides_driver_id_fkey(full_name, phone)")
      .eq("rider_id", session.user.id)
      .in("status", ["requested", "driver_assigned", "driver_arriving", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (rides && rides.length > 0) {
      setActiveRide(rides[0]);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleBookRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup.address || !dropoff.address) {
      toast.error("Please enter both pickup and dropoff locations");
      return;
    }

    if (!pickup.lat || !dropoff.lat) {
      toast.error("Please select addresses from the dropdown");
      return;
    }

    try {
      setBooking(true);
      
      const { data, error } = await supabase.functions.invoke("rides-request", {
        body: { pickup, dropoff }
      });

      if (error) throw error;

      toast.success("Ride requested! Finding a driver...");
      setActiveRide(data.ride);
      setPickup({ address: "", lat: undefined, lng: undefined });
      setDropoff({ address: "", lat: undefined, lng: undefined });
    } catch (error: any) {
      toast.error(error.message || "Failed to book ride");
    } finally {
      setBooking(false);
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;

    try {
      const { error } = await supabase.functions.invoke("rides-cancel", {
        body: { ride_id: activeRide.id }
      });

      if (error) throw error;

      toast.success("Ride cancelled");
      setActiveRide(null);
      setShowChat(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel ride");
    }
  };

  useEffect(() => {
    // Show rating modal when ride is completed
    if (activeRide?.status === "completed" && !showRating) {
      setShowRating(true);
    }
  }, [activeRide?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-card">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-accent bg-clip-text text-transparent">
            DeeDee Rider
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{user?.full_name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map Area */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-0 h-[600px] overflow-hidden">
              <RideMap
                pickup={activeRide?.pickup || (pickup.lat && pickup.lng ? pickup : undefined)}
                dropoff={activeRide?.dropoff || (dropoff.lat && dropoff.lng ? dropoff : undefined)}
                driverLocation={driverLocation || undefined}
              />
            </Card>

            {showChat && activeRide && (
              <RideChat rideId={activeRide.id} messages={messages} />
            )}
          </div>

          {/* Booking Panel */}
          <div className="space-y-6">
            {!activeRide ? (
              <Card className="p-6 shadow-card">
                <h2 className="text-2xl font-bold mb-6">Book a DeeDee</h2>
                <form onSubmit={handleBookRide} className="space-y-4">
                  <AddressAutocomplete
                    label="Pickup Location"
                    placeholder="Current location"
                    value={pickup.address}
                    onChange={(address, lat, lng) => 
                      setPickup({ address, lat: lat, lng: lng })
                    }
                    icon={<MapPin className="w-4 h-4" />}
                  />

                  <AddressAutocomplete
                    label="Dropoff Location"
                    placeholder="Where to?"
                    value={dropoff.address}
                    onChange={(address, lat, lng) => 
                      setDropoff({ address, lat: lat, lng: lng })
                    }
                    icon={<Navigation className="w-4 h-4" />}
                  />

                  <div className="pt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Estimated Time</span>
                      <span className="font-medium">~15 min</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Estimated Cost</span>
                      <span className="font-medium">$12.50</span>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full mt-6" 
                    size="lg"
                    disabled={booking || !pickup.lat || !dropoff.lat}
                  >
                    {booking ? "Requesting..." : "Request DeeDee"}
                  </Button>
                </form>
              </Card>
            ) : (
              <Card className="p-6 shadow-card border-accent">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Active Ride</h2>
                  <div className="px-3 py-1 bg-accent/10 rounded-full">
                    <span className="text-accent font-medium capitalize text-sm">
                      {activeRide.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-accent mt-1" />
                    <div>
                      <p className="text-sm text-muted-foreground">Pickup</p>
                      <p className="font-medium">{activeRide.pickup?.address}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Navigation className="w-5 h-5 text-success mt-1" />
                    <div>
                      <p className="text-sm text-muted-foreground">Dropoff</p>
                      <p className="font-medium">{activeRide.dropoff?.address}</p>
                    </div>
                  </div>

                  {activeRide.driver && (
                    <div className="pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-2">Your Driver</p>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-accent flex items-center justify-center text-white font-bold">
                          {activeRide.driver.full_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{activeRide.driver.full_name}</p>
                          <p className="text-sm text-muted-foreground">{activeRide.driver.phone}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 space-y-2">
                    {activeRide.status === "completed" ? (
                      <Button 
                        className="w-full bg-success hover:bg-success/90"
                        onClick={() => setShowRating(true)}
                      >
                        <Star className="w-4 h-4 mr-2" />
                        Rate Driver
                      </Button>
                    ) : (
                      <>
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => setShowChat(!showChat)}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          {showChat ? "Hide Chat" : "Message Driver"}
                        </Button>
                        <Button 
                          variant="outline" 
                          className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => setShowSOS(true)}
                        >
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          SOS Emergency
                        </Button>
                        <Button 
                          variant="ghost" 
                          className="w-full text-muted-foreground"
                          onClick={handleCancelRide}
                        >
                          Cancel Ride
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8 text-accent" />
                  <div>
                    <p className="text-2xl font-bold">12</p>
                    <p className="text-xs text-muted-foreground">Total Rides</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-8 h-8 text-success" />
                  <div>
                    <p className="text-2xl font-bold">$156</p>
                    <p className="text-xs text-muted-foreground">Total Spent</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {activeRide && showRating && (
        <RatingModal
          open={showRating}
          onClose={() => {
            setShowRating(false);
            setActiveRide(null);
          }}
          rideId={activeRide.id}
          driverId={activeRide.driver_id}
          driverName={activeRide.driver?.full_name || "Your driver"}
        />
      )}

      {activeRide && (
        <SOSModal
          open={showSOS}
          onClose={() => setShowSOS(false)}
          rideId={activeRide.id}
        />
      )}
    </div>
  );
};

export default RiderDashboard;