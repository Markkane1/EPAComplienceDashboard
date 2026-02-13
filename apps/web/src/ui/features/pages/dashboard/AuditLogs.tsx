import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/ui/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";
import { Input } from "@/ui/components/ui/input";
import { Button } from "@/ui/components/ui/button";
import { Skeleton } from "@/ui/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/components/ui/select";
import { useAuth } from "@/ui/hooks/useAuth";
import type { AuditLogEntry } from "@repo/shared";
import { auditLogUseCases } from "@/ui/app/container";

const ENTITY_TYPES = [
  "application",
  "hearing",
  "user",
  "industry_category",
  "violation_type",
  "application_document",
];

const AuditLogs = () => {
  const { hasRole } = useAuth();
  const canView = hasRole("admin") || hasRole("super_admin");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [userId, setUserId] = useState("");
  const [limit, setLimit] = useState("50");

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-logs", entityType, entityId, userId, limit],
    enabled: canView,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityType) params.set("entity_type", entityType);
      if (entityId) params.set("entity_id", entityId.trim());
      if (userId) params.set("user_id", userId.trim());
      if (limit) params.set("limit", limit);
      return auditLogUseCases.list(params);
    },
  });

  const rows = useMemo(() => (data || []) as AuditLogEntry[], [data]);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Audit Logs</h1>
            <p className="text-sm text-muted-foreground">Track changes and key actions across the system.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setEntityType("");
              setEntityId("");
              setUserId("");
              setLimit("50");
            }}
          >
            Clear Filters
          </Button>
        </div>

        {!canView && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              You do not have permission to view audit logs.
            </CardContent>
          </Card>
        )}

        {canView && (
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="text-sm font-medium">Entity Type</label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Entity ID</label>
                <Input
                  value={entityId}
                  onChange={(event) => setEntityId(event.target.value)}
                  placeholder="Optional"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">User ID</label>
                <Input
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  placeholder="Optional"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Limit</label>
                <Input
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  placeholder="50"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {canView && (isLoading || error) && (
          <Card>
            <CardContent className="py-8">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground">Unable to load audit logs.</p>
              )}
            </CardContent>
          </Card>
        )}

        {canView && !isLoading && !error && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit records found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Entity ID</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {row.created_at ? new Date(row.created_at).toLocaleString() : "-"}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{row.action}</TableCell>
                          <TableCell className="text-xs">{row.entity_type}</TableCell>
                          <TableCell className="text-xs">{row.entity_id || "-"}</TableCell>
                          <TableCell className="text-xs">
                            {row.user_email || row.user_id || "-"}
                          </TableCell>
                          <TableCell className="text-xs">{row.ip_address || "-"}</TableCell>
                          <TableCell className="text-xs max-w-[240px] truncate" title={row.details ? JSON.stringify(row.details) : ""}>
                            {row.details ? JSON.stringify(row.details) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AuditLogs;



