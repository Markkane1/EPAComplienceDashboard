import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
import { Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Calendar, Plus, RefreshCw, Eye, AlertTriangle } from "lucide-react";
import { addDays, format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { ApplicationStatus } from "@/types/application-status";
import { Application, HearingDate } from "@/types/models";

type HearingRow = HearingDate;

type HearingReportRow = {
  hearing_id: string;
  application_id: string;
  application_number: string | null;
  applicant_display_name: string | null;
  unit_name: string | null;
  category: string | null;
  unit_id: string | null;
  district: string | null;
  contact: string | null;
  submission_date: string | null;
  hearing_officer_id: string | null;
  hearing_officer_name: string | null;
};

type ViolationType = {
  id: string;
  name: string;
  subviolations: Array<{ id: string; name: string }>;
};

type HearingOfficerOption = {
  id: string;
  full_name: string | null;
  email: string | null;
  district: string | null;
};

const Hearings = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [hearingDate, setHearingDate] = useState("");
  const [hearingType, setHearingType] = useState("initial");
  const [selectedOfficerId, setSelectedOfficerId] = useState("");
  const [isViolationDialogOpen, setIsViolationDialogOpen] = useState(false);
  const [selectedViolationAppId, setSelectedViolationAppId] = useState("");
  const [violationType, setViolationType] = useState("");
  const [subViolation, setSubViolation] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const today = new Date();
  const [reportFrom, setReportFrom] = useState(format(today, "yyyy-MM-dd"));
  const [reportTo, setReportTo] = useState(format(addDays(today, 1), "yyyy-MM-dd"));
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin") || hasRole("super_admin");
  const isRegistrar = hasRole("registrar");
  const isHearingOfficer = hasRole("hearing_officer");
  const canViewReports = isHearingOfficer || isAdmin;
  const canViewActions =
    isHearingOfficer || isAdmin || isRegistrar;
  const canSchedule = isRegistrar || isHearingOfficer || isAdmin;

  const CLOSED_STATUSES: ApplicationStatus[] = ["approved_resolved", "rejected_closed"];

  const { data: hearings, isLoading } = useQuery<HearingRow[]>({
    queryKey: ["hearings"],
    queryFn: async () => {
      return apiGet("/api/hearings");
    },
  });
  const hearingSequenceByApp = useMemo(() => {
    const map = new Map<string, number>();
    (hearings || []).forEach((hearing) => {
      const appId = hearing.application_id;
      const current = map.get(appId) || 0;
      const next = hearing.sequence_no || 0;
      if (next > current) map.set(appId, next);
    });
    return map;
  }, [hearings]);
  const { data: violations } = useQuery<ViolationType[]>({
    queryKey: ["violation-types"],
    queryFn: async () => apiGet("/api/violations"),
  });

  const { data: applications } = useQuery<Application[]>({
    queryKey: ["applications-for-hearing"],
    queryFn: async () => {
      return apiGet("/api/applications?status_in=complete,hearing_scheduled,under_hearing");
    },
  });

  const { data: reportRows, isLoading: isReportLoading } = useQuery<HearingReportRow[]>({
    queryKey: ["hearing-report", reportFrom, reportTo],
    enabled: canViewReports,
    queryFn: async () => {
      const params = new URLSearchParams({ from: reportFrom, to: reportTo });
      return apiGet(`/api/hearings/report?${params.toString()}`);
    },
  });
  const { data: hearingOfficers } = useQuery<HearingOfficerOption[]>({
    queryKey: ["hearing-officers"],
    enabled: isRegistrar || isAdmin,
    queryFn: async () => apiGet("/api/users/hearing-officers"),
  });

  const scheduleHearingMutation = useMutation({
    mutationFn: async () => {
      const selected = applications?.find((app) => app.id === selectedApplicationId);
      if (selected && CLOSED_STATUSES.includes(selected.status as ApplicationStatus)) {
        throw new Error("Closed applications cannot be scheduled.");
      }
      const existingSequence = hearingSequenceByApp.get(selectedApplicationId) || 0;
      const isFirstHearing = existingSequence === 0;
      if (!isAdmin) {
        if (isFirstHearing && !isRegistrar) {
          throw new Error("Only the registrar can schedule the first hearing.");
        }
        if (!isFirstHearing && !isHearingOfficer) {
          throw new Error("Only a hearing officer can schedule subsequent hearings.");
        }
      }
      if (isFirstHearing && selected?.status !== "complete") {
        throw new Error("Application must be marked complete before the first hearing.");
      }
      if (isFirstHearing && !selectedOfficerId) {
        throw new Error("Please select a hearing officer for the first hearing.");
      }
      await apiPost(`/api/applications/${selectedApplicationId}/schedule`, {
        hearing_datetime: hearingDate,
        hearing_type: isFirstHearing ? "initial" : hearingType,
        ...(isFirstHearing ? { hearing_officer_id: selectedOfficerId } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hearings"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Hearing scheduled successfully");
      setIsDialogOpen(false);
      setSelectedApplicationId("");
      setHearingDate("");
      setHearingType("initial");
      setSelectedOfficerId("");
    },
    onError: (error: unknown) => {
      console.error("Schedule hearing error:", error);
      toast.error("Failed to schedule hearing. Please try again.");
    },
  });

  const selectedForSchedule = applications?.find((app) => app.id === selectedApplicationId);
  const selectedSequence = hearingSequenceByApp.get(selectedApplicationId) || 0;
  const isFirstSchedule = selectedSequence === 0;
  const roleAllowsSchedule =
    isAdmin || (isRegistrar && isFirstSchedule) || (isHearingOfficer && !isFirstSchedule);
  const scheduleDateValid = () => {
    if (!hearingDate) return false;
    const parsed = new Date(hearingDate);
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now();
  };

  const scheduleDisabled =
    !selectedApplicationId ||
    !hearingDate ||
    scheduleHearingMutation.isPending ||
    !scheduleDateValid() ||
    !roleAllowsSchedule ||
    (isFirstSchedule ? !selectedOfficerId : false) ||
    (isFirstSchedule ? selectedForSchedule?.status !== "complete" : false) ||
    (selectedForSchedule?.status
      ? CLOSED_STATUSES.includes(selectedForSchedule.status as ApplicationStatus)
      : false);

  const setViolationMutation = useMutation({
    mutationFn: async () => {
      return apiPost(`/api/applications/${selectedViolationAppId}/violation`, {
        violation_type: violationType || null,
        sub_violation: subViolation || null,
      });
    },
    onSuccess: () => {
      toast.success("Violation type updated.");
      setIsViolationDialogOpen(false);
      setSelectedViolationAppId("");
      setViolationType("");
      setSubViolation("");
    },
    onError: (error: unknown) => {
      console.error("Set violation error:", error);
      toast.error("Failed to update violation type.");
    },
  });

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Hearings</h1>
          {canSchedule && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Hearing
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule New Hearing</DialogTitle>
                  <DialogDescription>
                    Registrar can schedule the first hearing only. Hearing officers can schedule subsequent hearings.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium">Application</label>
                    <Select
                      value={selectedApplicationId}
                      onValueChange={(value) => {
                        setSelectedApplicationId(value);
                        setSelectedOfficerId("");
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select application" />
                      </SelectTrigger>
                      <SelectContent>
                        {applications?.map((app) => {
                          const isClosed = CLOSED_STATUSES.includes(app.status as ApplicationStatus);
                          const sequence = hearingSequenceByApp.get(app.id) || 0;
                          const hasHearings = sequence > 0;
                          const roleBlocked =
                            !isAdmin &&
                            ((isRegistrar && hasHearings) || (isHearingOfficer && !hasHearings));
                          const needsComplete = isRegistrar && !hasHearings && app.status !== "complete";
                          const disabled = isClosed || roleBlocked || needsComplete;
                          return (
                            <SelectItem key={app.id} value={app.id} disabled={disabled}>
                              {app.tracking_id} - {app.applicant_name}
                              {isClosed ? " (Closed)" : ""}
                              {!isClosed && hasHearings ? ` (Hearing #${sequence} scheduled)` : ""}
                              {!isClosed && !hasHearings ? " (First hearing)" : ""}
                              {!isClosed && needsComplete ? " (Not complete)" : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Hearing Type</label>
                    <Select
                      value={isFirstSchedule ? "initial" : hearingType}
                      onValueChange={setHearingType}
                      disabled={isFirstSchedule}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="initial">Initial Hearing</SelectItem>
                        <SelectItem value="follow-up">Follow-up Hearing</SelectItem>
                        <SelectItem value="final">Final Hearing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {isFirstSchedule && (
                    <div>
                      <label className="text-sm font-medium">Hearing Officer</label>
                      <Select
                        value={selectedOfficerId}
                        onValueChange={setSelectedOfficerId}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select hearing officer" />
                        </SelectTrigger>
                        <SelectContent>
                          {(hearingOfficers || []).map((officer) => (
                            <SelectItem key={officer.id} value={officer.id}>
                              {officer.full_name || officer.email || officer.id}
                              {officer.district ? ` (${officer.district})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium">Date & Time</label>
                    <Input
                      type="datetime-local"
                      value={hearingDate}
                      onChange={(e) => setHearingDate(e.target.value)}
                      className="mt-1"
                    />
                    {!scheduleDateValid() && hearingDate ? (
                      <p className="text-xs text-destructive mt-1">
                        Hearing date must be in the future.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => scheduleHearingMutation.mutate()}
                      disabled={scheduleDisabled}
                    >
                      {scheduleHearingMutation.isPending && (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Schedule
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Scheduled Hearings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : hearings?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hearings scheduled
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application</TableHead>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Hearing #</TableHead>
                <TableHead>Hearing Type</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Status</TableHead>
                {canViewActions && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {hearings?.map((hearing) => (
                <TableRow key={hearing.id} className={hearing.is_active ? "bg-muted/40" : ""}>
                  <TableCell className="font-mono font-medium">
                    {hearing.applications?.tracking_id}
                  </TableCell>
                  <TableCell>
                    {hearing.applications?.applicant_name}
                  </TableCell>
                  <TableCell>
                    {hearing.applications?.application_type}
                  </TableCell>
                  <TableCell className="font-medium">
                    Hearing #{hearing.sequence_no}
                  </TableCell>
                  <TableCell className="capitalize">
                    {hearing.hearing_type}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(hearing.hearing_date), "PPP 'at' p")}
                  </TableCell>
                  <TableCell>
                    {hearing.is_active ? "Active" : "Completed"}
                  </TableCell>
                  {canViewActions && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          asChild
                        >
                          <Link to={`/dashboard/applications/${hearing.application_id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {hasRole("hearing_officer") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => {
                              setSelectedViolationAppId(hearing.application_id);
                              setViolationType("");
                              setSubViolation("");
                              setIsViolationDialogOpen(true);
                            }}
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
        </Card>

        {canViewReports && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextDay = addDays(new Date(), 1);
                    const nextDayLabel = format(nextDay, "yyyy-MM-dd");
                    setReportFrom(nextDayLabel);
                    setReportTo(nextDayLabel);
                  }}
                >
                  Next Day
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReportFrom(format(new Date(), "yyyy-MM-dd"));
                    setReportTo(format(addDays(new Date(), 7), "yyyy-MM-dd"));
                  }}
                >
                  Next Week
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isDownloading}
                  onClick={async () => {
                    setIsDownloading(true);
                    try {
                      if (!reportFrom || !reportTo) {
                        toast.error("Please select Date From and Date To.");
                        return;
                      }
                      const params = new URLSearchParams({
                        from: reportFrom,
                        to: reportTo,
                      });
                      const result = await apiGet(`/api/hearings/report/pdf?${params.toString()}`);
                      const blob =
                        result instanceof Blob
                          ? result
                          : new Blob([result], { type: "application/pdf" });
                      if (!blob.size) {
                        throw new Error("Empty PDF response.");
                      }
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `cause-list-${reportFrom}.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                    } catch (error) {
                      console.error("PDF download failed:", error);
                      toast.error("Failed to download PDF.");
                    } finally {
                      setIsDownloading(false);
                    }
                  }}
                >
                  {isDownloading ? "Preparing..." : "Download PDF"}
                </Button>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="text-sm font-medium">Date From</label>
                    <Input
                      type="date"
                      value={reportFrom}
                      onChange={(e) => setReportFrom(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Date To</label>
                    <Input
                      type="date"
                      value={reportTo}
                      onChange={(e) => setReportTo(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
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
                        <TableHead>Application ID</TableHead>
                        <TableHead>Applicant Name</TableHead>
                        <TableHead>Unit Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Unit ID</TableHead>
                        <TableHead>District</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Submission Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportRows.map((row: HearingReportRow) => (
                        <TableRow key={row.hearing_id}>
                          <TableCell className="font-mono font-medium">
                            {row.application_number || "N/A"}
                          </TableCell>
                          <TableCell>{row.applicant_display_name || "N/A"}</TableCell>
                          <TableCell>{row.unit_name || "N/A"}</TableCell>
                          <TableCell>{row.category || "N/A"}</TableCell>
                          <TableCell>{row.unit_id || "N/A"}</TableCell>
                          <TableCell>{row.district || "N/A"}</TableCell>
                          <TableCell>{row.contact || "N/A"}</TableCell>
                          <TableCell>
                            {row.submission_date
                              ? format(new Date(row.submission_date), "PPP 'at' p")
                              : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hearings found.</p>
              )}
            </CardContent>
          </Card>
        )}
        <Dialog open={isViolationDialogOpen} onOpenChange={setIsViolationDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Violation Type</DialogTitle>
              <DialogDescription>Select violation and sub-violation for this application.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium">Type of Violation</label>
                <Select
                  value={violationType}
                  onValueChange={(value) => {
                    setViolationType(value);
                    setSubViolation("");
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="- Select -" />
                  </SelectTrigger>
                  <SelectContent>
                    {(violations || []).map((item) => (
                      <SelectItem key={item.id} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Sub-Violation</label>
                <Select
                  value={subViolation}
                  onValueChange={setSubViolation}
                  disabled={!violationType}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="- Select -" />
                  </SelectTrigger>
                  <SelectContent>
                    {(violations || [])
                      .find((item) => item.name === violationType)
                      ?.subviolations.map((sub) => (
                        <SelectItem key={sub.id} value={sub.name}>
                          {sub.name}
                        </SelectItem>
                      )) || []}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsViolationDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => setViolationMutation.mutate()}
                  disabled={!violationType || setViolationMutation.isPending}
                >
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Hearings;
