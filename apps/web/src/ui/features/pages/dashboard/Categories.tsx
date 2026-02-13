import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/ui/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { Badge } from "@/ui/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import { Skeleton } from "@/ui/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/ui/hooks/useAuth";
import { categoryUseCases } from "@/ui/app/container";

interface Category {
  id: string;
  name: string;
  subcategories: Array<{ id: string; name: string }>;
}

const parseSubcategories = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const Categories = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole("admin") || hasRole("super_admin");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Category | null>(null);
  const [createForm, setCreateForm] = useState({ name: "", subcategories: "" });
  const [editForm, setEditForm] = useState({ name: "", subcategories: "" });

  const { data: categories, isLoading, error } = useQuery<Category[]>({
    queryKey: ["industry-categories"],
    queryFn: async () => categoryUseCases.list(),
    enabled: canManage,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!createForm.name.trim()) {
        throw new Error("Category name is required.");
      }
      return categoryUseCases.create({
        name: createForm.name.trim(),
        subcategories: parseSubcategories(createForm.subcategories),
      });
    },
    onSuccess: () => {
      toast.success("Category created.");
      queryClient.invalidateQueries({ queryKey: ["industry-categories"] });
      setIsCreateOpen(false);
      setCreateForm({ name: "", subcategories: "" });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to create category.";
      toast.error(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return null;
      if (!editForm.name.trim()) {
        throw new Error("Category name is required.");
      }
      return categoryUseCases.update(selected.id, {
        name: editForm.name.trim(),
        subcategories: parseSubcategories(editForm.subcategories),
      });
    },
    onSuccess: () => {
      toast.success("Category updated.");
      queryClient.invalidateQueries({ queryKey: ["industry-categories"] });
      setIsEditOpen(false);
      setSelected(null);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to update category.";
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return null;
      return categoryUseCases.remove(selected.id);
    },
    onSuccess: () => {
      toast.success("Category deleted.");
      queryClient.invalidateQueries({ queryKey: ["industry-categories"] });
      setIsDeleteOpen(false);
      setSelected(null);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to delete category.";
      toast.error(message);
    },
  });

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Industry Categories</h1>

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {!canManage ? (
              <p className="text-center text-muted-foreground py-8">
                You do not have permission to manage categories.
              </p>
            ) : isLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="text-center text-muted-foreground py-8">
                Unable to load categories. Please try again.
              </p>
            ) : categories?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No categories added yet.
              </p>
            ) : (
              <div className="space-y-4">
                {categories?.map((category) => (
                  <div
                    key={category.id}
                    className="border rounded-lg p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{category.name}</h3>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelected(category);
                            setEditForm({
                              name: category.name,
                              subcategories: category.subcategories
                                .map((sub) => sub.name)
                                .join(", "),
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
                            setSelected(category);
                            setIsDeleteOpen(true);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {category.subcategories.length ? (
                        category.subcategories.map((sub) => (
                          <Badge key={sub.id} variant="secondary">
                            {sub.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No subcategories</span>
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
            Add Category
          </Button>
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>Define a new industry category.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Category Name</label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Subcategories (comma separated)</label>
              <Input
                value={createForm.subcategories}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, subcategories: e.target.value }))
                }
                className="mt-1"
                placeholder="e.g. Textile, Pharma, Food"
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
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update category name or subcategories.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Category Name</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Subcategories (comma separated)</label>
              <Input
                value={editForm.subcategories}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, subcategories: e.target.value }))
                }
                className="mt-1"
                placeholder="e.g. Textile, Pharma, Food"
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
            <DialogTitle>Delete Category</DialogTitle>
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

export default Categories;


