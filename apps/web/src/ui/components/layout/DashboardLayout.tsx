import { ReactNode, useEffect, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FileText,
  LayoutDashboard,
  Users,
  LogOut,
  Calendar,
  FolderTree,
  BarChart3,
  AlertTriangle,
  Bell,
  ClipboardList,
  Menu,
} from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { Avatar, AvatarFallback } from "@/ui/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/ui/components/ui/sheet";
import { useAuth } from "@/ui/hooks/useAuth";
import type { NotificationItem, NotificationsResponse } from "@repo/shared";
import { notificationUseCases } from "@/ui/app/container";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, hasRole } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setMobileNavOpen(false);
    navigate("/login");
  };

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoadingNotifications(true);
    try {
      const data = (await notificationUseCases.list(8)) as NotificationsResponse;
      setNotifications(data.items || []);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.warn("Unable to load notifications.", error);
    } finally {
      setLoadingNotifications(false);
    }
  }, [user]);

  const markNotificationRead = async (notification: NotificationItem) => {
    if (notification.is_read) return;
    try {
      await notificationUseCases.markRead(notification.id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.warn("Unable to mark notification read.", error);
    }
  };

  const markAllRead = async () => {
    try {
      await notificationUseCases.markAllRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.warn("Unable to mark all notifications read.", error);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/dashboard/applications", label: "Applications", icon: FileText },
    { path: "/dashboard/hearings", label: "Hearings", icon: Calendar },
  ];

  if (hasRole("admin") || hasRole("super_admin")) {
    navItems.push({ path: "/dashboard/users", label: "Users", icon: Users });
    navItems.push({ path: "/dashboard/categories", label: "Categories", icon: FolderTree });
    navItems.push({ path: "/dashboard/audit-logs", label: "Audit Logs", icon: ClipboardList });
  }
  if (hasRole("registrar") || hasRole("admin") || hasRole("super_admin")) {
    navItems.push({ path: "/dashboard/reports", label: "Reports", icon: BarChart3 });
    navItems.push({ path: "/dashboard/violations", label: "Violations", icon: AlertTriangle });
  }

  const isNavActive = (path: string) => {
    if (path === "/dashboard") return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const navButtons = (onNavigate?: () => void) =>
    navItems.map((item) => (
      <Button
        key={item.path}
        variant={isNavActive(item.path) ? "secondary" : "ghost"}
        className="w-full justify-start"
        asChild
      >
        <Link to={item.path} onClick={onNavigate}>
          <item.icon className="mr-2 h-4 w-4" />
          {item.label}
        </Link>
      </Button>
    ));

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r bg-sidebar-background lg:flex">
          <div className="border-b p-4">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <FileText className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-sidebar-foreground">EPA Portal</h1>
                <p className="text-xs text-muted-foreground">Staff Dashboard</p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 space-y-1 p-4">{navButtons()}</nav>

          <div className="border-t p-4">
            <p className="mb-2 truncate text-xs text-muted-foreground">{user?.email}</p>
            <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b bg-card px-3 py-3 sm:px-4 md:px-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 lg:hidden">
                <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Open dashboard menu">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
                    <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
                    <div className="border-b p-4">
                      <Link
                        to="/dashboard"
                        className="flex items-center gap-2"
                        onClick={() => setMobileNavOpen(false)}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                          <FileText className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div className="min-w-0">
                          <h1 className="truncate text-lg font-bold text-sidebar-foreground">EPA Portal</h1>
                          <p className="text-xs text-muted-foreground">Staff Dashboard</p>
                        </div>
                      </Link>
                    </div>
                    <nav className="space-y-1 p-4">{navButtons(() => setMobileNavOpen(false))}</nav>
                    <div className="border-t p-4">
                      <p className="mb-2 truncate text-xs text-muted-foreground">{user?.email}</p>
                      <Button variant="outline" className="w-full justify-start" onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>

                <Link to="/dashboard" className="text-sm font-semibold text-foreground">
                  EPA Portal
                </Link>
              </div>

              <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
                <DropdownMenu onOpenChange={(open) => open && loadNotifications()}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1rem))]">
                    <div className="flex items-center justify-between px-3 py-2">
                      <p className="text-sm font-medium">Notifications</p>
                      <Button variant="ghost" size="sm" onClick={markAllRead} disabled={!unreadCount}>
                        Mark all read
                      </Button>
                    </div>
                    <DropdownMenuSeparator />
                    {loadingNotifications && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
                    )}
                    {!loadingNotifications && notifications.length === 0 && (
                      <div className="px-3 py-3 text-sm text-muted-foreground">No notifications.</div>
                    )}
                    {!loadingNotifications &&
                      notifications.map((notification) => (
                        <DropdownMenuItem
                          key={notification.id}
                          onSelect={() => {
                            markNotificationRead(notification);
                            if (notification.link) {
                              navigate(notification.link);
                            }
                          }}
                          className={`flex flex-col items-start gap-1 py-2 ${
                            notification.is_read ? "opacity-70" : ""
                          }`}
                        >
                          <span className="text-sm font-medium">{notification.title}</span>
                          <span className="text-xs text-muted-foreground">{notification.message}</span>
                          {notification.created_at && (
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(notification.created_at).toLocaleString()}
                            </span>
                          )}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Link to="/profile" className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <div className="hidden min-w-0 text-right sm:block">
                    <p className="truncate text-sm font-medium text-foreground">{user?.full_name || "User"}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>
                      {(user?.full_name || user?.email || "U")
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </div>
            </div>
          </div>

          <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </div>
  );
}
