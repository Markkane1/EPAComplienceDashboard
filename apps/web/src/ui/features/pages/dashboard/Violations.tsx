import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/ui/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { Badge } from "@/ui/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/components/ui/dialog";
import { Skeleton } from "@/ui/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/ui/hooks/useAuth";
import { violationUseCases } from "@/ui/app/container";

interface ViolationType {
  id: string;
  name: string;
  subviolations: Array<{ id: string; name: string }>;
}

const parseSubviolations = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const Violations = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole("admin") || hasRole("super_admin") || hasRole("registrar");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<ViolationType | null>(null);
  const [createForm, setCreateForm] = useState({ name: "", subviolations: "" });
  const [editForm, setEditForm] = useState({ name: "", subviolations: "" });

  const { data: violations, isLoading, error } = useQuery<ViolationType[]>({
    queryKey: ["violation-types"],
    queryFn: async () => violationUseCases.list(),
    enabled: canManage,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!createForm.name.trim()) {
        throw new Error("Violation type is required.");
      }
      return violationUseCases.create({
        name: createForm.name.trim(),
        subviolations: parseSubviolations(createForm.subviolations),
      });
    },
    onSuccess: () => {
      toast.success("Violation type created.");
      queryClient.invalidateQueries({ queryKey: ["violation-types"] });
      setIsCreateOpen(false);
      setCreateForm({ name: "", subviolations: "" });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to create violation type.";
      toast.error(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return null;
      if (!editForm.name.trim()) {
        throw new Error("Violation type is required.");
      }
      return violationUseCases.update(selected.id, {
        name: editForm.name.trim(),
        subviolations: parseSubviolations(editForm.subviolations),
      });
    },
    onSuccess: () => {
      toast.success("Violation type updated.");
      queryClient.invalidateQueries({ queryKey: ["violation-types"] });
      setIsEditOpen(false);
      setSelected(null);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to update violation type.";
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return null;
      return violationUseCases.remove(selected.id);
    },
    onSuccess: () => {
      toast.success("Violation type deleted.");
      queryClient.invalidateQueries({ queryKey: ["violation-types"] });
      setIsDeleteOpen(false);
      setSelected(null);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to delete violation type.";
      toast.error(message);
    },
  });

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Violation Types</h1>

        <Card>
          <CardHeader>
            <CardTitle>Violation Types</CardTitle>
          </CardHeader>
          <CardContent>
            {!canManage ? (
              <p className="text-center text-muted-foreground py-8">
                You do not have permission to manage violations.
              </p>
            ) : isLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="text-center text-muted-foreground py-8">
                Unable to load violations. Please try again.
              </p>
            ) : violations?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No violations added yet.
              </p>
            ) : (
              <div className="space-y-4">
                {violations?.map((violation) => (
                  <div key={violation.id} className="border rounded-lg p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{violation.name}</h3>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelected(violation);
                            setEditForm({
                              name: violation.name,
                              subviolations: violation.subviolations.map((sub) => sub.name).join(", "),
                            });
                            setIsEditOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelected(violation);
                            setIsDeleteOpen(true);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {violation.subviolations.length ? (
                        violation.subviolations.map((sub) => (
                          <Badge key={sub.id} variant="secondary">
                            {sub.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No sub-violations</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-4">
          <Button onClick={() => setIsCreateOpen(true)} disabled={!canManage}>
            Add Violation Type
          </Button>
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Violation Type</DialogTitle>
            <DialogDescription>Define a new violation type.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Violation Type</label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Sub-Violations (comma separated)</label>
              <Input
                value={createForm.subviolations}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, subviolations: e.target.value }))}
                className="mt-1"
                placeholder="e.g. SO2, NOx, PM2.5"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Violation Type</DialogTitle>
            <DialogDescription>Update violation type or sub-violations.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Violation Type</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Sub-Violations (comma separated)</label>
              <Input
                value={editForm.subviolations}
                onChange={(e) => setEditForm((prev) => ({ ...prev, subviolations: e.target.value }))}
                className="mt-1"
                placeholder="e.g. SO2, NOx, PM2.5"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Violation Type</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Violations;


