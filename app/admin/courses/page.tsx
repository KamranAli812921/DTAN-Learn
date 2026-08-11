"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Power } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { MobileList, MobileCard, MobileCardHeader, MobileField } from "@/components/shared/mobile-list";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client-api";

interface Course {
  _id: string;
  courseCode: string;
  courseName: string;
  description?: string;
  duration?: string;
  status: "active" | "inactive";
}

const emptyForm = { courseCode: "", courseName: "", description: "", duration: "" };

export default function CoursesPage() {
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<Course[]>("/api/courses")
      .then(setCourses)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(course: Course) {
    setEditing(course);
    setForm({
      courseCode: course.courseCode,
      courseName: course.courseName,
      description: course.description ?? "",
      duration: course.duration ?? "",
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/api/courses/${editing._id}`, form);
        toast({ title: "Course updated." });
      } else {
        await api.post("/api/courses", form);
        toast({ title: "Course created." });
      }
      setOpen(false);
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to save course." });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(course: Course) {
    const activate = course.status === "inactive";
    const ok = await confirm({
      title: activate ? "Activate course?" : "Deactivate course?",
      description: activate
        ? "Students and teachers will be able to interact with this course again."
        : "This course will be marked inactive. Existing data is preserved.",
      confirmLabel: activate ? "Activate" : "Deactivate",
      variant: activate ? "default" : "destructive",
    });
    if (!ok) return;

    try {
      if (activate) {
        await api.patch(`/api/courses/${course._id}`, { status: "active" });
      } else {
        await api.del(`/api/courses/${course._id}`);
      }
      toast({ title: activate ? "Course activated." : "Course deactivated." });
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Action failed." });
    }
  }

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Manage the courses offered by your institution."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit course" : "New course"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="courseCode">Course code</Label>
                    <Input id="courseCode" value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration</Label>
                    <Input id="duration" placeholder="e.g. 12 weeks" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="courseName">Course name</Label>
                  <Input id="courseName" value={form.courseName} onChange={(e) => setForm({ ...form, courseName: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {editing ? "Save changes" : "Create course"}
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
          ) : courses.length === 0 ? (
            <EmptyState title="No courses yet" description="Add your first course to get started." />
          ) : (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.map((c) => (
                      <TableRow key={c._id}>
                        <TableCell className="font-medium">{c.courseCode}</TableCell>
                        <TableCell>{c.courseName}</TableCell>
                        <TableCell>{c.duration || "—"}</TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(c)} aria-label="Toggle status">
                            <Power className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <MobileList>
                {courses.map((c) => (
                  <MobileCard key={c._id}>
                    <MobileCardHeader
                      actions={
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(c)} aria-label="Toggle status">
                            <Power className="h-4 w-4" />
                          </Button>
                        </>
                      }
                    >
                      <p className="font-medium">{c.courseCode}</p>
                      <p className="text-sm text-muted-foreground">{c.courseName}</p>
                    </MobileCardHeader>
                    <MobileField label="Duration">{c.duration || "—"}</MobileField>
                    <MobileField label="Status">
                      <StatusBadge status={c.status} />
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
