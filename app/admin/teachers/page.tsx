"use client";

import { useEffect, useState } from "react";
import { Plus, Power } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
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

interface Teacher {
  _id: string;
  teacherId: string;
  fullName: string;
  phone?: string;
  user: { _id: string; username: string; email: string; status: "active" | "inactive" };
}

const emptyForm = { username: "", email: "", password: "", fullName: "", phone: "", teacherId: "" };

export default function TeachersPage() {
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<Teacher[]>("/api/teachers")
      .then(setTeachers)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/teachers", form);
      toast({ title: "Teacher account created." });
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to create teacher." });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(teacher: Teacher) {
    const activate = teacher.user.status === "inactive";
    const ok = await confirm({
      title: activate ? "Activate teacher account?" : "Deactivate teacher account?",
      description: activate ? "They will regain access to DTAN Learn." : "They will immediately lose access to DTAN Learn.",
      confirmLabel: activate ? "Activate" : "Deactivate",
      variant: activate ? "default" : "destructive",
    });
    if (!ok) return;
    try {
      if (activate) {
        await api.patch(`/api/teachers/${teacher._id}`, { status: "active" });
      } else {
        await api.del(`/api/teachers/${teacher._id}`);
      }
      toast({ title: activate ? "Account activated." : "Account deactivated." });
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Action failed." });
    }
  }

  return (
    <div>
      <PageHeader
        title="Teachers"
        description="Manage teacher accounts."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Add teacher
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New teacher account</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full name</Label>
                    <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Teacher ID</Label>
                    <Input value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} required />
                  </div>
                </div>
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
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    Create account
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
          ) : teachers.length === 0 ? (
            <EmptyState title="No teachers yet" description="Add your first teacher account." />
          ) : (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Teacher ID</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teachers.map((t) => (
                      <TableRow key={t._id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback>{initials(t.fullName)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{t.fullName}</span>
                          </div>
                        </TableCell>
                        <TableCell>{t.teacherId}</TableCell>
                        <TableCell>{t.user?.email}</TableCell>
                        <TableCell>{t.phone || "—"}</TableCell>
                        <TableCell>
                          <StatusBadge status={t.user?.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(t)} aria-label="Toggle status">
                            <Power className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <MobileList>
                {teachers.map((t) => (
                  <MobileCard key={t._id}>
                    <MobileCardHeader
                      actions={
                        <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(t)} aria-label="Toggle status">
                          <Power className="h-4 w-4" />
                        </Button>
                      }
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback>{initials(t.fullName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{t.fullName}</p>
                          <p className="text-xs text-muted-foreground">{t.teacherId}</p>
                        </div>
                      </div>
                    </MobileCardHeader>
                    <MobileField label="Email">{t.user?.email}</MobileField>
                    <MobileField label="Phone">{t.phone || "—"}</MobileField>
                    <MobileField label="Status">
                      <StatusBadge status={t.user?.status} />
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
