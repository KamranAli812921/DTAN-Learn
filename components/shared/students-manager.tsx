"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Power } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MobileList, MobileCard, MobileCardHeader, MobileField } from "@/components/shared/mobile-list";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client-api";
import { initials } from "@/lib/utils";

interface Course {
  _id: string;
  courseCode: string;
  courseName: string;
}
interface Batch {
  _id: string;
  batchName: string;
  course: { _id: string };
}
interface Student {
  _id: string;
  studentId: string;
  fullName: string;
  phone?: string;
  course: Course;
  batch: { _id: string; batchName: string };
  user: { _id: string; username: string; email: string; status: "active" | "inactive" };
}

const emptyForm = { username: "", email: "", password: "", fullName: "", phone: "", studentId: "", course: "", batch: "" };

export function StudentsManager({ role }: { role: "admin" | "teacher" }) {
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.get<Student[]>("/api/students"), api.get<Course[]>("/api/courses"), api.get<Batch[]>("/api/batches")])
      .then(([s, c, b]) => {
        setStudents(s);
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

  function openEdit(student: Student) {
    setEditing(student);
    setForm({
      username: student.user.username,
      email: student.user.email,
      password: "",
      fullName: student.fullName,
      phone: student.phone ?? "",
      studentId: student.studentId,
      course: student.course._id,
      batch: student.batch._id,
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/api/students/${editing._id}`, {
          fullName: form.fullName,
          phone: form.phone,
          course: form.course,
          batch: form.batch,
        });
        toast({ title: "Student updated." });
      } else {
        await api.post("/api/students", form);
        toast({ title: "Student account created." });
      }
      setOpen(false);
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to save student." });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(student: Student) {
    if (role !== "admin") return;
    const activate = student.user.status === "inactive";
    const ok = await confirm({
      title: activate ? "Activate student account?" : "Deactivate student account?",
      description: activate ? "They will regain access to DTAN Learn." : "They will immediately lose access to DTAN Learn.",
      confirmLabel: activate ? "Activate" : "Deactivate",
      variant: activate ? "default" : "destructive",
    });
    if (!ok) return;
    try {
      if (activate) {
        await api.patch(`/api/students/${student._id}`, { status: "active" });
      } else {
        await api.del(`/api/students/${student._id}`);
      }
      toast({ title: activate ? "Account activated." : "Account deactivated." });
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Action failed." });
    }
  }

  const filteredBatches = form.course ? batches.filter((b) => b.course?._id === form.course) : batches;

  return (
    <div>
      <PageHeader
        title="Students"
        description={role === "admin" ? "Manage all student accounts." : "Manage students in your assigned batches."}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit student" : "New student account"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full name</Label>
                    <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Student ID</Label>
                    <Input value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required disabled={!!editing} />
                  </div>
                </div>

                {!editing && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Temporary password</Label>
                      <PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
                    </div>
                  </>
                )}

                {editing && (
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                )}

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
                <DialogFooter>
                  <Button type="submit" disabled={saving || !form.course || !form.batch}>
                    {editing ? "Save changes" : "Create account"}
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
          ) : students.length === 0 ? (
            <EmptyState title="No students yet" description="Add your first student account." />
          ) : (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s) => (
                      <TableRow key={s._id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback>{initials(s.fullName)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{s.fullName}</span>
                          </div>
                        </TableCell>
                        <TableCell>{s.studentId}</TableCell>
                        <TableCell>{s.batch?.batchName}</TableCell>
                        <TableCell>{s.user?.email}</TableCell>
                        <TableCell>
                          <StatusBadge status={s.user?.status} />
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {role === "admin" && (
                            <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(s)} aria-label="Toggle status">
                              <Power className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <MobileList>
                {students.map((s) => (
                  <MobileCard key={s._id}>
                    <MobileCardHeader
                      actions={
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {role === "admin" && (
                            <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(s)} aria-label="Toggle status">
                              <Power className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      }
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback>{initials(s.fullName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{s.fullName}</p>
                          <p className="text-xs text-muted-foreground">{s.studentId}</p>
                        </div>
                      </div>
                    </MobileCardHeader>
                    <MobileField label="Batch">{s.batch?.batchName}</MobileField>
                    <MobileField label="Email">{s.user?.email}</MobileField>
                    <MobileField label="Status">
                      <StatusBadge status={s.user?.status} />
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
