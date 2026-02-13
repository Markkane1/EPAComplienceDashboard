import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/ui/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";
import { Badge } from "@/ui/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/components/ui/table";
import { Skeleton } from "@/ui/components/ui/skeleton";
import { Users as UsersIcon } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/ui/hooks/useAuth";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { toast } from "sonner";
import { userUseCases } from "@/ui/app/container";

const DISTRICTS = [
  "Bahawalpur",
  "Bahawalnagar",
  "Rahim Yar Khan",
  "Dera Ghazi Khan",
  "Muzaffargarh",
  "Rajanpur",
  "Layyah",
  "Faisalabad",
  "Chiniot",
  "Jhang",
  "Toba Tek Singh",
  "Gujranwala",
  "Narowal",
  "Sialkot",
  "Gujrat",
  "Mandi Bahauddin",
  "Hafizabad",
  "Wazirabad",
  "Lahore",
  "Kasur",
  "Nankana Sahib",
  "Sheikhupura",
  "Multan",
  "Khanewal",
  "Lodhran",
  "Vehari",
  "Rawalpindi",
  "Attock",
  "Chakwal",
  "Jhelum",
  "Mianwali",
  "Sahiwal",
  "Okara",
  "Pakpattan",
  "Sargodha",
  "Bhakkar",
  "Khushab",
];

const Users = () => {
  const { hasRole } = useAuth();
  const canManageUsers = hasRole("admin") || hasRole("super_admin");
  const queryClient = useQueryClient();
  const isSuperAdmin = hasRole("super_admin");
  const roleOptions = isSuperAdmin
    ? ["applicant", "registrar", "hearing_officer", "admin", "super_admin"]
    : ["applicant", "registrar", "hearing_officer", "admin"];
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    profile_id: string;
    full_name: string | null;
    email: string | null;
    cnic: string | null;
    role: string | null;
    created_at: string;
    district?: string | null;
  } | null>(null);
  const [createForm, setCreateForm] = useState({
    email: "",
    cnic: "",
    password: "",
    fullName: "",
    role: roleOptions[0],
    district: "",
  });
  const [editForm, setEditForm] = useState({
    fullName: "",
    role: roleOptions[0],
    district: "",
    cnic: "",
  });
  const [resetPassword, setResetPassword] = useState("");

  const {
    data: users,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["users-with-roles"],
    enabled: canManageUsers,
    queryFn: async () => {
      return userUseCases.list();
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      if (!createForm.cnic.trim() || !createForm.password.trim()) {
        throw new Error("CNIC and password are required.");
      }
      return userUseCases.create({
        email: createForm.email.trim() || null,
        cnic: createForm.cnic.trim(),
        password: createForm.password,
        fullName: createForm.fullName.trim() || null,
        role: createForm.role,
        district: createForm.district.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("User created.");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setIsCreateOpen(false);
      setCreateForm({
        email: "",
        cnic: "",
        password: "",
        fullName: "",
        role: roleOptions[0],
        district: "",
      });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message)
            : "Failed to create user.";
      toast.error(message);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) return null;
      if (!editForm.cnic.trim()) {
        throw new Error("CNIC is required.");
      }
      return userUseCases.update({
        profileId: selectedUser.profile_id,
        fullName: editForm.fullName.trim() || null,
        role: editForm.role,
        district: editForm.district.trim() || null,
        cnic: editForm.cnic.trim(),
      });
    },
    onSuccess: () => {
      toast.success("User updated.");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setIsEditOpen(false);
      setSelectedUser(null);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message)
            : "Failed to update user.";
      toast.error(message);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) return null;
      return userUseCases.remove(selectedUser.profile_id);
    },
    onSuccess: () => {
      toast.success("User deleted.");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setIsDeleteOpen(false);
      setSelectedUser(null);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message)
            : "Failed to delete user.";
      if (message.toLowerCase().includes("super_admin")) {
        toast.error("Cannot delete the last super admin.");
        return;
      }
      toast.error(message);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) return null;
      if (!resetPassword.trim()) {
        throw new Error("New password is required.");
      }
      return userUseCases.resetPassword(selectedUser.profile_id, resetPassword);
    },
    onSuccess: () => {
      toast.success("Password reset.");
      setIsResetOpen(false);
      setResetPassword("");
      setSelectedUser(null);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message)
            : "Failed to reset password.";
      toast.error(message);
    },
  });

  const getRoleBadgeVariant = (role: string): React.ComponentProps<typeof Badge>["variant"] => {
    switch (role) {
      case "super_admin":
        return "destructive";
      case "admin":
        return "destructive";
      case "registrar":
        return "default";
      case "hearing_officer":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Users</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              Staff Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!canManageUsers ? (
              <p className="text-center text-muted-foreground py-8">
                You do not have permission to view users.
              </p>
            ) : isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="text-center text-muted-foreground py-8">
                Unable to load users. Please try again.
              </p>
            ) : users?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No users found
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>CNIC</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user) => (
                      <TableRow key={user.profile_id}>
                        <TableCell className="font-medium">
                          {user.full_name || "—"}
                        </TableCell>
                        <TableCell>{user.email || "N/A"}</TableCell>
                        <TableCell>{user.cnic || "N/A"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {user.roles?.length > 0 ? (
                              user.roles.map((role: string) => (
                                <Badge
                                  key={role}
                                  variant={getRoleBadgeVariant(role)}
                                >
                                  {role.replace("_", " ")}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground">No roles</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(user.created_at), "PP")}
                        </TableCell>
                        <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(user);
                              setEditForm({
                                fullName: user.full_name || "",
                                role: user.role || roleOptions[0],
                                district: user.district || "",
                                cnic: user.cnic || "",
                              });
                              setIsEditOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(user);
                              setResetPassword("");
                              setIsResetOpen(true);
                            }}
                          >
                            Reset Password
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsDeleteOpen(true);
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-4">
          <Button
            onClick={() => setIsCreateOpen(true)}
            disabled={!canManageUsers}
          >
            Create User
          </Button>
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              Provide details to create a new user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email (optional)</label>
              <Input
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                }
                type="email"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">CNIC</label>
              <Input
                value={createForm.cnic}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, cnic: e.target.value }))
                }
                placeholder="XXXXX-XXXXXXX-X"
                required
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <Input
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, password: e.target.value }))
                }
                type="password"
                required
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Full Name</label>
              <Input
                value={createForm.fullName}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, fullName: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <Select
                value={createForm.role}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">District (for hearing officers)</label>
              <Select
                value={createForm.district}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({ ...prev, district: value }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="- Select -" />
                </SelectTrigger>
                <SelectContent>
                  {DISTRICTS.map((district) => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createUserMutation.mutate()}
                disabled={createUserMutation.isPending}
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details and role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Full Name</label>
              <Input
                value={editForm.fullName}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, fullName: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">CNIC</label>
              <Input
                value={editForm.cnic}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, cnic: e.target.value }))
                }
                placeholder="XXXXX-XXXXXXX-X"
                required
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <Select
                value={editForm.role}
                onValueChange={(value) =>
                  setEditForm((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">District (for hearing officers)</label>
              <Select
                value={editForm.district}
                onValueChange={(value) =>
                  setEditForm((prev) => ({ ...prev, district: value }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="- Select -" />
                </SelectTrigger>
                <SelectContent>
                  {DISTRICTS.map((district) => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => updateUserMutation.mutate()}
                disabled={updateUserMutation.isPending}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Are you sure you want to delete this
              user?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteUserMutation.mutate()}
              disabled={deleteUserMutation.isPending}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for this user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsResetOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => resetPasswordMutation.mutate()}
                disabled={resetPasswordMutation.isPending}
              >
                Reset
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Users;



