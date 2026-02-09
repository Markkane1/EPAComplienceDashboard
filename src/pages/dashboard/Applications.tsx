import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiRequest } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatusBadge } from "@/components/applications/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Search, Eye, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Application, ApplicationDocument } from "@/types/models";
import { ApplicationStatus } from "@/types/application-status";
import { useAuth } from "@/hooks/useAuth";

type RegistrarDisposalReportRow = {
  closed_at: string | null;
  application_id: string;
  application_number: string;
  unit_name: string | null;
  district: string | null;
  final_status: ApplicationStatus;
  hearing_officer_id: string | null;
  hearing_officer_name: string | null;
};
type ApplicationDescription = {
  cnic?: string;
  actions?: string[];
  unit_id?: string;
  district?: string;
  designation?: string;
  epa_action_date?: string;
};
type ApplicationRemark = {
  id: string;
  remark: string;
  proceedings: string | null;
  remark_type: string;
  status_at_time: ApplicationStatus;
  created_at: string | null;
};

const STATUS_OPTIONS: ApplicationStatus[] = [
  "submitted",
  "complete",
  "incomplete",
  "hearing_scheduled",
  "under_hearing",
  "approved_resolved",
  "rejected_closed",
];

const CLOSED_STATUSES: ApplicationStatus[] = ["approved_resolved", "rejected_closed"];

const parseDescription = (description: Application["description"]) => {
  if (!description) return null;
  if (typeof description === "string") {
    try {
      return JSON.parse(description) as ApplicationDescription;
    } catch {
      return null;
    }
  }
  if (typeof description === "object") {
    return description as ApplicationDescription;
  }
  return null;
};

const formatDescriptionDate = (value?: string) => {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "PP");
};

const Applications = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("10");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<ApplicationDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [incompleteRemark, setIncompleteRemark] = useState("");
  const [isIncompleteDialogOpen, setIsIncompleteDialogOpen] = useState(false);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportStatusGroup, setReportStatusGroup] = useState("disposed");
  const [reportDistrictId, setReportDistrictId] = useState("");
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();

  const pageSizeValue = Number(pageSize) || 10;
  const { data: applicationsResponse, isLoading } = useQuery({
    queryKey: ["applications", search, statusFilter, page, pageSizeValue],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const trimmedSearch = search.trim();
      if (trimmedSearch) {
        params.set("search", trimmedSearch);
      }
      params.set("page", String(page));
      params.set("limit", String(pageSizeValue));

      const queryString = params.toString();
      return apiGet(`/api/applications${queryString ? `?${queryString}` : ""}`);
    },
  });

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const applications = Array.isArray(applicationsResponse)
    ? applicationsResponse
    : applicationsResponse?.items || [];
  const totalItems = Array.isArray(applicationsResponse)
    ? applicationsResponse.length
    : applicationsResponse?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSizeValue));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSizeValue;
  const pageItems = applications || [];

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const markIncompleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedApp) return;
      await apiPost(`/api/applications/${selectedApp.id}/mark-incomplete`, {
        remarks: incompleteRemark.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Application marked incomplete. Notification queued.");
      setIsIncompleteDialogOpen(false);
      setIncompleteRemark("");
    },
    onError: (error: unknown) => {
      console.error("Mark incomplete error:", error);
      toast.error("Failed to mark application incomplete. Please try again.");
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedApp) return;
      await apiPost(`/api/applications/${selectedApp.id}/mark-complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Application marked complete.");
    },
    onError: (error: unknown) => {
      console.error("Mark complete error:", error);
      toast.error("Failed to mark application complete. Please try again.");
    },
  });

  const canViewReports = hasRole("registrar") || hasRole("admin");

  const {
    data: reportRows,
    isLoading: isReportLoading,
    error: reportError,
  } = useQuery({
    queryKey: ["registrar-disposal-report", reportFrom, reportTo, reportStatusGroup, reportDistrictId],
    enabled: canViewReports && !!reportFrom && !!reportTo,
    queryFn: async () => {
      const params = new URLSearchParams({
        from: reportFrom,
        to: reportTo,
        status_group: reportStatusGroup,
      });
      if (reportDistrictId.trim()) {
        params.set("district_id", reportDistrictId.trim());
      }
      return apiGet(`/api/reports/registrar-disposal?${params.toString()}`);
    },
  });

  const parsedDescription = selectedApp ? parseDescription(selectedApp.description) : null;
  const isClosed = selectedApp ? CLOSED_STATUSES.includes(selectedApp.status) : false;
  const { data: remarks, isLoading: isRemarksLoading } = useQuery({
    queryKey: ["application-remarks", selectedApp?.id],
    enabled: !!selectedApp && isClosed,
    queryFn: async () => {
      return apiGet(`/api/applications/${selectedApp?.id}/remarks`);
    },
  });
  const actionItems = (() => {
    const actions = parsedDescription?.actions;
    if (Array.isArray(actions)) return actions;
    if (actions) return [String(actions)];
    return [];
  })();

  const handleDownload = useCallback(async (doc: ApplicationDocument) => {
    try {
      const blob = await apiRequest(`/api/documents/${doc.id}/download`, { method: "GET" });
      const blobUrl = URL.createObjectURL(blob as Blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = doc.file_name || "attachment";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download document error:", error);
      toast.error("Unable to download attachment. Please try again.");
    }
  }, []);

  useEffect(() => {
    if (!selectedApp) {
      setSelectedDocs([]);
      return;
    }

    let isMounted = true;
    setDocsLoading(true);

    const loadDocuments = async () => {
      try {
        const data = await apiGet(`/api/applications/${selectedApp.id}/documents`);
        if (!isMounted) return;
        setSelectedDocs(data || []);
      } catch (error) {
        console.error("Load documents error:", error);
        if (!isMounted) return;
        setSelectedDocs([]);
      } finally {
        if (isMounted) {
          setDocsLoading(false);
        }
      }
    };

    loadDocuments();

    return () => {
      isMounted = false;
    };
  }, [selectedApp]);

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Applications</h1>

        <Tabs defaultValue="list">
          <TabsList>
            <TabsTrigger value="list">Applications</TabsTrigger>
            {canViewReports && <TabsTrigger value="reports">Reports</TabsTrigger>}
          </TabsList>
          <TabsContent value="list">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                  <CardTitle>All Applications</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by ID, name, or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 w-64"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : totalItems === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No applications found
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tracking ID</TableHead>
                          <TableHead>Applicant</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageItems.map((app) => (
                          <TableRow key={app.id}>
                            <TableCell className="font-mono font-medium">
                              {app.tracking_id}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{app.applicant_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {app.applicant_email}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>{app.application_type}</TableCell>
                            <TableCell>
                              <StatusBadge status={app.status} />
                            </TableCell>
                            <TableCell>
                              {format(new Date(app.created_at), "PP")}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedApp(app);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Review
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Showing {pageStart + 1}-{Math.min(pageStart + pageSizeValue, totalItems)} of {totalItems}
                      </p>
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
          </TabsContent>
          {canViewReports && (
            <TabsContent value="reports">
              <Card>
                <CardHeader>
                  <CardTitle>Reports</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <label className="text-sm font-medium">Date From</label>
                      <Input
                        type="date"
                        value={reportFrom}
                        onChange={(e) => setReportFrom(e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Date To</label>
                      <Input
                        type="date"
                        value={reportTo}
                        onChange={(e) => setReportTo(e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Status Group</label>
                      <Select value={reportStatusGroup} onValueChange={setReportStatusGroup}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select status group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="disposed">Disposed</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">District ID (optional)</label>
                      <Input
                        value={reportDistrictId}
                        onChange={(e) => setReportDistrictId(e.target.value)}
                        placeholder="UUID"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  {reportError && (
                    <p className="text-sm text-destructive">
                      Unable to load report. Please check filters and try again.
                    </p>
                  )}
                  {isReportLoading ? (
                    <div className="space-y-3">
                      {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : reportRows?.length ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Closed Date</TableHead>
                            <TableHead>Application Number</TableHead>
                            <TableHead>Unit Name</TableHead>
                            <TableHead>District</TableHead>
                            <TableHead>Final Status</TableHead>
                            <TableHead>Hearing Officer</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportRows.map((row: RegistrarDisposalReportRow) => (
                            <TableRow key={row.application_id}>
                              <TableCell>
                                {row.closed_at ? format(new Date(row.closed_at), "PP") : "—"}
                              </TableCell>
                              <TableCell className="font-mono font-medium">
                                {row.application_number}
                              </TableCell>
                              <TableCell>{row.unit_name || "—"}</TableCell>
                              <TableCell>{row.district || "—"}</TableCell>
                              <TableCell>
                                <StatusBadge status={row.final_status} />
                              </TableCell>
                              <TableCell>{row.hearing_officer_name || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {reportFrom && reportTo ? "No applications found." : "Select a date range to run the report."}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
          <DialogContent className="w-full max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Application</DialogTitle>
              <DialogDescription>
                {selectedApp?.tracking_id} - {selectedApp?.application_type}
              </DialogDescription>
            </DialogHeader>

            {selectedApp && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Applicant</p>
                    <p className="font-medium">{selectedApp.applicant_name}</p>
                    <p className="text-sm text-muted-foreground">Email:</p>
                    <p className="text-medium">{selectedApp.applicant_email}</p>
                    <p className="text-sm text-muted-foreground">Phone:</p>
                    <p className="text-medium">{selectedApp.applicant_phone || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Company</p>
                    <p className="font-medium">{selectedApp.company_name || "N/A"}</p>
                    <p className="text-sm text-muted-foreground">Address:</p>
                    <p className="text-medium">{selectedApp.company_address || "N/A"}</p>
                  </div>
                </div>

                {selectedApp.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Description</p>
                    {parsedDescription ? (
                      <div className="mt-2 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">CNIC</p>
                          <p className="text-sm">{parsedDescription.cnic || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Designation</p>
                          <p className="text-sm">{parsedDescription.designation || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Unit ID</p>
                          <p className="text-sm">{parsedDescription.unit_id || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">District</p>
                          <p className="text-sm">{parsedDescription.district || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">EPA Action Date</p>
                          <p className="text-sm">
                            {formatDescriptionDate(parsedDescription.epa_action_date)}
                          </p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-xs font-medium text-muted-foreground">Actions</p>
                          {actionItems.length ? (
                            <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
                              {actionItems.map((action, index) => (
                                <li key={`${action}-${index}`}>{action}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm">N/A</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1">{selectedApp.description}</p>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Attachments</p>
                  {docsLoading ? (
                    <p className="mt-1 text-sm text-muted-foreground">Loading attachments...</p>
                  ) : selectedDocs.length ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {selectedDocs.map((doc) => (
                        <Button
                          key={doc.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="justify-start"
                          onClick={() => handleDownload(doc)}
                        >
                          {doc.file_name}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">No attachments uploaded.</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-muted-foreground">Current Status:</p>
                  <StatusBadge status={selectedApp.status} />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  {selectedApp && isClosed && (
                    <div className="rounded-md border border-muted bg-muted/30 px-3 py-2 text-sm">
                      This application is closed and read-only.
                    </div>
                  )}
                  {isClosed && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">View All Remarks</p>
                      {isRemarksLoading ? (
                        <p className="text-sm text-muted-foreground">Loading remarks...</p>
                      ) : remarks?.length ? (
                        <div className="space-y-2">
                          {remarks.map((remark: ApplicationRemark) => (
                            <div key={remark.id} className="rounded-md border p-3 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium capitalize">
                                  {remark.remark_type.replace("_", " ")}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {remark.created_at
                                    ? format(new Date(remark.created_at), "PP p")
                                    : "N/A"}
                                </span>
                              </div>
                              <p className="mt-2 text-sm">{remark.remark}</p>
                              {remark.proceedings && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Proceedings: {remark.proceedings}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No remarks available.</p>
                      )}
                    </div>
                  )}
                  {(hasRole("registrar") || hasRole("admin")) && selectedApp.status === "submitted" && (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => markCompleteMutation.mutate()}
                        disabled={markCompleteMutation.isPending}
                      >
                        {markCompleteMutation.isPending && (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Mark Complete
                      </Button>
                      <Dialog open={isIncompleteDialogOpen} onOpenChange={setIsIncompleteDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline">Mark Incomplete</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Mark Application Incomplete</DialogTitle>
                            <DialogDescription>
                              Provide remarks (minimum 10 characters) to notify the applicant.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <Textarea
                              value={incompleteRemark}
                              onChange={(e) => setIncompleteRemark(e.target.value)}
                              placeholder="Add remarks for the applicant..."
                              rows={4}
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => setIsIncompleteDialogOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => markIncompleteMutation.mutate()}
                                disabled={incompleteRemark.trim().length < 10 || markIncompleteMutation.isPending}
                              >
                                {markIncompleteMutation.isPending && (
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                )}
                                Mark Incomplete
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => setSelectedApp(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Applications;
