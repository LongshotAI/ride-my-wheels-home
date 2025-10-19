import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, LogOut, MapPin, Navigation, DollarSign, Star, Clock, Bike, CheckCircle2, MessageSquare } from "lucide-react";
import RideMap from "@/components/RideMap";
import RideChat from "@/components/RideChat";
import { useRealtimeRide } from "@/hooks/useRealtimeRide";
import { getCurrentLocation } from "@/lib/googleMaps";

const DriverDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  const { messages, driverLocation } = useRealtimeRide(activeRide?.id);

  useEffect(() => {
    checkAuth();
  }, []);

  // Update location when online
  useEffect(() => {
    if (!online) return;

    const updateLocation = async () => {
      try {
        const location = await getCurrentLocation();
        setCurrentLocation(location);

        await supabase.functions.invoke("driver-update-location", {
          body: { lat: location.lat, lng: location.lng }
        });
      } catch (error) {
        console.error("Error updating location:", error);
      }
    };

    updateLocation();
    const interval = setInterval(updateLocation, 10000); // Update every 10s

    return () => clearInterval(interval);
  }, [online, activeRide?.id]);

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

    if (userData?.role !== "driver") {
      navigate(`/${userData?.role || "auth"}`);
      return;
    }

    const { data: driverData } = await supabase
      .from("driver_profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setUser(userData);
    setDriverProfile(driverData);
    setOnline(driverData?.online || false);
    
    if (driverData?.online) {
      loadAvailableRides();
      loadActiveRide();
    }
    
    setLoading(false);
  };

  const loadAvailableRides = async () => {
    const { data: rides } = await supabase
      .from("rides")
      .select("*, rider:users!rides_rider_id_fkey(full_name, phone)")
      .eq("status", "requested")
      .order("created_at", { ascending: false })
      .limit(5);

    if (rides) {
      setAvailableRides(rides);
    }
  };

  const loadActiveRide = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: rides } = await supabase
      .from("rides")
      .select("*, rider:users!rides_rider_id_fkey(full_name, phone)")
      .eq("driver_id", session.user.id)
      .in("status", ["driver_assigned", "driver_arriving", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (rides && rides.length > 0) {
      setActiveRide(rides[0]);
    }
  };

  const handleToggleOnline = async (checked: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const { error } = await supabase
        .from("driver_profiles")
        .update({ online: checked })
        .eq("id", session.user.id);

      if (error) throw error;

      setOnline(checked);
      toast.success(checked ? "You're now online!" : "You're now offline");
      
      if (checked) {
        loadAvailableRides();
      } else {
        setAvailableRides([]);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    }
  };

  const handleAcceptRide = async (rideId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("rides-accept", {
        body: { ride_id: rideId }
      });

      if (error) throw error;

      toast.success("Ride accepted! Navigate to pickup location");
      setActiveRide(data.ride);
      loadAvailableRides();
    } catch (error: any) {
      toast.error(error.message || "Failed to accept ride");
    }
  };

  const handleUpdateRideStatus = async (status: "driver_arriving" | "in_progress" | "completed") => {
    if (!activeRide) return;

    try {
      const { error } = await supabase
        .from("rides")
        .update({ status })
        .eq("id", activeRide.id);

      if (error) throw error;

      toast.success(`Ride status updated: ${status.replace(/_/g, " ")}`);
      
      if (status === "completed") {
        setActiveRide(null);
        loadAvailableRides();
      } else {
        loadActiveRide();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update ride status");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (driverProfile?.status !== "approved") {
    return (
      <div className="min-h-screen bg-gradient-card flex items-center justify-center p-4">
        <Card className="max-w-md p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-2xl font-bold">Application Under Review</h2>
          <p className="text-muted-foreground">
            Your driver application is currently being reviewed. You'll receive an email once you're approved to start driving with DeeDee.
          </p>
          <Badge variant="secondary" className="mt-4">
            Status: {driverProfile?.status}
          </Badge>
          <Button onClick={handleSignOut} variant="outline" className="w-full mt-4">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-card">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold bg-gradient-accent bg-clip-text text-transparent">
              DeeDee Driver
            </h1>
            <div className="flex items-center gap-3">
              <Switch
                id="online-status"
                checked={online}
                onCheckedChange={handleToggleOnline}
              />
              <Label htmlFor="online-status" className="font-medium">
                {online ? (
                  <span className="text-success">Online</span>
                ) : (
                  <span className="text-muted-foreground">Offline</span>
                )}
              </Label>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{user?.full_name}</span>
            </div>
            <Badge variant="outline" className="gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {driverProfile?.rating_avg || "5.00"}
            </Badge>
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
                pickup={activeRide?.pickup}
                dropoff={activeRide?.dropoff}
                driverLocation={currentLocation || undefined}
              />
            </Card>

            {showChat && activeRide && (
              <RideChat rideId={activeRide.id} messages={messages} />
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <Card className="p-4">
                <div className="flex flex-col items-center gap-2">
                  <Clock className="w-6 h-6 text-accent" />
                  <p className="text-2xl font-bold">{driverProfile?.rating_count || 0}</p>
                  <p className="text-xs text-muted-foreground text-center">Total Rides</p>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex flex-col items-center gap-2">
                  <DollarSign className="w-6 h-6 text-success" />
                  <p className="text-2xl font-bold">$2.4k</p>
                  <p className="text-xs text-muted-foreground text-center">Total Earned</p>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex flex-col items-center gap-2">
                  <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                  <p className="text-2xl font-bold">{driverProfile?.rating_avg || "5.00"}</p>
                  <p className="text-xs text-muted-foreground text-center">Rating</p>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex flex-col items-center gap-2">
                  <Bike className="w-6 h-6 text-accent" />
                  <p className="text-2xl font-bold">{online ? "Active" : "Offline"}</p>
                  <p className="text-xs text-muted-foreground text-center">Status</p>
                </div>
              </Card>
            </div>
          </div>

          {/* Rides Panel */}
          <div className="space-y-6">
            {activeRide ? (
              <Card className="p-6 shadow-card border-success">
                <h2 className="text-xl font-bold mb-4">Active Ride</h2>
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

                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-2">Rider</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-accent flex items-center justify-center text-white font-bold">
                        {activeRide.rider?.full_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{activeRide.rider?.full_name}</p>
                        <p className="text-sm text-muted-foreground">{activeRide.rider?.phone}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setShowChat(!showChat)}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      {showChat ? "Hide Chat" : "Message Rider"}
                    </Button>

                    {activeRide.status === "driver_assigned" && (
                      <Button 
                        className="w-full"
                        onClick={() => handleUpdateRideStatus("driver_arriving")}
                      >
                        <Navigation className="w-4 h-4 mr-2" />
                        Arrived at Pickup
                      </Button>
                    )}
                    {activeRide.status === "driver_arriving" && (
                      <Button 
                        className="w-full bg-success hover:bg-success/90"
                        onClick={() => handleUpdateRideStatus("in_progress")}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Start Ride
                      </Button>
                    )}
                    {activeRide.status === "in_progress" && (
                      <Button 
                        className="w-full bg-success hover:bg-success/90"
                        onClick={() => handleUpdateRideStatus("completed")}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Complete Ride
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-6 shadow-card">
                <h2 className="text-xl font-bold mb-4">
                  {online ? "Available Rides" : "Go Online to See Rides"}
                </h2>
                {!online ? (
                  <p className="text-muted-foreground text-center py-8">
                    Toggle "Online" to start receiving ride requests
                  </p>
                ) : availableRides.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No rides available nearby. We'll notify you when new requests come in!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {availableRides.map((ride) => (
                      <div
                        key={ride.id}
                        className="border border-border rounded-lg p-4 hover:border-accent transition-colors"
                      >
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-accent" />
                            <span className="text-muted-foreground">Pickup:</span>
                            <span className="font-medium truncate">{ride.pickup?.address}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Navigation className="w-4 h-4 text-success" />
                            <span className="text-muted-foreground">Dropoff:</span>
                            <span className="font-medium truncate">{ride.dropoff?.address}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-success font-bold">
                            ${(ride.quoted_price_cents / 100).toFixed(2)}
                          </span>
                          <Button 
                            size="sm"
                            onClick={() => handleAcceptRide(ride.id)}
                          >
                            Accept Ride
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverDashboard;