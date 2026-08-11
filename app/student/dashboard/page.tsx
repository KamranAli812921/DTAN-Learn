"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, ClipboardList, ClipboardCheck, Award, Video, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";

interface StudentSummary {
  student: {
    fullName: string;
    course: { courseName: string };
    batch: { batchName: string };
  };
  attendancePercentage: number;
  totalClasses: number;
  totalAssignments: number;
  submittedCount: number;
  pendingCount: number;
  averageMarksPercentage: number | null;
  recentAnnouncements: { _id: string; title: string; message: string; createdAt: string }[];
}

interface LiveClass {
  _id: string;
  topic: string;
  startTime: string;
  durationMinutes: number;
  zoomJoinUrl: string;
  status: "scheduled" | "completed" | "cancelled";
}

function isLiveNow(cls: LiveClass): boolean {
  const start = new Date(cls.startTime).getTime();
  const end = start + cls.durationMinutes * 60_000;
  const now = Date.now();
  return now >= start && now <= end;
}

export default function StudentDashboardPage() {
  const [data, setData] = useState<StudentSummary | null>(null);
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get<StudentSummary>("/api/dashboard/student"), api.get<LiveClass[]>("/api/live-classes")])
      .then(([summary, classes]) => {
        setData(summary);
        // Only classes that haven't ended yet, soonest first.
        const upcoming = classes
          .filter((c) => c.status === "scheduled" && new Date(c.startTime).getTime() + c.durationMinutes * 60_000 > Date.now())
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        setLiveClasses(upcoming);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${data.student.fullName.split(" ")[0]}`}
        description={`${data.student.course?.courseName} · ${data.student.batch?.batchName}`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Attendance" value={`${data.attendancePercentage}%`} icon={CalendarCheck} tone={data.attendancePercentage >= 75 ? "success" : "warning"} />
        <StatCard label="Assignments" value={data.totalAssignments} icon={ClipboardList} />
        <StatCard label="Submitted" value={data.submittedCount} icon={ClipboardCheck} tone="success" />
        <StatCard label="Avg. Marks" value={data.averageMarksPercentage !== null ? `${data.averageMarksPercentage}%` : "—"} icon={Award} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Live classes</CardTitle>
        </CardHeader>
        <CardContent>
          {liveClasses.length === 0 ? (
            <EmptyState title="No live classes scheduled" icon={Video} />
          ) : (
            <ul className="divide-y">
              {liveClasses.map((c) => {
                const live = isLiveNow(c);
                return (
                  <li key={c._id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{c.topic}</p>
                        {live && (
                          <Badge variant="success" className="animate-pulse">
                            Live now
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(c.startTime, true)} · {c.durationMinutes} min
                      </p>
                    </div>
                    <a href={c.zoomJoinUrl} target="_blank" rel="noreferrer">
                      <Button size="sm" variant={live ? "default" : "outline"}>
                        <ExternalLink className="h-3.5 w-3.5" /> Join class
                      </Button>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentAnnouncements.length === 0 ? (
            <EmptyState title="No announcements yet" />
          ) : (
            <ul className="divide-y">
              {data.recentAnnouncements.map((a) => (
                <li key={a._id} className="py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{a.title}</p>
                    <span className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{a.message}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
