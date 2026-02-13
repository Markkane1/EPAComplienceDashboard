import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PublicLayout } from "@/ui/components/layout/PublicLayout";
import { StatusBadge } from "@/ui/components/applications/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";
import { Button } from "@/ui/components/ui/button";
import { Skeleton } from "@/ui/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/components/ui/select";
import { useAuth } from "@/ui/hooks/useAuth";
import type { Application } from "@repo/shared";
import type { ApplicationStatus } from "@repo/shared";
import { applicationUseCases } from "@/ui/app/container";

const STATUS_OPTIONS: ApplicationStatus[] = [
  "submitted",
  "complete",
  "incomplete",
  "hearing_scheduled",
  "under_hearing",
  "approved_resolved",
  "rejected_closed",
];

const MyApplications = () => {
  const { hasRole } = useAuth();
  const isApplicant = hasRole("applicant");
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("10");

  const pageSizeValue = Number(pageSize) || 10;

  const { data: applicationsResponse, isLoading } = useQuery({
    queryKey: ["my-applications", statusFilter, page, pageSizeValue],
    enabled: isApplicant,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      params.set("page", String(page));
      params.set("limit", String(pageSizeValue));
      return applicationUseCases.list(params);
    },
  });

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const applications = Array.isArray(applicationsResponse)
    ? applicationsResponse
    : applicationsResponse?.items || [];
  const totalItems = Array.isArray(applicationsResponse)
    ? applicationsResponse.length
    : applicationsResponse?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSizeValue));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const hasRows = applications.length > 0;
  const summary = useMemo(() => {
    if (!totalItems) return "No applications found.";
    const start = (currentPage - 1) * pageSizeValue + 1;
    const end = Math.min(currentPage * pageSizeValue, totalItems);
    return `Showing ${start}-${end} of ${totalItems}`;
  }, [currentPage, pageSizeValue, totalItems]);

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-emerald-700">My Applications</h1>
            <p className="text-sm text-muted-foreground">
              View the status of your submitted applications and update incomplete ones.
            </p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isApplicant && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Please sign in as an applicant to view your applications.
            </CardContent>
          </Card>
        )}

        {isApplicant && (
          <Card>
            <CardHeader>
              <CardTitle>Applications</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !hasRows ? (
                <p className="text-center text-muted-foreground py-6">No applications found.</p>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tracking ID</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Updated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {applications.map((app: Application) => (
                          <TableRow key={app.id}>
                            <TableCell className="font-mono font-medium">{app.tracking_id}</TableCell>
                            <TableCell>{app.application_type}</TableCell>
                            <TableCell>
                              <StatusBadge status={app.status} />
                            </TableCell>
                            <TableCell>
                              {app.updated_at ? new Date(app.updated_at).toLocaleDateString() : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {app.status === "incomplete" ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/?edit=${app.id}`)}
                                >
                                  Update
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm text-muted-foreground">{summary}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={pageSize} onValueChange={setPageSize}>
                        <SelectTrigger className="w-28">
                          <SelectValue placeholder="Page size" />
                        </SelectTrigger>
                        <SelectContent>
                          {["10", "20", "50"].map((size) => (
                            <SelectItem key={size} value={size}>
                              {size} / page
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage <= 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm">
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={currentPage >= totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PublicLayout>
  );
};

export default MyApplications;



