import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";

export type ManagedUser = {
  profile_id: string;
  full_name: string | null;
  email: string | null;
  cnic: string | null;
  role: string | null;
  district?: string | null;
  created_at: string;
};

export async function getAllUsers() {
  return apiGet("/api/users");
}

export async function createUser(input: {
  email?: string | null;
  cnic: string;
  password: string;
  fullName: string | null;
  role: string;
  district?: string | null;
}) {
  return apiPost("/api/users", {
    email: input.email ?? null,
    cnic: input.cnic,
    password: input.password,
    full_name: input.fullName,
    role: input.role,
    district: input.district ?? null,
  });
}

export async function updateUser(input: {
  profileId: string;
  fullName: string | null;
  role: string;
  district?: string | null;
  cnic: string;
}) {
  return apiPut(`/api/users/${input.profileId}`, {
    full_name: input.fullName,
    role: input.role,
    district: input.district ?? null,
    cnic: input.cnic,
  });
}

export async function deleteUser(profileId: string) {
  const result = await apiDelete(`/api/users/${profileId}`);
  return result?.success ?? false;
}
