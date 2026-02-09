import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiGet, apiPost, setToken, getToken } from "@/lib/api";

type AppRole = "admin" | "registrar" | "hearing_officer" | "super_admin" | "applicant";

type AuthUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  designation?: string | null;
  contact_number?: string | null;
  profile_image_path?: string | null;
  profile_image_url?: string | null;
  roles: AppRole[];
  cnic?: string | null;
  district?: string | null;
};

interface AuthContextType {
  user: AuthUser | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (cnic: string, password: string) => Promise<{ error: Error | null; user: AuthUser | null }>;
  signInApplicant: (cnic: string, password: string) => Promise<{ error: Error | null; user: AuthUser | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    if (!getToken()) {
      setUser(null);
      setRoles([]);
      return;
    }
    try {
      const data = await apiGet("/api/auth/me");
      if (data?.user) {
        setUser(data.user as AuthUser);
        setRoles((data.user.roles as AppRole[]) || []);
      } else {
        setUser(null);
        setRoles([]);
      }
    } catch (error) {
      console.warn("Auth session error:", error);
      setToken(null);
      setUser(null);
      setRoles([]);
    }
  };

  useEffect(() => {
    const loadSession = async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      await refreshUser();
      setLoading(false);
    };

    loadSession();
  }, []);

  const signIn = async (cnic: string, password: string) => {
    try {
      const data = await apiPost("/api/auth/login", { cnic, password });
      setToken(data.token);
      setUser(data.user as AuthUser);
      setRoles((data.user.roles as AppRole[]) || []);
      return { error: null, user: data.user as AuthUser };
    } catch (error) {
      setToken(null);
      setUser(null);
      setRoles([]);
      return { error: error as Error, user: null };
    }
  };

  const signInApplicant = async (cnic: string, password: string) => {
    try {
      const data = await apiPost("/api/auth/applicant-login", { cnic, password });
      setToken(data.token);
      setUser(data.user as AuthUser);
      setRoles((data.user.roles as AppRole[]) || []);
      return { error: null, user: data.user as AuthUser };
    } catch (error) {
      setToken(null);
      setUser(null);
      setRoles([]);
      return { error: error as Error, user: null };
    }
  };

  const signOut = async () => {
    setToken(null);
    setRoles([]);
    setUser(null);
  };

  const hasRole = (role: AppRole) => roles.includes("super_admin") || roles.includes(role);

  return (
    <AuthContext.Provider value={{ user, roles, loading, signIn, signInApplicant, signOut, refreshUser, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
