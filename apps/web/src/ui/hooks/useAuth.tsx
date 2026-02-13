import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authUseCases } from "@/ui/app/container";

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
  signIn: (email: string, password: string) => Promise<{ error: Error | null; user: AuthUser | null }>;
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
    if (!authUseCases.getToken()) {
      setUser(null);
      setRoles([]);
      return;
    }
    try {
      const data = await authUseCases.getMe();
      if (data?.user) {
        setUser(data.user as AuthUser);
        setRoles((data.user.roles as AppRole[]) || []);
      } else {
        setUser(null);
        setRoles([]);
      }
    } catch (error) {
      console.warn("Auth session error:", error);
      authUseCases.setToken(null);
      setUser(null);
      setRoles([]);
    }
  };

  useEffect(() => {
    const loadSession = async () => {
      if (!authUseCases.getToken()) {
        setLoading(false);
        return;
      }
      await refreshUser();
      setLoading(false);
    };

    loadSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await authUseCases.login({ email, password });
      authUseCases.setToken((data as { token?: string }).token ?? null);
      setUser(data.user as AuthUser);
      setRoles((data.user.roles as AppRole[]) || []);
      return { error: null, user: data.user as AuthUser };
    } catch (error) {
      authUseCases.setToken(null);
      setUser(null);
      setRoles([]);
      return { error: error as Error, user: null };
    }
  };

  const signOut = async () => {
    authUseCases.setToken(null);
    setRoles([]);
    setUser(null);
  };

  const hasRole = (role: AppRole) => roles.includes("super_admin") || roles.includes(role);

  return (
    <AuthContext.Provider value={{ user, roles, loading, signIn, signOut, refreshUser, hasRole }}>
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



