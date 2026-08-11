"use client";

import { useEffect, useState } from "react";
import { Plus, Megaphone, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";

interface Course {
  _id: string;
  courseCode: string;
}
interface Batch {
  _id: string;
  batchName: string;
  course: string;
}
interface Announcement {
  _id: string;
  title: string;
  message: string;
  targetType: "all" | "course" | "batch";
  course?: Course;
  batch?: Batch;
  createdBy: { username: string };
  createdAt: string;
}

const emptyForm = { title: "", message: "", targetType: "batch" as Announcement["targetType"], course: "", batch: "" };

export function AnnouncementsManager({ role }: { role: "admin" | "teacher" | "student" }) {
  const { toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const canManage = role === "admin" || role === "teacher";

  function load() {
    setLoading(true);
    const calls: Promise<any>[] = [api.get<Announcement[]>("/api/announcements")];
    if (canManage) calls.push(api.get<Course[]>("/api/courses"), api.get<Batch[]>("/api/batches"));
    Promise.all(calls)
      .then(([a, c, b]) => {
        setAnnouncements(a);
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
      const payload: Record<string, unknown> = { title: form.title, message: form.message, targetType: form.targetType };
      if (form.targetType === "course") payload.course = form.course;
      if (form.targetType === "batch") payload.batch = form.batch;
      await api.post("/api/announcements", payload);
      toast({ title: "Announcement posted." });
      setOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to post announcement." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a: Announcement) {
    const ok = await confirm({ title: "Archive announcement?", description: `"${a.title}" will no longer be shown.` });
    if (!ok) return;
    try {
      await api.del(`/api/announcements/${a._id}`);
      toast({ title: "Announcement archived." });
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to archive." });
    }
  }

  return (
    <div>
      <PageHeader
        title="Announcements"
        description={canManage ? "Post announcements to students." : "Announcements relevant to you."}
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setForm(emptyForm)}>
                  <Plus className="h-4 w-4" /> New announcement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New announcement</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Audience</Label>
                    <Select value={form.targetType} onValueChange={(v) => setForm({ ...form, targetType: v as Announcement["targetType"] })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {role === "admin" && <SelectItem value="all">Everyone</SelectItem>}
                        <SelectItem value="course">A specific course</SelectItem>
                        <SelectItem value="batch">A specific batch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.targetType === "course" && (
                    <div className="space-y-2">
                      <Label>Course</Label>
                      <Select value={form.course} onValueChange={(v) => setForm({ ...form, course: v })}>
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
                  )}
                  {form.targetType === "batch" && (
                    <div className="space-y-2">
                      <Label>Batch</Label>
                      <Select value={form.batch} onValueChange={(v) => setForm({ ...form, batch: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select batch" />
                        </SelectTrigger>
                        <SelectContent>
                          {batches.map((b) => (
                            <SelectItem key={b._id} value={b._id}>
                              {b.batchName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>
                      Post announcement
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState title="No announcements yet" icon={Megaphone} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a._id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base break-words">{a.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(a.createdAt, true)} · {a.createdBy?.username}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="capitalize break-words text-right">
                      {a.targetType === "all" ? "Everyone" : a.targetType === "course" ? a.course?.courseCode : a.batch?.batchName}
                    </Badge>
                    {canManage && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(a)} aria-label="Archive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground whitespace-pre-wrap">{a.message}</CardContent>
            </Card>
          ))}
        </div>
      )}
      {dialog}
    </div>
  );
}
