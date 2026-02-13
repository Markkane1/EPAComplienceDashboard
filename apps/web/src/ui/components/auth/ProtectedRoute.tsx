import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/ui/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    if (location.pathname.startsWith("/my-applications")) {
      return <Navigate to="/applicant-login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  const roles = user.roles || [];
  const isApplicantOnly =
    roles.includes("applicant") &&
    !roles.includes("admin") &&
    !roles.includes("super_admin") &&
    !roles.includes("registrar") &&
    !roles.includes("hearing_officer");

  if (isApplicantOnly && location.pathname.startsWith("/dashboard")) {
    return <Navigate to="/my-applications" replace />;
  }

  return <>{children}</>;
}



