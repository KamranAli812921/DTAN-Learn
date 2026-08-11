"use client";

import { useEffect, useState } from "react";
import { Layers, Users, ClipboardList, FileClock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";

interface TeacherSummary {
  totalBatches: number;
  myBatches: { _id: string; batchName: string; course: { courseName: string }; status: string }[];
  totalStudents: number;
  recentAssignments: { _id: string; title: string; dueDate: string; batch: { batchName: string } }[];
  pendingReviews: number;
  recentAnnouncements: { _id: string; title: string; message: string; createdAt: string }[];
}

export default function TeacherDashboardPage() {
  const [data, setData] = useState<TeacherSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<TeacherSummary>("/api/dashboard/teacher")
      .then(setData)
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
      <PageHeader title="Teacher Dashboard" description="Your batches, students, and pending work at a glance." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="My Batches" value={data.totalBatches} icon={Layers} />
        <StatCard label="Total Students" value={data.totalStudents} icon={Users} />
        <StatCard label="Recent Assignments" value={data.recentAssignments.length} icon={ClipboardList} />
        <StatCard label="Pending Reviews" value={data.pendingReviews} icon={FileClock} tone="warning" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>My batches</CardTitle>
          </CardHeader>
          <CardContent>
            {data.myBatches.length === 0 ? (
              <EmptyState title="No batches assigned yet" />
            ) : (
              <ul className="divide-y">
                {data.myBatches.map((b) => (
                  <li key={b._id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{b.batchName}</p>
                      <p className="text-xs text-muted-foreground">{b.course?.courseName}</p>
                    </div>
                    <StatusBadge status={b.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentAssignments.length === 0 ? (
              <EmptyState title="No assignments yet" />
            ) : (
              <ul className="divide-y">
                {data.recentAssignments.map((a) => (
                  <li key={a._id} className="py-3">
                    <p className="font-medium text-sm">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.batch?.batchName} · Due {formatDate(a.dueDate)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
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
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.message}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
