import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User, LogOut, CheckCircle2, XCircle, Users, Car, DollarSign, TrendingUp, Settings, Shield } from "lucide-react";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [pendingDrivers, setPendingDrivers] = useState<any[]>([]);
  const [stats, setStats] = useState({ riders: 0, drivers: 0, activeRides: 0, revenue: 0 });

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

    if (userData?.role !== "admin") {
      navigate(`/${userData?.role || "auth"}`);
      return;
    }

    setUser(userData);
    loadPendingDrivers();
    loadStats();
  };

  const loadPendingDrivers = async () => {
    const { data } = await supabase
      .from("driver_profiles")
      .select("*, user:users!driver_profiles_id_fkey(*)")
      .eq("status", "pending");
    if (data) setPendingDrivers(data);
  };

  const loadStats = async () => {
    const { count: ridersCount } = await supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "rider");
    const { count: driversCount } = await supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "driver");
    const { count: activeRidesCount } = await supabase.from("rides").select("*", { count: "exact", head: true }).in("status", ["requested", "driver_assigned", "in_progress"]);
    
    setStats({
      riders: ridersCount || 0,
      drivers: driversCount || 0,
      activeRides: activeRidesCount || 0,
      revenue: 12450
    });
  };

  const handleApproveDriver = async (driverId: string) => {
    const { error } = await supabase.from("driver_profiles").update({ status: "approved" }).eq("id", driverId);
    if (error) {
      toast.error("Failed to approve driver");
    } else {
      toast.success("Driver approved!");
      loadPendingDrivers();
    }
  };

  const handleRejectDriver = async (driverId: string) => {
    const { error } = await supabase.from("driver_profiles").update({ status: "rejected" }).eq("id", driverId);
    if (error) {
      toast.error("Failed to reject driver");
    } else {
      toast.success("Driver rejected");
      loadPendingDrivers();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-card">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-accent bg-clip-text text-transparent">DeeDee Admin</h1>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/users")}>
              <Shield className="w-4 h-4 mr-2" />
              User Management
            </Button>
            <span className="font-medium">{user?.full_name}</span>
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut().then(() => navigate("/"))}>
              <LogOut className="w-4 h-4 mr-2" />Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6"><Users className="w-8 h-8 text-accent mb-2" /><p className="text-3xl font-bold">{stats.riders}</p><p className="text-sm text-muted-foreground">Total Riders</p></Card>
          <Card className="p-6"><Car className="w-8 h-8 text-success mb-2" /><p className="text-3xl font-bold">{stats.drivers}</p><p className="text-sm text-muted-foreground">Active Drivers</p></Card>
          <Card className="p-6"><TrendingUp className="w-8 h-8 text-accent mb-2" /><p className="text-3xl font-bold">{stats.activeRides}</p><p className="text-sm text-muted-foreground">Active Rides</p></Card>
          <Card className="p-6"><DollarSign className="w-8 h-8 text-success mb-2" /><p className="text-3xl font-bold">${stats.revenue}</p><p className="text-sm text-muted-foreground">Revenue (7d)</p></Card>
        </div>

        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-6">Pending Driver Approvals</h2>
          {pendingDrivers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No pending driver applications</p>
          ) : (
            <div className="space-y-4">
              {pendingDrivers.map((driver) => (
                <div key={driver.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <p className="font-bold">{driver.user?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{driver.user?.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleApproveDriver(driver.id)}><CheckCircle2 className="w-4 h-4 mr-1" />Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleRejectDriver(driver.id)}><XCircle className="w-4 h-4 mr-1" />Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;