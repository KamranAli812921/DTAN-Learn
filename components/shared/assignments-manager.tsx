"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { MobileList, MobileCard, MobileCardHeader, MobileField } from "@/components/shared/mobile-list";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";

interface Batch {
  _id: string;
  batchName: string;
  course: { _id: string };
}
interface Course {
  _id: string;
  courseCode: string;
}
interface Assignment {
  _id: string;
  title: string;
  description?: string;
  dueDate: string;
  totalMarks: number;
  submissionType: "file" | "github" | "both";
  status: "draft" | "published";
  course: Course;
  batch: { _id: string; batchName: string };
}

const emptyForm = {
  title: "",
  description: "",
  course: "",
  batch: "",
  dueDate: "",
  totalMarks: 100,
  submissionType: "both" as Assignment["submissionType"],
  status: "published" as Assignment["status"],
};

export function AssignmentsManager({ role }: { role: "admin" | "teacher" }) {
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.get<Assignment[]>("/api/assignments"), api.get<Course[]>("/api/courses"), api.get<Batch[]>("/api/batches")])
      .then(([a, c, b]) => {
        setAssignments(a);
        setCourses(c);
        setBatches(b);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(a: Assignment) {
    setEditing(a);
    setForm({
      title: a.title,
      description: a.description ?? "",
      course: a.course._id,
      batch: a.batch._id,
      dueDate: a.dueDate.slice(0, 16),
      totalMarks: a.totalMarks,
      submissionType: a.submissionType,
      status: a.status,
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, dueDate: new Date(form.dueDate).toISOString(), totalMarks: Number(form.totalMarks) };
      if (editing) {
        await api.patch(`/api/assignments/${editing._id}`, payload);
        toast({ title: "Assignment updated." });
      } else {
        await api.post("/api/assignments", payload);
        toast({ title: "Assignment created." });
      }
      setOpen(false);
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to save assignment." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a: Assignment) {
    const ok = await confirm({ title: "Delete assignment?", description: `"${a.title}" and its association with submissions will be removed.` });
    if (!ok) return;
    try {
      await api.del(`/api/assignments/${a._id}`);
      toast({ title: "Assignment deleted." });
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to delete." });
    }
  }

  const filteredBatches = form.course ? batches.filter((b) => b.course?._id === form.course) : batches;

  return (
    <div>
      <PageHeader
        title="Assignments"
        description={role === "admin" ? "Create and manage assignments across all courses." : "Create and manage assignments for your batches."}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> New assignment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit assignment" : "New assignment"}</DialogTitle>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Due date</Label>
                    <Input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Total marks</Label>
                    <Input type="number" min={0} value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: Number(e.target.value) })} required />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Submission type</Label>
                    <Select value={form.submissionType} onValueChange={(v) => setForm({ ...form, submissionType: v as Assignment["submissionType"] })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="file">File only</SelectItem>
                        <SelectItem value="github">GitHub URL only</SelectItem>
                        <SelectItem value="both">File or GitHub URL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Assignment["status"] })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving || !form.course || !form.batch}>
                    {editing ? "Save changes" : "Create assignment"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
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
          ) : assignments.length === 0 ? (
            <EmptyState title="No assignments yet" />
          ) : (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Marks</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((a) => (
                      <TableRow key={a._id}>
                        <TableCell className="font-medium">{a.title}</TableCell>
                        <TableCell>{a.batch?.batchName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(a.dueDate, true)}</TableCell>
                        <TableCell>{a.totalMarks}</TableCell>
                        <TableCell>
                          <StatusBadge status={a.status} />
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(a)} aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(a)} aria-label="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <MobileList>
                {assignments.map((a) => (
                  <MobileCard key={a._id}>
                    <MobileCardHeader
                      actions={
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(a)} aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(a)} aria-label="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      }
                    >
                      <p className="font-medium">{a.title}</p>
                      <p className="text-sm text-muted-foreground">{a.batch?.batchName}</p>
                    </MobileCardHeader>
                    <MobileField label="Due">{formatDate(a.dueDate, true)}</MobileField>
                    <MobileField label="Marks">{a.totalMarks}</MobileField>
                    <MobileField label="Status">
                      <StatusBadge status={a.status} />
                    </MobileField>
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
