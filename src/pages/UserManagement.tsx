import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { User, Shield, Search, ChevronLeft } from "lucide-react";

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  roles: string[];
}

const UserManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    loadUsers();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      setFilteredUsers(
        users.filter(
          (user) =>
            user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.full_name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

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

    // Check if user has super_admin or admin role
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const roles = userRoles?.map((r) => r.role) || [];
    const isSuperAdmin = roles.includes("super_admin" as any);
    const isAdmin = roles.includes("admin");

    if (!isSuperAdmin && !isAdmin) {
      navigate("/");
      return;
    }

    setCurrentUser({ ...userData, roles });
  };

  const loadUsers = async () => {
    try {
      // Get all users
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, email, full_name, created_at")
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;

      // Get all user roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Combine users with their roles
      const usersWithRoles = usersData.map((user) => ({
        ...user,
        roles: rolesData?.filter((r) => r.user_id === user.id).map((r) => r.role) || [],
      }));

      setUsers(usersWithRoles);
      setFilteredUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminRole = async (userId: string, currentRoles: string[]) => {
    if (!currentUser?.roles.includes("super_admin" as any)) {
      toast.error("Only super admins can manage admin roles");
      return;
    }

    const isAdmin = currentRoles.includes("admin");

    try {
      if (isAdmin) {
        // Remove admin role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");

        if (error) throw error;

        // Log admin action (will be typed after Supabase types refresh)
        await (supabase as any).from("admin_audit").insert({
          admin_id: currentUser.id,
          action: "remove_admin_role",
          target_user_id: userId,
          details: { previous_roles: currentRoles },
        });

        toast.success("Admin role removed");
      } else {
        // Add admin role
        const { error } = await supabase.from("user_roles").insert({
          user_id: userId,
          role: "admin",
        });

        if (error) throw error;

        // Log admin action (will be typed after Supabase types refresh)
        await (supabase as any).from("admin_audit").insert({
          admin_id: currentUser.id,
          action: "grant_admin_role",
          target_user_id: userId,
          details: { new_roles: [...currentRoles, "admin"] },
        });

        toast.success("Admin role granted");
      }

      // Reload users
      await loadUsers();
    } catch (error: any) {
      console.error("Error toggling admin role:", error);
      toast.error(error.message || "Failed to update role");
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-destructive text-destructive-foreground";
      case "admin":
        return "bg-accent text-accent-foreground";
      case "driver":
        return "bg-success text-success-foreground";
      case "rider":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted";
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
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-accent bg-clip-text text-transparent">
              User Management
            </h1>
          </div>
            <Badge variant="outline" className="gap-2">
              <Shield className="w-4 h-4" />
              {currentUser?.roles.includes("super_admin" as any) ? "Super Admin" : "Admin"}
            </Badge>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Search Bar */}
        <Card className="p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Users Table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Joined</TableHead>
                {currentUser?.roles.includes("super_admin" as any) && (
                  <TableHead className="text-right">Admin Access</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-accent flex items-center justify-center text-white font-bold">
                          {user.full_name?.charAt(0) || user.email?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground">{user.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge key={role} className={getRoleBadgeColor(role)}>
                            {role.replace("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    {currentUser?.roles.includes("super_admin") && (
                      <TableCell className="text-right">
                        {!user.roles.includes("super_admin" as any) && (
                          <div className="flex items-center justify-end gap-2">
                            <Label
                              htmlFor={`admin-${user.id}`}
                              className="text-sm cursor-pointer"
                            >
                              {user.roles.includes("admin") ? "Revoke" : "Grant"}
                            </Label>
                            <Switch
                              id={`admin-${user.id}`}
                              checked={user.roles.includes("admin")}
                              onCheckedChange={() => toggleAdminRole(user.id, user.roles)}
                            />
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mt-6">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-2xl font-bold">{users.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Super Admins</p>
            <p className="text-2xl font-bold">
              {users.filter((u) => u.roles.includes("super_admin" as any)).length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Admins</p>
            <p className="text-2xl font-bold">
              {users.filter((u) => u.roles.includes("admin")).length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Drivers</p>
            <p className="text-2xl font-bold">
              {users.filter((u) => u.roles.includes("driver")).length}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
