"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Github, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { MobileList, MobileCard, MobileCardHeader, MobileField } from "@/components/shared/mobile-list";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";

interface Assignment {
  _id: string;
  title: string;
  totalMarks: number;
}
interface Submission {
  _id: string;
  student: { _id: string; fullName: string; studentId: string };
  assignment: Assignment;
  fileUrl?: string;
  githubUrl?: string;
  comments?: string;
  submittedAt: string;
  status: "submitted" | "late" | "reviewed";
}

export function SubmissionsManager({ role }: { role: "admin" | "teacher" }) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const [gradeOpen, setGradeOpen] = useState(false);
  const [gradeTarget, setGradeTarget] = useState<Submission | null>(null);
  const [marksObtained, setMarksObtained] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Assignment[]>("/api/assignments").then((a) => {
      setAssignments(a);
      if (a.length) setSelectedAssignment(a[0]._id);
      else setLoading(false);
    });
  }, []);

  function load() {
    if (!selectedAssignment) return;
    setLoading(true);
    api
      .get<Submission[]>(`/api/submissions?assignmentId=${selectedAssignment}`)
      .then(setSubmissions)
      .finally(() => setLoading(false));
  }

  useEffect(load, [selectedAssignment]);

  const currentAssignment = useMemo(() => assignments.find((a) => a._id === selectedAssignment), [assignments, selectedAssignment]);

  function openGrade(s: Submission) {
    setGradeTarget(s);
    setMarksObtained("");
    setFeedback("");
    setGradeOpen(true);
  }

  async function handleGrade(e: React.FormEvent) {
    e.preventDefault();
    if (!gradeTarget) return;
    setSaving(true);
    try {
      await api.post("/api/marks", {
        submissionId: gradeTarget._id,
        marksObtained: Number(marksObtained),
        feedback,
      });
      toast({ title: "Grade saved." });
      setGradeOpen(false);
      load();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to save grade." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Submissions" description="Review submissions, open files/GitHub links, and grade." />

      <div className="w-full sm:w-80 mb-6 space-y-1.5">
        <Label>Assignment</Label>
        <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
          <SelectTrigger>
            <SelectValue placeholder="Select assignment" />
          </SelectTrigger>
          <SelectContent>
            {assignments.map((a) => (
              <SelectItem key={a._id} value={a._id}>
                {a.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : submissions.length === 0 ? (
            <EmptyState title="No submissions yet" icon={CheckCircle2} />
          ) : (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Links</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((s) => (
                      <TableRow key={s._id}>
                        <TableCell className="font-medium">
                          {s.student.fullName}
                          <div className="text-xs text-muted-foreground">{s.student.studentId}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(s.submittedAt, true)}</TableCell>
                        <TableCell>
                          <StatusBadge status={s.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {s.fileUrl && (
                              <a href={s.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm">
                                <FileText className="h-3.5 w-3.5" /> File
                              </a>
                            )}
                            {s.githubUrl && (
                              <a href={s.githubUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm">
                                <Github className="h-3.5 w-3.5" /> GitHub
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openGrade(s)}>
                            {s.status === "reviewed" ? "Re-grade" : "Grade"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <MobileList>
                {submissions.map((s) => (
                  <MobileCard key={s._id}>
                    <MobileCardHeader
                      actions={
                        <Button variant="outline" size="sm" onClick={() => openGrade(s)}>
                          {s.status === "reviewed" ? "Re-grade" : "Grade"}
                        </Button>
                      }
                    >
                      <p className="font-medium">{s.student.fullName}</p>
                      <p className="text-xs text-muted-foreground">{s.student.studentId}</p>
                    </MobileCardHeader>
                    <MobileField label="Submitted">{formatDate(s.submittedAt, true)}</MobileField>
                    <MobileField label="Status">
                      <StatusBadge status={s.status} />
                    </MobileField>
                    {(s.fileUrl || s.githubUrl) && (
                      <MobileField label="Links">
                        <span className="flex items-center gap-3 justify-end">
                          {s.fileUrl && (
                            <a href={s.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" /> File
                            </a>
                          )}
                          {s.githubUrl && (
                            <a href={s.githubUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                              <Github className="h-3.5 w-3.5" /> GitHub
                            </a>
                          )}
                        </span>
                      </MobileField>
                    )}
                  </MobileCard>
                ))}
              </MobileList>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={gradeOpen} onOpenChange={setGradeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grade submission</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGrade} className="space-y-4">
            <p className="text-sm text-muted-foreground">{gradeTarget?.student.fullName}</p>
            <div className="space-y-2">
              <Label>Marks obtained (out of {currentAssignment?.totalMarks ?? "—"})</Label>
              <Input
                type="number"
                min={0}
                max={currentAssignment?.totalMarks}
                value={marksObtained}
                onChange={(e) => setMarksObtained(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Feedback</Label>
              <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                Save grade
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
