"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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

interface Admin {
  _id: string;
  username: string;
  email: string;
  status: "active" | "inactive";
}

const emptyForm = { username: "", email: "", password: "" };

export default function AdminsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<Admin[]>("/api/admins")
      .then(setAdmins)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/admins", form);
      toast({ title: "Admin account created." });
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to create admin." });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(admin: Admin) {
    const activate = admin.status === "inactive";
    const ok = await confirm({
      title: activate ? "Activate admin account?" : "Deactivate admin account?",
      description: activate ? "They will regain access to DTAN Learn." : "They will immediately lose access to DTAN Learn.",
      confirmLabel: activate ? "Activate" : "Deactivate",
      variant: activate ? "default" : "destructive",
    });
    if (!ok) return;
    try {
      if (activate) {
        await api.patch(`/api/admins/${admin._id}`, { status: "active" });
      } else {
        await api.del(`/api/admins/${admin._id}`);
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
        title="Admins"
        description="Manage administrator accounts."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Add admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New admin account</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
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
          ) : admins.length === 0 ? (
            <EmptyState title="No admins yet" description="Add your first admin account." />
          ) : (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.map((a) => {
                      const isSelf = a._id === session?.user?.id;
                      return (
                        <TableRow key={a._id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback>{initials(a.username)}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">
                                {a.username}
                                {isSelf && <span className="text-xs text-muted-foreground"> (you)</span>}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{a.email}</TableCell>
                          <TableCell>
                            <StatusBadge status={a.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleStatus(a)}
                              disabled={isSelf}
                              aria-label="Toggle status"
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <MobileList>
                {admins.map((a) => {
                  const isSelf = a._id === session?.user?.id;
                  return (
                    <MobileCard key={a._id}>
                      <MobileCardHeader
                        actions={
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(a)}
                            disabled={isSelf}
                            aria-label="Toggle status"
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        }
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback>{initials(a.username)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {a.username}
                              {isSelf && <span className="text-xs text-muted-foreground"> (you)</span>}
                            </p>
                          </div>
                        </div>
                      </MobileCardHeader>
                      <MobileField label="Email">{a.email}</MobileField>
                      <MobileField label="Status">
                        <StatusBadge status={a.status} />
                      </MobileField>
                    </MobileCard>
                  );
                })}
              </MobileList>
            </>
          )}
        </CardContent>
      </Card>
      {dialog}
    </div>
  );
}
