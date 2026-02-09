import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/applications/StatusBadge";
import { ApplicationStatus } from "@/types/application-status";
import { useAuth } from "@/hooks/useAuth";
import { apiGet, apiPost, apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { FileText } from "lucide-react";

const CLOSED_STATUSES: ApplicationStatus[] = ["approved_resolved", "rejected_closed"];
type Application = {
  id: string;
  tracking_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone?: string | null;
  company_name?: string | null;
  company_address?: string | null;
  application_type: string;
  description?: unknown | null;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
};

type ApplicationDocument = {
  id: string;
  file_name: string;
  file_path: string;
};

type ApplicationRemark = {
  id: string;
  remark: string;
  proceedings: string | null;
  remark_type: string;
  status_at_time: ApplicationStatus;
  created_at: string | null;
};

type HearingHistory = {
  id: string;
  hearing_date: string;
  hearing_type: string;
  is_active: boolean;
  sequence_no: number;
  hearing_order_document?: { id: string; file_name: string } | null;
};

type ApplicationDescription = {
  cnic?: string;
  actions?: string[];
  unit_id?: string;
  district?: string;
  designation?: string;
  epa_action_date?: string;
  industry_category?: string;
  industry_subcategory?: string;
  violation_type?: string;
  sub_violation?: string;
};

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

const ApplicationDetails = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [adjournDateTime, setAdjournDateTime] = useState("");
  const [adjournRemarks, setAdjournRemarks] = useState("");
  const [adjournProceedings, setAdjournProceedings] = useState("");
  const [adjournOrderFile, setAdjournOrderFile] = useState<File | null>(null);
  const [approveRemarks, setApproveRemarks] = useState("");
  const [approveProceedings, setApproveProceedings] = useState("");
  const [approveOrderFile, setApproveOrderFile] = useState<File | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [rejectProceedings, setRejectProceedings] = useState("");
  const [rejectOrderFile, setRejectOrderFile] = useState<File | null>(null);
  const [isAdjournOpen, setIsAdjournOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  const { data: application, isLoading } = useQuery<Application>({
    queryKey: ["application-details", id],
    enabled: !!id,
    queryFn: async () => apiGet(`/api/applications/${id}`),
  });

  const { data: documents, isLoading: docsLoading } = useQuery<ApplicationDocument[]>({
    queryKey: ["application-documents", id],
    enabled: !!id,
    queryFn: async () => apiGet(`/api/applications/${id}/documents`),
  });

  const { data: remarks, isLoading: remarksLoading } = useQuery<ApplicationRemark[]>({
    queryKey: ["application-remarks", id],
    enabled: !!id,
    queryFn: async () => apiGet(`/api/applications/${id}/remarks`),
  });

  const { data: hearings, isLoading: hearingsLoading } = useQuery<HearingHistory[]>({
    queryKey: ["application-hearings", id],
    enabled: !!id,
    queryFn: async () => apiGet(`/api/applications/${id}/hearings`),
  });

  const parsedDescription = useMemo(
    () => (application ? parseDescription(application.description) : null),
    [application]
  );

  const isClosed = application ? CLOSED_STATUSES.includes(application.status) : false;
  const canAct = hasRole("hearing_officer") || hasRole("super_admin");

  const handleDownload = async (doc: ApplicationDocument) => {
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
  };

  const handleHearingOrderDownload = async (doc: { id: string; file_name: string }) => {
    try {
      const blob = await apiRequest(`/api/documents/${doc.id}/download`, { method: "GET" });
      const blobUrl = URL.createObjectURL(blob as Blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = doc.file_name || "hearing-order.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download hearing order error:", error);
      toast.error("Unable to download hearing order. Please try again.");
    }
  };

  const adjournMutation = useMutation({
    mutationFn: async () => {
      if (!adjournOrderFile) {
        throw new Error("Hearing order PDF is required.");
      }
      const payload = new FormData();
      payload.append("hearing_order", adjournOrderFile);
      payload.append("remarks", adjournRemarks.trim());
      payload.append("new_hearing_datetime", adjournDateTime);
      if (adjournProceedings.trim()) {
        payload.append("proceedings", adjournProceedings.trim());
      }
      if (parsedDescription?.violation_type) {
        payload.append("violation_type", parsedDescription.violation_type);
      }
      if (parsedDescription?.sub_violation) {
        payload.append("sub_violation", parsedDescription.sub_violation);
      }
      return apiPost(`/api/applications/${id}/adjourn`, payload);
    },
    onSuccess: () => {
      toast.success("Hearing adjourned and rescheduled.");
      setIsAdjournOpen(false);
      setAdjournDateTime("");
      setAdjournRemarks("");
      setAdjournProceedings("");
      setAdjournOrderFile(null);
      queryClient.invalidateQueries({ queryKey: ["application-details", id] });
      queryClient.invalidateQueries({ queryKey: ["application-remarks", id] });
      queryClient.invalidateQueries({ queryKey: ["application-hearings", id] });
    },
    onError: (error: unknown) => {
      console.error("Adjourn hearing error:", error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message)
            : "Failed to adjourn hearing.";
      toast.error(message);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!approveOrderFile) {
        throw new Error("Hearing order PDF is required.");
      }
      const payload = new FormData();
      payload.append("hearing_order", approveOrderFile);
      payload.append("remarks", approveRemarks.trim());
      if (approveProceedings.trim()) {
        payload.append("proceedings", approveProceedings.trim());
      }
      if (parsedDescription?.violation_type) {
        payload.append("violation_type", parsedDescription.violation_type);
      }
      if (parsedDescription?.sub_violation) {
        payload.append("sub_violation", parsedDescription.sub_violation);
      }
      return apiPost(`/api/applications/${id}/approve`, payload);
    },
    onSuccess: () => {
      toast.success("Application approved and resolved.");
      setIsApproveOpen(false);
      setApproveRemarks("");
      setApproveProceedings("");
      setApproveOrderFile(null);
      queryClient.invalidateQueries({ queryKey: ["application-details", id] });
      queryClient.invalidateQueries({ queryKey: ["application-remarks", id] });
    },
    onError: (error: unknown) => {
      console.error("Approve application error:", error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message)
            : "Failed to approve application.";
      toast.error(message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectOrderFile) {
        throw new Error("Hearing order PDF is required.");
      }
      const payload = new FormData();
      payload.append("hearing_order", rejectOrderFile);
      payload.append("remarks", rejectRemarks.trim());
      if (rejectProceedings.trim()) {
        payload.append("proceedings", rejectProceedings.trim());
      }
      if (parsedDescription?.violation_type) {
        payload.append("violation_type", parsedDescription.violation_type);
      }
      if (parsedDescription?.sub_violation) {
        payload.append("sub_violation", parsedDescription.sub_violation);
      }
      return apiPost(`/api/applications/${id}/reject`, payload);
    },
    onSuccess: () => {
      toast.success("Application rejected and closed.");
      setIsRejectOpen(false);
      setRejectRemarks("");
      setRejectProceedings("");
      setRejectOrderFile(null);
      queryClient.invalidateQueries({ queryKey: ["application-details", id] });
      queryClient.invalidateQueries({ queryKey: ["application-remarks", id] });
    },
    onError: (error: unknown) => {
      console.error("Reject application error:", error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message)
            : "Failed to reject application.";
      toast.error(message);
    },
  });

  const isAdjournDateValid = () => {
    if (!adjournDateTime) return false;
    const selected = new Date(adjournDateTime);
    return selected.getTime() > Date.now();
  };

  if (isLoading || !application) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <Skeleton className="h-10 w-64 mb-6" />
          <Skeleton className="h-32 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Application Details</h1>
            <p className="text-sm text-muted-foreground">{application.tracking_id}</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/dashboard/hearings">Back to Hearings</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {application.application_type}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">Current Status:</p>
              <StatusBadge status={application.status} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Type of Violation</p>
                <p className="text-sm text-muted-foreground">
                  {parsedDescription?.violation_type || "Not set"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Sub-Violation</p>
                <p className="text-sm text-muted-foreground">
                  {parsedDescription?.sub_violation || "Not set"}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Applicant</p>
                <p className="font-medium">{application.applicant_name}</p>
                <p className="text-sm text-muted-foreground">Email: {application.applicant_email || "N/A"}</p>
                <p className="text-sm text-muted-foreground">Phone: {application.applicant_phone || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Company</p>
                <p className="font-medium">{application.company_name || "N/A"}</p>
                <p className="text-sm text-muted-foreground">Address: {application.company_address || "N/A"}</p>
              </div>
            </div>

            {parsedDescription && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Details</p>
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
                      {parsedDescription.epa_action_date
                        ? format(new Date(parsedDescription.epa_action_date), "PP")
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Industry Category</p>
                    <p className="text-sm">{parsedDescription.industry_category || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Industry Subcategory</p>
                    <p className="text-sm">{parsedDescription.industry_subcategory || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Violation Type</p>
                    <p className="text-sm">{parsedDescription.violation_type || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Sub-Violation</p>
                    <p className="text-sm">{parsedDescription.sub_violation || "N/A"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-medium text-muted-foreground">Actions</p>
                    {parsedDescription.actions?.length ? (
                      <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
                        {parsedDescription.actions.map((action, index) => (
                          <li key={`${action}-${index}`}>{action}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm">N/A</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-muted-foreground">Attachments</p>
              {docsLoading ? (
                <p className="mt-1 text-sm text-muted-foreground">Loading attachments...</p>
              ) : documents?.length ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {documents.map((doc) => (
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hearing History</CardTitle>
          </CardHeader>
          <CardContent>
            {hearingsLoading ? (
              <p className="text-sm text-muted-foreground">Loading hearings...</p>
            ) : hearings?.length ? (
              <div className="space-y-2">
                {hearings.map((hearing) => (
                  <div key={hearing.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium capitalize">
                        Hearing #{hearing.sequence_no} · {hearing.hearing_type} hearing
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(hearing.hearing_date), "PP p")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {hearing.is_active ? "Active" : "Completed"}
                    </p>
                    {hearing.hearing_order_document ? (
                      <div className="mt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleHearingOrderDownload(hearing.hearing_order_document)}
                        >
                          {hearing.hearing_order_document.file_name || "Hearing Order (PDF)"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hearings scheduled.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Remarks & Proceedings</CardTitle>
          </CardHeader>
          <CardContent>
            {remarksLoading ? (
              <p className="text-sm text-muted-foreground">Loading remarks...</p>
            ) : remarks?.length ? (
              <div className="space-y-2">
                {remarks.map((remark) => (
                  <div key={remark.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium capitalize">
                        {remark.remark_type.replace("_", " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {remark.created_at ? format(new Date(remark.created_at), "PP p") : "N/A"}
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
              <p className="text-sm text-muted-foreground">No remarks yet.</p>
            )}
          </CardContent>
        </Card>

        {isClosed && (
          <div className="rounded-md border border-muted bg-muted/30 px-3 py-2 text-sm">
            This application is closed and read-only.
          </div>
        )}

        {canAct && !isClosed && (
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setIsAdjournOpen(true)}>
                Adjourn / Grant Extension
              </Button>
              <Button onClick={() => setIsApproveOpen(true)}>Approve / Resolve</Button>
              <Button variant="destructive" onClick={() => setIsRejectOpen(true)}>
                Reject & Close
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={isAdjournOpen}
        onOpenChange={(open) => {
          setIsAdjournOpen(open);
          if (!open) {
            setAdjournOrderFile(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjourn / Grant Extension</DialogTitle>
            <DialogDescription>
              Provide remarks and select a new hearing date and time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium">New Date & Time</label>
              <Input
                type="datetime-local"
                value={adjournDateTime}
                onChange={(e) => setAdjournDateTime(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Remarks</label>
              <Textarea
                value={adjournRemarks}
                onChange={(e) => setAdjournRemarks(e.target.value)}
                placeholder="Add remarks for adjournment..."
                rows={4}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Hearing Proceedings</label>
              <Textarea
                value={adjournProceedings}
                onChange={(e) => setAdjournProceedings(e.target.value)}
                placeholder="Add hearing proceedings..."
                rows={4}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Hearing Order (PDF)</label>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setAdjournOrderFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Required</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAdjournOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => adjournMutation.mutate()}
                disabled={
                  adjournRemarks.trim().length < 10 ||
                  !isAdjournDateValid() ||
                  !adjournOrderFile ||
                  adjournMutation.isPending
                }
              >
                {adjournMutation.isPending && <span className="mr-2">...</span>}
                Adjourn Hearing
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isApproveOpen}
        onOpenChange={(open) => {
          setIsApproveOpen(open);
          if (!open) {
            setApproveOrderFile(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve / Resolve</DialogTitle>
            <DialogDescription>
              Confirm approval and provide final remarks (minimum 10 characters).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium">Final Remarks</label>
              <Textarea
                value={approveRemarks}
                onChange={(e) => setApproveRemarks(e.target.value)}
                placeholder="Add final decision remarks..."
                rows={4}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Hearing Proceedings</label>
              <Textarea
                value={approveProceedings}
                onChange={(e) => setApproveProceedings(e.target.value)}
                placeholder="Add hearing proceedings..."
                rows={4}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Hearing Order (PDF)</label>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setApproveOrderFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Required</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsApproveOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => approveMutation.mutate()}
                disabled={
                  approveRemarks.trim().length < 10 ||
                  !approveOrderFile ||
                  approveMutation.isPending
                }
              >
                {approveMutation.isPending && <span className="mr-2">...</span>}
                Approve / Resolve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRejectOpen}
        onOpenChange={(open) => {
          setIsRejectOpen(open);
          if (!open) {
            setRejectOrderFile(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject & Close</DialogTitle>
            <DialogDescription>
              Provide final remarks (minimum 10 characters) to close the application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium">Rejection Remarks</label>
              <Textarea
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                placeholder="Add rejection remarks..."
                rows={4}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Hearing Proceedings</label>
              <Textarea
                value={rejectProceedings}
                onChange={(e) => setRejectProceedings(e.target.value)}
                placeholder="Add hearing proceedings..."
                rows={4}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Hearing Order (PDF)</label>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setRejectOrderFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Required</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => rejectMutation.mutate()}
                disabled={
                  rejectRemarks.trim().length < 10 ||
                  !rejectOrderFile ||
                  rejectMutation.isPending
                }
              >
                {rejectMutation.isPending && <span className="mr-2">...</span>}
                Reject & Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ApplicationDetails;
