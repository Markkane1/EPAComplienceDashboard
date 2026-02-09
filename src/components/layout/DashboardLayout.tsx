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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { apiGet, apiPost } from "@/lib/api";
import type { NotificationItem, NotificationsResponse } from "@/types/notifications";

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

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoadingNotifications(true);
    try {
      const data = (await apiGet("/api/notifications?limit=8")) as NotificationsResponse;
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
      await apiPost(`/api/notifications/${notification.id}/read`, {});
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
      await apiPost("/api/notifications/read-all", {});
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

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-sidebar-background border-r flex flex-col">
        <div className="p-4 border-b">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground">EPA Portal</h1>
              <p className="text-xs text-muted-foreground">Staff Dashboard</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.path}
              variant={location.pathname === item.path ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link to={item.path}>
                <item.icon className="h-4 w-4 mr-2" />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>

        <div className="p-4 border-t">
          <p className="text-xs text-muted-foreground mb-2 truncate">{user?.email}</p>
          <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="border-b bg-card px-6 py-3 flex items-center justify-end gap-4">
          <DropdownMenu onOpenChange={(open) => open && loadNotifications()}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96">
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
          <Link to="/profile" className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{user?.full_name || "User"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
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
        {children}
      </main>
    </div>
  );
}
