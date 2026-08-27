"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Video, ExternalLink, Gift, History, ListChecks, UserSearch, Check, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { MobileList, MobileCard, MobileCardHeader, MobileField } from "@/components/shared/mobile-list";
import { StatCard } from "@/components/dashboard/stat-card";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";

interface Batch {
  _id: string;
  batchName: string;
  totalClasses: number;
}
interface Student {
  _id: string;
  fullName: string;
  studentId: string;
}
interface AttendanceSession {
  joinTime: string;
  leaveTime?: string;
  durationMinutes: number;
}
interface AttendanceRecord {
  _id: string;
  student: Student;
  status: "present" | "absent";
  isLate?: boolean;
  source: "zoom" | "manual";
  totalDurationMinutes: number;
  sessions: AttendanceSession[];
  remarks?: string;
  date: string;
}
interface AuditLogEntry {
  _id: string;
  previousStatus: AttendanceRecord["status"];
  newStatus: AttendanceRecord["status"];
  changedBy?: { username: string };
  reason: string;
  createdAt: string;
}
interface UnmatchedEntry {
  _id: string;
  zoomEmail?: string;
  zoomName?: string;
  joinTime: string;
  leaveTime?: string;
}
interface LiveClass {
  _id: string;
  topic: string;
  startTime: string;
  durationMinutes: number;
  zoomJoinUrl: string;
  zoomMeetingId: string;
  status: "scheduled" | "completed" | "cancelled";
}

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Attendance dates are normalized to the UTC day boundary server-side, so a
// session's "date" must be derived the same way, not via the browser's
// local timezone (see lib/attendance-sync.ts's startOfDay).
function toUTCDateInput(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

export function AttendanceManager({ role }: { role: "admin" | "teacher" }) {
  const { toast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedLiveClassId, setSelectedLiveClassId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const [unmatched, setUnmatched] = useState<UnmatchedEntry[]>([]);
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ topic: "", startTime: "", durationMinutes: 60, joinWindowMinutes: 10 });
  const [scheduling, setScheduling] = useState(false);

  const [markOpen, setMarkOpen] = useState(false);
  const [markTarget, setMarkTarget] = useState<{ student: Student; existing?: AttendanceRecord } | null>(null);
  const [markStatus, setMarkStatus] = useState<AttendanceRecord["status"]>("present");
  const [markReason, setMarkReason] = useState("");
  const [marking, setMarking] = useState(false);

  const [graceOpen, setGraceOpen] = useState(false);
  const [graceLiveClassId, setGraceLiveClassId] = useState("");
  const [graceReason, setGraceReason] = useState("");
  const [granting, setGranting] = useState(false);
  const [graceTargetSelected, setGraceTargetSelected] = useState(false);
  const [graceStudentIds, setGraceStudentIds] = useState<string[]>([]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyStudentName, setHistoryStudentName] = useState("");
  const [historyLogs, setHistoryLogs] = useState<AuditLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [totalClassesOpen, setTotalClassesOpen] = useState(false);
  const [totalClassesForm, setTotalClassesForm] = useState(0);
  const [savingTotalClasses, setSavingTotalClasses] = useState(false);

  useEffect(() => {
    api.get<Batch[]>("/api/batches").then((b) => {
      setBatches(b);
      if (b.length && !selectedBatch) setSelectedBatch(b[0]._id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A "session" is one scheduled live class. Attendance is viewed and
  // marked per session, not per calendar date — clicking a session in the
  // "Scheduled live classes" list below loads that class's roster.
  function loadUnmatched(liveClassId: string) {
    if (!liveClassId) {
      setUnmatched([]);
      return;
    }
    api
      .get<UnmatchedEntry[]>(`/api/attendance/unmatched?liveClassId=${liveClassId}`)
      .then(setUnmatched)
      .catch(() => setUnmatched([]));
  }

  function loadBatchData() {
    if (!selectedBatch) return;
    setLoading(true);
    Promise.all([
      api.get<Student[]>(`/api/students?batchId=${selectedBatch}`),
      api.get<LiveClass[]>(`/api/live-classes?batchId=${selectedBatch}`),
    ])
      .then(([s, lc]) => {
        setStudents(s);
        setLiveClasses(lc);
        const stillValid = lc.some((c) => c._id === selectedLiveClassId);
        const target = stillValid ? selectedLiveClassId : lc[0]?._id ?? "";
        setSelectedLiveClassId(target);
        loadUnmatched(target);
        if (target) {
          return api.get<AttendanceRecord[]>(`/api/attendance?liveClassId=${target}`).then(setRecords);
        }
        setRecords([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(loadBatchData, [selectedBatch]);

  function selectSession(liveClassId: string) {
    if (liveClassId === selectedLiveClassId) return;
    setSelectedLiveClassId(liveClassId);
    setLoading(true);
    loadUnmatched(liveClassId);
    api
      .get<AttendanceRecord[]>(`/api/attendance?liveClassId=${liveClassId}`)
      .then(setRecords)
      .finally(() => setLoading(false));
  }

  const recordByStudent = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    records.forEach((r) => map.set(r.student._id, r));
    return map;
  }, [records]);

  const selectedBatchObj = batches.find((b) => b._id === selectedBatch);
  const selectedSession = liveClasses.find((lc) => lc._id === selectedLiveClassId);
  const sessionDateStr = selectedSession ? toUTCDateInput(selectedSession.startTime) : toDateInput(new Date());

  // Grace attendance targets whichever session is picked inside its own
  // dialog — independent of the session currently open in the main view —
  // so admin/teacher can grant it for any specific session, not just the one
  // they happen to be looking at.
  const graceSession = liveClasses.find((lc) => lc._id === graceLiveClassId);
  const graceDateStr = graceSession ? toUTCDateInput(graceSession.startTime) : sessionDateStr;
  const scheduledCount = liveClasses.filter((lc) => lc.status !== "cancelled").length;
  const totalClasses = selectedBatchObj?.totalClasses ?? 0;
  const remainingClasses = totalClasses > 0 ? Math.max(0, totalClasses - scheduledCount) : null;
  const classesCapReached = remainingClasses !== null && remainingClasses <= 0;

  function openTotalClasses() {
    setTotalClassesForm(totalClasses);
    setTotalClassesOpen(true);
  }

  async function handleSaveTotalClasses(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBatch) return;
    setSavingTotalClasses(true);
    try {
      const updated = await api.patch<Batch>(`/api/batches/${selectedBatch}`, { totalClasses: totalClassesForm });
      setBatches((prev) => prev.map((b) => (b._id === selectedBatch ? { ...b, totalClasses: updated.totalClasses } : b)));
      toast({ title: "Total classes updated." });
      setTotalClassesOpen(false);
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to update total classes." });
    } finally {
      setSavingTotalClasses(false);
    }
  }

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBatch) return;
    setScheduling(true);
    try {
      const batch = batches.find((b) => b._id === selectedBatch);
      await api.post("/api/live-classes", {
        batch: selectedBatch,
        course: (batch as any)?.course?._id ?? (batch as any)?.course,
        topic: scheduleForm.topic,
        startTime: new Date(scheduleForm.startTime).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        durationMinutes: Number(scheduleForm.durationMinutes),
        joinWindowMinutes: Number(scheduleForm.joinWindowMinutes),
      });
      toast({ title: "Live class scheduled." });
      setScheduleOpen(false);
      setScheduleForm({ topic: "", startTime: "", durationMinutes: 60, joinWindowMinutes: 10 });
      loadBatchData();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to schedule class." });
    } finally {
      setScheduling(false);
    }
  }

  async function handleSync(liveClassId: string) {
    setSyncingId(liveClassId);
    try {
      const res = await api.post<{ matched: number; unmatched: number; absentMarked: number }>("/api/attendance/zoom-sync", {
        liveClassId,
      });
      toast({
        title: `Synced attendance: ${res.matched} matched, ${res.unmatched} unmatched.`,
        description: res.unmatched > 0
          ? "Unmatched participants are listed below — assign them to a student or ignore them."
          : res.absentMarked > 0
            ? `${res.absentMarked} student(s) who never joined were marked absent.`
            : undefined,
      });
      loadBatchData();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Sync failed." });
    } finally {
      setSyncingId(null);
    }
  }

  async function handleAssignUnmatched(entry: UnmatchedEntry) {
    const studentId = assignSelections[entry._id];
    if (!studentId) {
      toast({ variant: "destructive", title: "Select a student to assign this to first." });
      return;
    }
    setResolvingId(entry._id);
    try {
      await api.patch(`/api/attendance/unmatched/${entry._id}`, {
        action: "resolve",
        student: studentId,
        rememberEmail: true,
      });
      toast({ title: "Assigned.", description: "That student's attendance has been updated, and future syncs from this email will match automatically." });
      setUnmatched((prev) => prev.filter((u) => u._id !== entry._id));
      setAssignSelections((prev) => {
        const next = { ...prev };
        delete next[entry._id];
        return next;
      });
      if (selectedLiveClassId) {
        api.get<AttendanceRecord[]>(`/api/attendance?liveClassId=${selectedLiveClassId}`).then(setRecords);
      }
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to assign." });
    } finally {
      setResolvingId(null);
    }
  }

  async function handleIgnoreUnmatched(entry: UnmatchedEntry) {
    setResolvingId(entry._id);
    try {
      await api.patch(`/api/attendance/unmatched/${entry._id}`, { action: "ignore" });
      setUnmatched((prev) => prev.filter((u) => u._id !== entry._id));
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to ignore." });
    } finally {
      setResolvingId(null);
    }
  }

  function openGrace() {
    setGraceLiveClassId(selectedLiveClassId || liveClasses[0]?._id || "");
    setGraceOpen(true);
  }

  async function handleGrace(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBatch) return;
    if (!graceLiveClassId) {
      toast({ variant: "destructive", title: "Select a session first." });
      return;
    }
    if (graceTargetSelected && graceStudentIds.length === 0) {
      toast({ variant: "destructive", title: "Select at least one student." });
      return;
    }
    setGranting(true);
    try {
      const res = await api.post<{ totalStudents: number; created: number; updated: number; alreadyPresent: number }>(
        "/api/attendance/grace",
        {
          batch: selectedBatch,
          liveClass: graceLiveClassId || undefined,
          date: graceDateStr,
          reason: graceReason,
          students: graceTargetSelected ? graceStudentIds : undefined,
        }
      );
      toast({
        title: "Grace attendance granted.",
        description: `${res.created + res.updated} of ${res.totalStudents} students marked present (${res.alreadyPresent} were already present).`,
      });
      setGraceOpen(false);
      setGraceReason("");
      setGraceTargetSelected(false);
      setGraceStudentIds([]);
      loadBatchData();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to grant grace attendance." });
    } finally {
      setGranting(false);
    }
  }

  function toggleGraceStudent(studentId: string) {
    setGraceStudentIds((prev) => (prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]));
  }

  async function openHistory(student: Student, record: AttendanceRecord) {
    setHistoryStudentName(student.fullName);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const logs = await api.get<AuditLogEntry[]>(`/api/attendance/audit-logs?attendanceId=${record._id}`);
      setHistoryLogs(logs);
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to load override history." });
    } finally {
      setHistoryLoading(false);
    }
  }

  function openMark(student: Student, existing?: AttendanceRecord) {
    setMarkTarget({ student, existing });
    setMarkStatus(existing?.status ?? "present");
    setMarkReason("");
    setMarkOpen(true);
  }

  async function handleMarkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!markTarget) return;
    setMarking(true);
    try {
      if (markTarget.existing) {
        if (!markReason.trim()) {
          toast({ variant: "destructive", title: "A reason is required for manual overrides." });
          setMarking(false);
          return;
        }
        await api.patch(`/api/attendance/${markTarget.existing._id}`, { status: markStatus, reason: markReason });
      } else {
        await api.post("/api/attendance", {
          student: markTarget.student._id,
          batch: selectedBatch,
          liveClass: selectedLiveClassId || undefined,
          date: sessionDateStr,
          status: markStatus,
          remarks: markReason || undefined,
        });
      }
      toast({ title: "Attendance saved." });
      setMarkOpen(false);
      loadBatchData();
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Failed to save attendance." });
    } finally {
      setMarking(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Zoom-synced attendance with manual override support."
        actions={
          <>
            <Dialog open={graceOpen} onOpenChange={(open) => (open ? openGrace() : setGraceOpen(false))}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={!selectedBatch || liveClasses.length === 0} title={liveClasses.length === 0 ? "Schedule a session first." : undefined}>
                  <Gift className="h-4 w-4" /> Grace attendance
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Grant grace attendance</DialogTitle>
                  <DialogDescription>
                    {graceTargetSelected ? (
                      <>
                        Marks the selected students in <strong>{batches.find((b) => b._id === selectedBatch)?.batchName}</strong> as{" "}
                        <strong>present</strong> for the chosen session — useful for rewarding individual students (e.g.
                        those who completed a task/challenge) without penalizing anyone's real attendance record.
                      </>
                    ) : (
                      <>
                        Marks every student in <strong>{batches.find((b) => b._id === selectedBatch)?.batchName}</strong> as{" "}
                        <strong>present</strong> for the chosen session — useful for rewarding a task/challenge without
                        penalizing anyone's real attendance record.
                      </>
                    )}{" "}
                    Students already marked present are left as-is.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleGrace} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Session</Label>
                    <Select value={graceLiveClassId} onValueChange={setGraceLiveClassId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent>
                        {liveClasses.map((lc) => (
                          <SelectItem key={lc._id} value={lc._id}>
                            {lc.topic} — {formatDate(lc.startTime, true)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-3 border rounded-md p-3">
                    <div>
                      <Label className="text-sm">Target specific students</Label>
                      <p className="text-xs text-muted-foreground">
                        Off applies to the whole batch. On lets you pick individual students.
                      </p>
                    </div>
                    <Switch
                      checked={graceTargetSelected}
                      onCheckedChange={(checked) => {
                        setGraceTargetSelected(checked);
                        if (!checked) setGraceStudentIds([]);
                      }}
                    />
                  </div>
                  {graceTargetSelected && (
                    <div className="space-y-2">
                      <Label>Students ({graceStudentIds.length} selected)</Label>
                      {students.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No students in this batch.</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                          {students.map((s) => (
                            <label key={s._id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-input"
                                checked={graceStudentIds.includes(s._id)}
                                onChange={() => toggleGraceStudent(s._id)}
                              />
                              <span>{s.fullName}</span>
                              <span className="text-xs text-muted-foreground">{s.studentId}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Reason (required, shown in the attendance audit trail)</Label>
                    <Textarea
                      value={graceReason}
                      onChange={(e) => setGraceReason(e.target.value)}
                      placeholder="e.g. Bonus attendance for completing the weekend challenge"
                      required
                      minLength={3}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={granting || !graceLiveClassId || (graceTargetSelected && graceStudentIds.length === 0)}
                    >
                      {graceTargetSelected ? `Grant to ${graceStudentIds.length} selected student${graceStudentIds.length === 1 ? "" : "s"}` : "Grant to whole batch"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Button variant="outline" disabled={!selectedBatch} onClick={openTotalClasses}>
              <ListChecks className="h-4 w-4" /> Total classes
            </Button>

            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <DialogTrigger asChild>
                <Button disabled={!selectedBatch || classesCapReached} title={classesCapReached ? "All planned classes for this batch are already scheduled." : undefined}>
                  <Video className="h-4 w-4" /> Schedule live class
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule a Zoom live class</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSchedule} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Topic</Label>
                    <Input value={scheduleForm.topic} onChange={(e) => setScheduleForm({ ...scheduleForm, topic: e.target.value })} required />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start time</Label>
                      <Input
                        type="datetime-local"
                        value={scheduleForm.startTime}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (minutes)</Label>
                      <Input
                        type="number"
                        min={5}
                        value={scheduleForm.durationMinutes}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, durationMinutes: Number(e.target.value) })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Join window (grace minutes before "late")</Label>
                    <Input
                      type="number"
                      min={0}
                      value={scheduleForm.joinWindowMinutes}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, joinWindowMinutes: Number(e.target.value) })}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={scheduling}>
                      Schedule class
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="w-full sm:w-64 space-y-1.5">
          <Label>Batch</Label>
          <Select value={selectedBatch} onValueChange={setSelectedBatch}>
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
      </div>

      {selectedBatch && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <StatCard label="Total classes" value={totalClasses > 0 ? totalClasses : "Uncapped"} icon={ListChecks} />
          <StatCard label="Classes scheduled" value={scheduledCount} icon={Video} />
          <StatCard
            label="Classes remaining"
            value={remainingClasses !== null ? remainingClasses : "—"}
            icon={ListChecks}
            tone={classesCapReached ? "warning" : "default"}
          />
        </div>
      )}

      {liveClasses.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Scheduled live classes</CardTitle>
            <p className="text-sm text-muted-foreground">Click a session to view and mark its attendance below.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {liveClasses.map((lc) => {
              const isSelected = lc._id === selectedLiveClassId;
              return (
                <div
                  key={lc._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectSession(lc._id)}
                  onKeyDown={(e) => e.key === "Enter" && selectSession(lc._id)}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-md p-3 cursor-pointer transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm break-words">{lc.topic}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <span>
                        {formatDate(lc.startTime, true)} · {lc.durationMinutes} min
                      </span>
                      <StatusBadge status={lc.status} />
                      {isSelected && <Badge variant="outline">Selected</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={lc.zoomJoinUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-3.5 w-3.5" /> Join URL
                      </Button>
                    </a>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSync(lc._id);
                      }}
                      disabled={syncingId === lc._id}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncingId === lc._id ? "animate-spin" : ""}`} /> Sync attendance
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {unmatched.length > 0 && (
        <Card className="mb-6 border-amber-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserSearch className="h-4 w-4" /> Unmatched Zoom participants ({unmatched.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              These joined the Zoom session but their email doesn&apos;t match any student account — ask the student which
              email they joined with, then assign them below. They currently count as absent.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {unmatched.map((entry) => (
              <div key={entry._id} className="flex flex-col sm:flex-row sm:items-center gap-3 border rounded-md p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm break-words">{entry.zoomName || "Unknown name"}</p>
                  <p className="text-xs text-muted-foreground break-words">{entry.zoomEmail || "No email reported"}</p>
                  <p className="text-xs text-muted-foreground">Joined {formatDate(entry.joinTime, true)}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select
                    value={assignSelections[entry._id] ?? ""}
                    onValueChange={(v) => setAssignSelections((prev) => ({ ...prev, [entry._id]: v }))}
                  >
                    <SelectTrigger className="w-full sm:w-56">
                      <SelectValue placeholder="Assign to student…" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.fullName} ({s.studentId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => handleAssignUnmatched(entry)}
                    disabled={resolvingId === entry._id || !assignSelections[entry._id]}
                  >
                    <Check className="h-3.5 w-3.5" /> Assign
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleIgnoreUnmatched(entry)}
                    disabled={resolvingId === entry._id}
                  >
                    <X className="h-3.5 w-3.5" /> Ignore
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{selectedSession ? `Attendance — ${selectedSession.topic}` : "Attendance"}</CardTitle>
          {selectedSession && (
            <p className="text-sm text-muted-foreground">
              {formatDate(selectedSession.startTime, true)} · {selectedSession.durationMinutes} min
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : liveClasses.length === 0 ? (
            <EmptyState title="No sessions scheduled yet" description="Schedule a live class to start recording attendance." icon={Video} />
          ) : students.length === 0 ? (
            <EmptyState title="No students in this batch" />
          ) : (
            <>
              <div className="hidden sm:block">
                <Accordion type="multiple" className="px-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((s) => {
                        const record = recordByStudent.get(s._id);
                        return (
                          <TableRow key={s._id} className="align-top">
                            <TableCell className="font-medium">
                              {s.fullName}
                              <div className="text-xs text-muted-foreground">{s.studentId}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <StatusBadge status={record?.status ?? "absent"} />
                                {record?.isLate && <StatusBadge status="late" />}
                              </div>
                              {record?.remarks && (
                                <p className="text-xs text-muted-foreground mt-1 max-w-[220px] break-words">
                                  {record.remarks}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="capitalize text-sm text-muted-foreground">{record?.source ?? "—"}</TableCell>
                            <TableCell>
                              {record && record.sessions?.length > 0 ? (
                                <AccordionItem value={s._id} className="border-none">
                                  <AccordionTrigger className="py-0 text-sm hover:no-underline">
                                    {record.totalDurationMinutes} min ({record.sessions.length} session{record.sessions.length > 1 ? "s" : ""})
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <ul className="space-y-1 text-xs text-muted-foreground">
                                      {record.sessions.map((sess, i) => (
                                        <li key={i} className="flex gap-2">
                                          <span>{formatDate(sess.joinTime, true)}</span>
                                          <span>→</span>
                                          <span>{sess.leaveTime ? formatDate(sess.leaveTime, true) : "still connected"}</span>
                                          <span className="font-medium text-foreground">{sess.durationMinutes} min</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </AccordionContent>
                                </AccordionItem>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              {record && (
                                <Button variant="ghost" size="sm" onClick={() => openHistory(s, record)} title="View override history">
                                  <History className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => openMark(s, record)}>
                                {record ? "Override" : "Mark"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Accordion>
              </div>

              <MobileList>
                <Accordion type="multiple">
                  {students.map((s) => {
                    const record = recordByStudent.get(s._id);
                    return (
                      <MobileCard key={s._id} className="space-y-3">
                        <MobileCardHeader
                          actions={
                            <div className="flex items-center gap-2">
                              {record && (
                                <Button variant="ghost" size="sm" onClick={() => openHistory(s, record)} title="View override history">
                                  <History className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => openMark(s, record)}>
                                {record ? "Override" : "Mark"}
                              </Button>
                            </div>
                          }
                        >
                          <p className="font-medium">{s.fullName}</p>
                          <p className="text-xs text-muted-foreground">{s.studentId}</p>
                        </MobileCardHeader>
                        <MobileField label="Status">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <StatusBadge status={record?.status ?? "absent"} />
                            {record?.isLate && <StatusBadge status="late" />}
                          </div>
                        </MobileField>
                        {record?.remarks && (
                          <MobileField label="Reason">
                            <span className="text-xs break-words">{record.remarks}</span>
                          </MobileField>
                        )}
                        <MobileField label="Source">
                          <span className="capitalize">{record?.source ?? "—"}</span>
                        </MobileField>
                        {record && record.sessions?.length > 0 ? (
                          <AccordionItem value={s._id} className="border-none -mx-1">
                            <AccordionTrigger className="py-0 text-sm hover:no-underline justify-between px-1">
                              <span className="text-muted-foreground">Duration</span>
                              <span className="font-medium text-foreground mr-auto ml-2">
                                {record.totalDurationMinutes} min ({record.sessions.length} session{record.sessions.length > 1 ? "s" : ""})
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-1">
                              <ul className="space-y-1 text-xs text-muted-foreground">
                                {record.sessions.map((sess, i) => (
                                  <li key={i} className="flex flex-wrap gap-x-2">
                                    <span>{formatDate(sess.joinTime, true)}</span>
                                    <span>→</span>
                                    <span>{sess.leaveTime ? formatDate(sess.leaveTime, true) : "still connected"}</span>
                                    <span className="font-medium text-foreground">{sess.durationMinutes} min</span>
                                  </li>
                                ))}
                              </ul>
                            </AccordionContent>
                          </AccordionItem>
                        ) : (
                          <MobileField label="Duration">—</MobileField>
                        )}
                      </MobileCard>
                    );
                  })}
                </Accordion>
              </MobileList>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={markOpen} onOpenChange={setMarkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{markTarget?.existing ? "Override attendance" : "Mark attendance"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMarkSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">{markTarget?.student.fullName}</p>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={markStatus} onValueChange={(v) => setMarkStatus(v as AttendanceRecord["status"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{markTarget?.existing ? "Reason for override (required)" : "Remarks (optional)"}</Label>
              <Textarea value={markReason} onChange={(e) => setMarkReason(e.target.value)} required={!!markTarget?.existing} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={marking}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override history</DialogTitle>
            <DialogDescription>{historyStudentName}</DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : historyLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No manual overrides recorded for this attendance entry.</p>
          ) : (
            <ul className="space-y-3 max-h-96 overflow-y-auto">
              {historyLogs.map((log) => (
                <li key={log._id} className="border rounded-md p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={log.previousStatus} />
                      <span className="text-muted-foreground">→</span>
                      <StatusBadge status={log.newStatus} />
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(log.createdAt, true)}</span>
                  </div>
                  <p className="break-words">{log.reason}</p>
                  <p className="text-xs text-muted-foreground">By {log.changedBy?.username ?? "unknown"}</p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={totalClassesOpen} onOpenChange={setTotalClassesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Total classes</DialogTitle>
            <DialogDescription>
              Planned number of live classes for <strong>{selectedBatchObj?.batchName}</strong>. Scheduling is blocked once this
              many classes have been scheduled. Set to 0 for no limit.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTotalClasses} className="space-y-4">
            <div className="space-y-2">
              <Label>Total classes</Label>
              <Input
                type="number"
                min={0}
                value={totalClassesForm}
                onChange={(e) => setTotalClassesForm(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">{scheduledCount} already scheduled.</p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingTotalClasses}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
