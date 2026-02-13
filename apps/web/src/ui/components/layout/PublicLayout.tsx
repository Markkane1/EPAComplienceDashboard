import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FileText, Search, LogIn, User } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { useAuth } from "@/ui/hooks/useAuth";

interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasRole, signOut } = useAuth();
  const currentYear = new Date().getFullYear();
  const isApplicant = hasRole("applicant");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">EPA Portal</h1>
              <p className="text-xs text-muted-foreground">Compliance Applications</p>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            <Button
              variant={location.pathname === "/" ? "default" : "ghost"}
              size="sm"
              asChild
            >
              <Link to="/">
                <FileText className="h-4 w-4 mr-2" />
                Apply
              </Link>
            </Button>
            <Button
              variant={location.pathname === "/track" ? "default" : "ghost"}
              size="sm"
              asChild
            >
              <Link to="/track">
                <Search className="h-4 w-4 mr-2" />
                Track
              </Link>
            </Button>
            {user && isApplicant ? (
              <>
                <Button
                  variant={location.pathname === "/my-applications" ? "default" : "ghost"}
                  size="sm"
                  asChild
                >
                  <Link to="/my-applications">
                    <FileText className="h-4 w-4 mr-2" />
                    My Applications
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={location.pathname === "/applicant-login" ? "default" : "ghost"}
                  size="sm"
                  asChild
                >
                  <Link to="/applicant-login">
                    <User className="h-4 w-4 mr-2" />
                    Applicant Access
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/login">
                    <LogIn className="h-4 w-4 mr-2" />
                    Staff Login
                  </Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-card py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {currentYear} Environmental Protection Agency. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}



