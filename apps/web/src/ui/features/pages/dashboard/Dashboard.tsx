import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/ui/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";
import { FileText, Clock, CheckCircle, AlertCircle, Calendar } from "lucide-react";
import { Skeleton } from "@/ui/components/ui/skeleton";
import { applicationUseCases } from "@/ui/app/container";

const Dashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      return applicationUseCases.getStats();
    },
  });

  const { data: recentApplications, isLoading: isLoadingRecent } = useQuery({
    queryKey: ["recent-applications"],
    queryFn: async () => {
      return applicationUseCases.list("limit=5");
    },
  });

  const statCards = [
    { label: "Total Applications", value: stats?.total ?? 0, icon: FileText, color: "text-primary" },
    { label: "Pending Review", value: stats?.submitted ?? 0, icon: Clock, color: "text-warning" },
    { label: "Hearing Scheduled", value: stats?.hearing_scheduled ?? 0, icon: Calendar, color: "text-primary" },
    { label: "Approved & Resolved", value: stats?.approved ?? 0, icon: CheckCircle, color: "text-accent" },
    { label: "Incomplete", value: stats?.incomplete ?? 0, icon: AlertCircle, color: "text-destructive" },
  ];

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stat.value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Applications</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingRecent ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentApplications?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No applications yet
              </p>
            ) : (
              <div className="space-y-4">
                {recentApplications?.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{app.tracking_id}</p>
                      <p className="text-sm text-muted-foreground">{app.applicant_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium capitalize">
                        {app.status.replace("_", " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {app.application_type}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;



