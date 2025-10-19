import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MapPin, Clock, DollarSign, User, LogOut, Navigation, MessageSquare, AlertTriangle } from "lucide-react";

const RiderDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [activeRide, setActiveRide] = useState<any>(null);

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

    if (userData?.role !== "rider") {
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
    if (!pickup || !dropoff) {
      toast.error("Please enter both pickup and dropoff locations");
      return;
    }

    // Mock pricing calculation
    const quotedPrice = 500 + Math.floor(Math.random() * 2000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: ride, error } = await supabase
        .from("rides")
        .insert({
          rider_id: session.user.id,
          pickup: { address: pickup },
          dropoff: { address: dropoff },
          quoted_price_cents: quotedPrice,
          status: "requested",
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Ride requested! Finding a driver...");
      setActiveRide(ride);
      setPickup("");
      setDropoff("");
    } catch (error: any) {
      toast.error(error.message || "Failed to book ride");
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;

    try {
      const { error } = await supabase
        .from("rides")
        .update({ status: "cancelled_by_rider" })
        .eq("id", activeRide.id);

      if (error) throw error;

      toast.success("Ride cancelled");
      setActiveRide(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel ride");
    }
  };

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
          <div className="lg:col-span-2">
            <Card className="p-6 h-[600px] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-success/5 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <MapPin className="w-16 h-16 mx-auto text-muted-foreground animate-pulse" />
                  <p className="text-muted-foreground">
                    Google Maps integration will appear here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Real-time driver tracking & route display
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Booking Panel */}
          <div className="space-y-6">
            {!activeRide ? (
              <Card className="p-6 shadow-card">
                <h2 className="text-2xl font-bold mb-6">Book a DeeDee</h2>
                <form onSubmit={handleBookRide} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pickup">Pickup Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="pickup"
                        placeholder="Current location"
                        value={pickup}
                        onChange={(e) => setPickup(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dropoff">Dropoff Location</Label>
                    <div className="relative">
                      <Navigation className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="dropoff"
                        placeholder="Where to?"
                        value={dropoff}
                        onChange={(e) => setDropoff(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

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

                  <Button type="submit" className="w-full mt-6" size="lg">
                    Request DeeDee
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
                    <Button variant="outline" className="w-full">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Message Driver
                    </Button>
                    <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      SOS
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full text-muted-foreground"
                      onClick={handleCancelRide}
                    >
                      Cancel Ride
                    </Button>
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
    </div>
  );
};

export default RiderDashboard;