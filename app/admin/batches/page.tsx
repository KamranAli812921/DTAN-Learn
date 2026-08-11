"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { MobileList, MobileCard, MobileCardHeader, MobileField } from "@/components/shared/mobile-list";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";

interface Course {
  _id: string;
  courseCode: string;
  courseName: string;
}
interface Teacher {
  _id: string;
  fullName: string;
  teacherId: string;
}
interface Batch {
  _id: string;
  batchName: string;
  course: Course;
  teacher: Teacher;
  startDate: string;
  endDate?: string;
  status: "upcoming" | "active" | "completed";
}

const emptyForm = { batchName: "", course: "", teacher: "", startDate: "", endDate: "", status: "upcoming" as Batch["status"] };

export default function BatchesPage() {
  const { toast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.get<Batch[]>("/api/batches"), api.get<Course[]>("/api/courses"), api.get<Teacher[]>("/api/teachers")])
      .then(([b, c, t]) => {
        setBatches(b);
        setCourses(c);
        setTeachers(t);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(batch: Batch) {
    setEditing(batch);
    setForm({
      batchName: batch.batchName,
      course: batch.course._id,
      teacher: batch.teacher._id,
      startDate: batch.startDate.slice(0, 10),
      endDate: batch.endDate ? batch.endDate.slice(0, 10) : "",
      status: batch.status,
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, endDate: form.endDate || undefined };
      if (editing) {
        await api.patch(`/api/batches/${editing._id}`, payload);
        toast({ title: "Batch updated." });
      } else {
        await api.post("/api/batches", payload);
        toast({ title: "Batch created." });
      }
      setOpen(false);
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to save batch." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Batches"
        description="Group students under a course, assign a teacher, and track schedule."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add batch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit batch" : "New batch"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Batch name</Label>
                  <Input value={form.batchName} onChange={(e) => setForm({ ...form, batchName: e.target.value })} required />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Course</Label>
                    <Select value={form.course} onValueChange={(v) => setForm({ ...form, course: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select course" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((c) => (
                          <SelectItem key={c._id} value={c._id}>
                            {c.courseCode} — {c.courseName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Teacher</Label>
                    <Select value={form.teacher} onValueChange={(v) => setForm({ ...form, teacher: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((t) => (
                          <SelectItem key={t._id} value={t._id}>
                            {t.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start date</Label>
                    <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>End date</Label>
                    <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Batch["status"] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving || !form.course || !form.teacher}>
                    {editing ? "Save changes" : "Create batch"}
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
          ) : batches.length === 0 ? (
            <EmptyState title="No batches yet" description="Create a batch to start enrolling students." icon={CheckCircle2} />
          ) : (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((b) => (
                      <TableRow key={b._id}>
                        <TableCell className="font-medium">{b.batchName}</TableCell>
                        <TableCell>{b.course?.courseCode}</TableCell>
                        <TableCell>{b.teacher?.fullName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(b.startDate)} {b.endDate ? `– ${formatDate(b.endDate)}` : ""}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={b.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(b)} aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <MobileList>
                {batches.map((b) => (
                  <MobileCard key={b._id}>
                    <MobileCardHeader
                      actions={
                        <Button variant="ghost" size="icon" onClick={() => openEdit(b)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      }
                    >
                      <p className="font-medium">{b.batchName}</p>
                      <p className="text-sm text-muted-foreground">{b.course?.courseCode}</p>
                    </MobileCardHeader>
                    <MobileField label="Teacher">{b.teacher?.fullName}</MobileField>
                    <MobileField label="Schedule">
                      {formatDate(b.startDate)} {b.endDate ? `– ${formatDate(b.endDate)}` : ""}
                    </MobileField>
                    <MobileField label="Status">
                      <StatusBadge status={b.status} />
                    </MobileField>
                  </MobileCard>
                ))}
              </MobileList>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
