"use client";

import { useEffect, useState } from "react";
import { Plus, FolderOpen, Trash2, Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { MobileList, MobileCard, MobileCardHeader, MobileField } from "@/components/shared/mobile-list";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";
import { FileUploadField } from "@/components/shared/file-upload-field";

interface Batch {
  _id: string;
  batchName: string;
  course: { _id: string };
}
interface Course {
  _id: string;
  courseCode: string;
}
interface Material {
  _id: string;
  title: string;
  description?: string;
  fileUrl: string;
  course: Course;
  batch: { _id: string; batchName: string };
  createdAt: string;
}

const emptyForm = { title: "", description: "", course: "", batch: "", fileUrl: "" };

export function MaterialsManager({ role }: { role: "admin" | "teacher" | "student" }) {
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const canManage = role === "admin" || role === "teacher";

  function load() {
    setLoading(true);
    const calls: Promise<any>[] = [api.get<Material[]>("/api/materials")];
    if (canManage) {
      calls.push(api.get<Course[]>("/api/courses"), api.get<Batch[]>("/api/batches"));
    }
    Promise.all(calls)
      .then(([m, c, b]) => {
        setMaterials(m);
        if (c) setCourses(c);
        if (b) setBatches(b);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/materials", form);
      toast({ title: "Material uploaded." });
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to upload material." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m: Material) {
    const ok = await confirm({ title: "Delete material?", description: `"${m.title}" will be removed for all students.` });
    if (!ok) return;
    try {
      await api.del(`/api/materials/${m._id}`);
      toast({ title: "Material deleted." });
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to delete." });
    }
  }

  const filteredBatches = form.course ? batches.filter((b) => b.course?._id === form.course) : batches;

  return (
    <div>
      <PageHeader
        title="Learning Materials"
        description={canManage ? "Upload and manage course materials." : "Materials shared for your course and batch."}
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" /> Upload material
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload learning material</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Course</Label>
                      <Select value={form.course} onValueChange={(v) => setForm({ ...form, course: v, batch: "" })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                        <SelectContent>
                          {courses.map((c) => (
                            <SelectItem key={c._id} value={c._id}>
                              {c.courseCode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Batch</Label>
                      <Select value={form.batch} onValueChange={(v) => setForm({ ...form, batch: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select batch" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredBatches.map((b) => (
                            <SelectItem key={b._id} value={b._id}>
                              {b.batchName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <FileUploadField label="File" folder="materials" value={form.fileUrl} onChange={(url) => setForm({ ...form, fileUrl: url })} required />
                  <DialogFooter>
                    <Button type="submit" disabled={saving || !form.course || !form.batch || !form.fileUrl}>
                      Upload
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : materials.length === 0 ? (
            <EmptyState title="No materials yet" icon={FolderOpen} />
          ) : (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((m) => (
                      <TableRow key={m._id}>
                        <TableCell className="font-medium">
                          {m.title}
                          {m.description && <div className="text-xs text-muted-foreground line-clamp-1">{m.description}</div>}
                        </TableCell>
                        <TableCell>{m.batch?.batchName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(m.createdAt)}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <a href={m.fileUrl} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="icon" aria-label="Download">
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                          {canManage && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(m)} aria-label="Delete">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <MobileList>
                {materials.map((m) => (
                  <MobileCard key={m._id}>
                    <MobileCardHeader
                      actions={
                        <>
                          <a href={m.fileUrl} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="icon" aria-label="Download">
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                          {canManage && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(m)} aria-label="Delete">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      }
                    >
                      <p className="font-medium">{m.title}</p>
                      {m.description && <p className="text-xs text-muted-foreground line-clamp-1">{m.description}</p>}
                    </MobileCardHeader>
                    <MobileField label="Batch">{m.batch?.batchName}</MobileField>
                    <MobileField label="Uploaded">{formatDate(m.createdAt)}</MobileField>
                  </MobileCard>
                ))}
              </MobileList>
            </>
          )}
        </CardContent>
      </Card>
      {dialog}
    </div>
  );
}
