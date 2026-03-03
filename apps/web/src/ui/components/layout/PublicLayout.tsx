import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FileText, Search, LogIn, User, Menu } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/ui/components/ui/sheet";
import { useAuth } from "@/ui/hooks/useAuth";

interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasRole, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const isApplicant = hasRole("applicant");

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary sm:h-10 sm:w-10">
              <FileText className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-foreground sm:text-xl">EPA Portal</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">Compliance Applications</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            <Button variant={isActive("/") ? "default" : "ghost"} size="sm" asChild>
              <Link to="/">
                <FileText className="mr-2 h-4 w-4" />
                Apply
              </Link>
            </Button>
            <Button variant={isActive("/track") ? "default" : "ghost"} size="sm" asChild>
              <Link to="/track">
                <Search className="mr-2 h-4 w-4" />
                Track
              </Link>
            </Button>
            {user && isApplicant ? (
              <>
                <Button variant={isActive("/my-applications") ? "default" : "ghost"} size="sm" asChild>
                  <Link to="/my-applications">
                    <FileText className="mr-2 h-4 w-4" />
                    My Applications
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button variant={isActive("/applicant-login") ? "default" : "ghost"} size="sm" asChild>
                  <Link to="/applicant-login">
                    <User className="mr-2 h-4 w-4" />
                    Applicant Access
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/login">
                    <LogIn className="mr-2 h-4 w-4" />
                    Staff Login
                  </Link>
                </Button>
              </>
            )}
          </nav>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm">
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
              <div className="mt-6 flex flex-col gap-2">
                <Button variant={isActive("/") ? "default" : "ghost"} className="w-full justify-start" asChild>
                  <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                    <FileText className="mr-2 h-4 w-4" />
                    Apply
                  </Link>
                </Button>
                <Button variant={isActive("/track") ? "default" : "ghost"} className="w-full justify-start" asChild>
                  <Link to="/track" onClick={() => setMobileMenuOpen(false)}>
                    <Search className="mr-2 h-4 w-4" />
                    Track
                  </Link>
                </Button>
                {user && isApplicant ? (
                  <>
                    <Button
                      variant={isActive("/my-applications") ? "default" : "ghost"}
                      className="w-full justify-start"
                      asChild
                    >
                      <Link to="/my-applications" onClick={() => setMobileMenuOpen(false)}>
                        <FileText className="mr-2 h-4 w-4" />
                        My Applications
                      </Link>
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={handleSignOut}>
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant={isActive("/applicant-login") ? "default" : "ghost"}
                      className="w-full justify-start"
                      asChild
                    >
                      <Link to="/applicant-login" onClick={() => setMobileMenuOpen(false)}>
                        <User className="mr-2 h-4 w-4" />
                        Applicant Access
                      </Link>
                    </Button>
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                        <LogIn className="mr-2 h-4 w-4" />
                        Staff Login
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-card py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>(c) {currentYear} Environmental Protection Agency. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
