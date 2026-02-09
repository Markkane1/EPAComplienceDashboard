import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiRequest } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

type HearingOfficerApplicationRow = {
  application_id: string | null;
  applicant_display_name: string | null;
  unit_name: string | null;
  category: string | null;
  unit_id: string | null;
  district: string | null;
  contact: string | null;
  submission_date: string | null;
};

type HearingOfficerReportSection = {
  hearing_officer_id: string | null;
  hearing_officer_name: string | null;
  totals: { total: number; pending: number; approved: number; rejected: number };
  applications: HearingOfficerApplicationRow[];
};

const Reports = () => {
  const { hasRole } = useAuth();
  const canView =
    hasRole("registrar") ||
    hasRole("admin") ||
    hasRole("super_admin") ||
    hasRole("hearing_officer");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [violationType, setViolationType] = useState("");
  const [subViolation, setSubViolation] = useState("");

  const { data: violations } = useQuery({
    queryKey: ["violation-types"],
    queryFn: async () => apiGet("/api/violations"),
    enabled: canView,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports-summary", from, to, violationType, subViolation],
    enabled: canView && !!from && !!to,
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (violationType) params.set("violation_type", violationType);
      if (subViolation) params.set("sub_violation", subViolation);
      return apiGet(`/api/reports/summary?${params.toString()}`);
    },
  });

  const {
    data: hearingOfficerReports,
    isLoading: hearingOfficerLoading,
    error: hearingOfficerError,
  } = useQuery<HearingOfficerReportSection[]>({
    queryKey: ["reports-hearing-officer", from, to, violationType, subViolation],
    enabled: canView && !!from && !!to,
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (violationType) params.set("violation_type", violationType);
      if (subViolation) params.set("sub_violation", subViolation);
      return apiGet(`/api/reports/hearing-officer-wise?${params.toString()}`);
    },
  });

  const districtRows = useMemo(() => {
    if (!data?.byDistrict) return [];
    return Object.entries(data.byDistrict).map(([district, counts]) => ({
      district,
      ...counts,
    }));
  }, [data]);

  const violationRows = useMemo(() => {
    if (!data?.byViolation) return [];
    return Object.entries(data.byViolation).map(([violation, counts]) => ({
      violation,
      ...counts,
    }));
  }, [data]);

  const subViolationRows = useMemo(() => {
    if (!data?.bySubViolation) return [];
    return Object.entries(data.bySubViolation).map(([sub, counts]) => ({
      sub,
      ...counts,
    }));
  }, [data]);

  const handleDownload = async () => {
    if (!from || !to) return;
    const params = new URLSearchParams({ from, to });
    if (violationType) params.set("violation_type", violationType);
    if (subViolation) params.set("sub_violation", subViolation);
    const blob = await apiRequest(`/api/reports/summary/pdf?${params.toString()}`, {
      method: "GET",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "reports-summary.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleHearingOfficerDownload = async (officerId: string | null) => {
    if (!from || !to) return;
    if (!officerId) return;
    const params = new URLSearchParams({
      from,
      to,
      officer_id: officerId,
    });
    if (violationType) params.set("violation_type", violationType);
    if (subViolation) params.set("sub_violation", subViolation);
    const blob = await apiRequest(`/api/reports/hearing-officer-wise/pdf?${params.toString()}`, {
      method: "GET",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hearing-officer-report-${officerId || "unassigned"}-${from}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold">Reports</h1>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="text-sm font-medium">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Violation Type</label>
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
            <Button variant="outline" onClick={() => { setFrom(""); setTo(""); }}>
              Clear
            </Button>
            <Button variant="outline" onClick={handleDownload} disabled={!from || !to}>
              Download PDF
            </Button>
          </div>
        </div>

        {!canView && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              You do not have permission to view reports.
            </CardContent>
          </Card>
        )}

        {canView && !from && !to && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Select a date range to view reports.
            </CardContent>
          </Card>
        )}

        {canView && (isLoading || error) && (
          <Card>
            <CardContent className="py-8">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground">Unable to load reports.</p>
              )}
            </CardContent>
          </Card>
        )}

        {data?.totals && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Total Received</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.totals.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.totals.pending}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Approved</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.totals.approved}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Rejected</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.totals.rejected}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {data?.totals && (
          <Card>
            <CardHeader>
              <CardTitle>District Wise</CardTitle>
            </CardHeader>
            <CardContent>
              {districtRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No district data.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>District</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Pending</TableHead>
                        <TableHead>Approved</TableHead>
                        <TableHead>Rejected</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {districtRows.map((row) => (
                        <TableRow key={row.district}>
                          <TableCell>{row.district}</TableCell>
                          <TableCell>{row.total}</TableCell>
                          <TableCell>{row.pending}</TableCell>
                          <TableCell>{row.approved}</TableCell>
                          <TableCell>{row.rejected}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {data?.totals && (
          <Card>
            <CardHeader>
              <CardTitle>Violation Wise</CardTitle>
            </CardHeader>
            <CardContent>
              {violationRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No violation data.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Violation</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Pending</TableHead>
                        <TableHead>Approved</TableHead>
                        <TableHead>Rejected</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {violationRows.map((row) => (
                        <TableRow key={row.violation}>
                          <TableCell>{row.violation}</TableCell>
                          <TableCell>{row.total}</TableCell>
                          <TableCell>{row.pending}</TableCell>
                          <TableCell>{row.approved}</TableCell>
                          <TableCell>{row.rejected}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {data?.totals && (
          <Card>
            <CardHeader>
              <CardTitle>Sub-Violation Wise</CardTitle>
            </CardHeader>
            <CardContent>
              {subViolationRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sub-violation data.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sub-Violation</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Pending</TableHead>
                        <TableHead>Approved</TableHead>
                        <TableHead>Rejected</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subViolationRows.map((row) => (
                        <TableRow key={row.sub}>
                          <TableCell>{row.sub}</TableCell>
                          <TableCell>{row.total}</TableCell>
                          <TableCell>{row.pending}</TableCell>
                          <TableCell>{row.approved}</TableCell>
                          <TableCell>{row.rejected}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {canView && from && to && (
          <Card>
            <CardHeader>
              <CardTitle>Hearing Officer Wise Reports</CardTitle>
            </CardHeader>
            <CardContent>
              {hearingOfficerLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : hearingOfficerError ? (
                <p className="text-sm text-muted-foreground">Unable to load hearing officer reports.</p>
              ) : !hearingOfficerReports?.length ? (
                <p className="text-sm text-muted-foreground">No hearing officer data.</p>
              ) : (
                <div className="space-y-6">
                  {hearingOfficerReports.map((section) => (
                    <Card key={section.hearing_officer_id || "unassigned"}>
                      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <CardTitle>
                          {section.hearing_officer_name || "Unknown"}{" "}
                          <span className="text-sm font-normal text-muted-foreground">
                            (Total: {section.totals?.total ?? 0}, Pending: {section.totals?.pending ?? 0}, Approved: {section.totals?.approved ?? 0}, Rejected: {section.totals?.rejected ?? 0})
                          </span>
                        </CardTitle>
                        <Button
                          variant="outline"
                          onClick={() => handleHearingOfficerDownload(section.hearing_officer_id)}
                        >
                          Download PDF
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {!section.applications.length ? (
                          <p className="text-sm text-muted-foreground">No applications found.</p>
                        ) : (
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
                                {section.applications.map((row, idx) => (
                                  <TableRow key={`${row.application_id}-${idx}`}>
                                    <TableCell className="font-mono font-medium">
                                      {row.application_id || "N/A"}
                                    </TableCell>
                                    <TableCell>{row.applicant_display_name || "N/A"}</TableCell>
                                    <TableCell>{row.unit_name || "N/A"}</TableCell>
                                    <TableCell>{row.category || "N/A"}</TableCell>
                                    <TableCell>{row.unit_id || "N/A"}</TableCell>
                                    <TableCell>{row.district || "N/A"}</TableCell>
                                    <TableCell>{row.contact || "N/A"}</TableCell>
                                    <TableCell>
                                      {row.submission_date
                                        ? format(new Date(row.submission_date), "PP")
                                        : "N/A"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reports;
