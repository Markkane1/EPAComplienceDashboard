import type { ApiClient } from "@/application/ports/ApiClient";
import type { ManagedUser } from "@repo/shared";

export type { ManagedUser };

export type CreateUserInput = {
  email?: string | null;
  cnic: string;
  password: string;
  fullName: string | null;
  role: string;
  district?: string | null;
};

export type UpdateUserInput = {
  profileId: string;
  fullName: string | null;
  role: string;
  district?: string | null;
  cnic: string;
};

export const createUserUseCases = (api: ApiClient) => ({
  list: () => api.get("/api/users"),
  create: (input: CreateUserInput) =>
    api.post("/api/users", {
      email: input.email ?? null,
      cnic: input.cnic,
      password: input.password,
      full_name: input.fullName,
      role: input.role,
      district: input.district ?? null,
    }),
  update: (input: UpdateUserInput) =>
    api.put(`/api/users/${input.profileId}`, {
      full_name: input.fullName,
      role: input.role,
      district: input.district ?? null,
      cnic: input.cnic,
    }),
  remove: async (profileId: string) => {
    const result = await api.delete(`/api/users/${profileId}`);
    return (result as { success?: boolean } | null)?.success ?? false;
  },
  resetPassword: (profileId: string, newPassword: string) =>
    api.post(`/api/users/${profileId}/reset-password`, {
      new_password: newPassword,
    }),
  listHearingOfficers: () => api.get("/api/users/hearing-officers"),
});
