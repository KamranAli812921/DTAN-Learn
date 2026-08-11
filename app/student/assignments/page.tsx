"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Github } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { MobileList, MobileCard, MobileCardHeader, MobileField } from "@/components/shared/mobile-list";
import { FileUploadField } from "@/components/shared/file-upload-field";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";

interface Assignment {
  _id: string;
  title: string;
  description?: string;
  dueDate: string;
  totalMarks: number;
  submissionType: "file" | "github" | "both";
  attachmentUrl?: string;
}
interface Submission {
  _id: string;
  assignment: { _id: string };
  status: "submitted" | "late" | "reviewed";
  fileUrl?: string;
  githubUrl?: string;
  submittedAt: string;
}

export default function StudentAssignmentsPage() {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Assignment | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.get<Assignment[]>("/api/assignments"), api.get<Submission[]>("/api/submissions")])
      .then(([a, s]) => {
        setAssignments(a);
        const map: Record<string, Submission> = {};
        s.forEach((sub) => (map[sub.assignment._id] = sub));
        setSubmissions(map);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openSubmit(a: Assignment) {
    const existing = submissions[a._id];
    setTarget(a);
    setFileUrl(existing?.fileUrl ?? "");
    setGithubUrl(existing?.githubUrl ?? "");
    setComments("");
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setSaving(true);
    try {
      await api.post("/api/submissions", { assignmentId: target._id, fileUrl, githubUrl, comments });
      toast({ title: "Assignment submitted." });
      setOpen(false);
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Submission failed." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Assignments" description="View and submit your assignments." />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : assignments.length === 0 ? (
            <EmptyState title="No assignments yet" icon={ClipboardList} />
          ) : (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Marks</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((a) => {
                      const submission = submissions[a._id];
                      const overdue = new Date() > new Date(a.dueDate) && !submission;
                      return (
                        <TableRow key={a._id}>
                          <TableCell className="font-medium">{a.title}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(a.dueDate, true)}</TableCell>
                          <TableCell>{a.totalMarks}</TableCell>
                          <TableCell>
                            {submission ? <StatusBadge status={submission.status} /> : overdue ? <StatusBadge status="late" /> : <StatusBadge status="draft" />}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => openSubmit(a)} disabled={submission?.status === "reviewed"}>
                              {submission ? "Resubmit" : "Submit"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <MobileList>
                {assignments.map((a) => {
                  const submission = submissions[a._id];
                  const overdue = new Date() > new Date(a.dueDate) && !submission;
                  return (
                    <MobileCard key={a._id}>
                      <MobileCardHeader
                        actions={
                          <Button variant="outline" size="sm" onClick={() => openSubmit(a)} disabled={submission?.status === "reviewed"}>
                            {submission ? "Resubmit" : "Submit"}
                          </Button>
                        }
                      >
                        <p className="font-medium">{a.title}</p>
                      </MobileCardHeader>
                      <MobileField label="Due">{formatDate(a.dueDate, true)}</MobileField>
                      <MobileField label="Marks">{a.totalMarks}</MobileField>
                      <MobileField label="Status">
                        {submission ? <StatusBadge status={submission.status} /> : overdue ? <StatusBadge status="late" /> : <StatusBadge status="draft" />}
                      </MobileField>
                    </MobileCard>
                  );
                })}
              </MobileList>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit: {target?.title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {(target?.submissionType === "file" || target?.submissionType === "both") && (
              <FileUploadField label="File" folder="submissions" value={fileUrl} onChange={setFileUrl} required={target?.submissionType === "file"} />
            )}
            {(target?.submissionType === "github" || target?.submissionType === "both") && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Github className="h-3.5 w-3.5" /> GitHub URL
                </Label>
                <Input type="url" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/username/repo" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Comments</Label>
              <Textarea value={comments} onChange={(e) => setComments(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving || (!fileUrl && !githubUrl)}>
                Submit assignment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
