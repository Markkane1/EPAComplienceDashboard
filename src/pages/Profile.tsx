import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiDelete, apiPost, apiPut } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const Profile = () => {
  const { user, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [designation, setDesignation] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [cnic, setCnic] = useState("");
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const fullNameParts = (user?.full_name || "").split(" ").filter(Boolean);
    setFirstName(user?.first_name || fullNameParts[0] || "");
    setLastName(user?.last_name || fullNameParts.slice(1).join(" ") || "");
    setDesignation(user?.designation || "");
    setContactNumber(user?.contact_number || "");
    setEmail(user?.email || "");
    setCnic(user?.cnic || "");
  }, [user]);

  const initials = useMemo(() => {
    const source = user?.full_name || user?.email || "";
    return source
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [user]);

  const normalizeContact = (value: string) => value.replace(/[\s-]/g, "");
  const isValidPkContact = (value: string) => {
    if (!value.trim()) return true;
    const normalized = normalizeContact(value);
    return /^(\+92|0)3\d{9}$/.test(normalized);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!isValidPkContact(contactNumber)) {
        throw new Error("Contact number must be a valid Pakistani mobile number.");
      }
      return apiPut("/api/auth/profile", {
        first_name: firstName,
        last_name: lastName,
        designation,
        contact_number: normalizeContact(contactNumber),
        email,
      });
    },
    onSuccess: async () => {
      toast.success("Profile updated.");
      await refreshUser();
    },
    onError: (error: unknown) => {
      console.error("Profile update error:", error);
      toast.error("Failed to update profile.");
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      return apiPost("/api/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
    },
    onSuccess: () => {
      toast.success("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (error: unknown) => {
      console.error("Password update error:", error);
      toast.error("Failed to update password.");
    },
  });

  const uploadProfileImageMutation = useMutation({
    mutationFn: async () => {
      if (!profileImageFile) {
        throw new Error("Profile image is required.");
      }
      const payload = new FormData();
      payload.append("profile_image", profileImageFile);
      return apiPost("/api/auth/profile-picture", payload);
    },
    onSuccess: async () => {
      toast.success("Profile picture updated.");
      setProfileImageFile(null);
      await refreshUser();
    },
    onError: (error: unknown) => {
      console.error("Profile image update error:", error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message)
            : "Failed to update profile picture.";
      toast.error(message);
    },
  });

  const removeProfileImageMutation = useMutation({
    mutationFn: async () => {
      return apiDelete("/api/auth/profile-picture");
    },
    onSuccess: async () => {
      toast.success("Profile picture removed.");
      await refreshUser();
    },
    onError: (error: unknown) => {
      console.error("Profile image remove error:", error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message)
            : "Failed to remove profile picture.";
      toast.error(message);
    },
  });

  const profileImageUrl =
    user?.profile_image_url ||
    (user?.profile_image_path
      ? `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/${String(user.profile_image_path).replace(/^\/+/, "")}`
      : null);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt="Profile"
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  initials || "U"
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Signed in as</p>
                <p className="font-medium">{user?.email}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profileImage">Profile Picture</Label>
                <Input
                  id="profileImage"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => uploadProfileImageMutation.mutate()}
                    disabled={!profileImageFile || uploadProfileImageMutation.isPending}
                  >
                    Upload Photo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeProfileImageMutation.mutate()}
                    disabled={!profileImageUrl || removeProfileImageMutation.isPending}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactNumber">Contact Number</Label>
                <Input
                  id="contactNumber"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                />
                {!isValidPkContact(contactNumber) ? (
                  <p className="text-xs text-destructive">
                    Use Pakistani format: 03XXXXXXXXX or +92XXXXXXXXXX
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnic">CNIC</Label>
                <Input
                  id="cnic"
                  value={cnic}
                  disabled
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => updateProfileMutation.mutate()}
                disabled={updateProfileMutation.isPending || !isValidPkContact(contactNumber)}
              >
                Save Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => changePasswordMutation.mutate()}
                disabled={
                  !currentPassword || !newPassword || changePasswordMutation.isPending
                }
              >
                Update Password
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
