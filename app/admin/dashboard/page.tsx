"use client";

import { useEffect, useState } from "react";
import { Users, GraduationCap, BookOpen, Layers, ClipboardList, FileClock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

interface AdminSummary {
  totalStudents: number;
  totalTeachers: number;
  activeCourses: number;
  activeBatches: number;
  totalAssignments: number;
  pendingSubmissions: number;
  studentsByCourse: { name: string; count: number }[];
  attendanceOverview: { status: string; count: number }[];
  recentAnnouncements: { _id: string; title: string; message: string; createdAt: string }[];
}

const ATTENDANCE_COLORS: Record<string, string> = {
  present: "#0f9c86", // matches the --success token (teal-green, distinct from the primary brand green)
  absent: "#dc2626",
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AdminSummary>("/api/dashboard/admin")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <PageHeader title="Admin Dashboard" description="System-wide overview of DTAN Learn." />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Students" value={data.totalStudents} icon={Users} />
        <StatCard label="Total Teachers" value={data.totalTeachers} icon={GraduationCap} />
        <StatCard label="Active Courses" value={data.activeCourses} icon={BookOpen} />
        <StatCard label="Active Batches" value={data.activeBatches} icon={Layers} />
        <StatCard label="Total Assignments" value={data.totalAssignments} icon={ClipboardList} />
        <StatCard label="Pending Submissions" value={data.pendingSubmissions} icon={FileClock} tone="warning" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Students by course</CardTitle>
          </CardHeader>
          <CardContent>
            {data.studentsByCourse.length === 0 ? (
              <EmptyState title="No enrollment data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.studentsByCourse}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(123 44% 34%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance overview</CardTitle>
          </CardHeader>
          <CardContent>
            {data.attendanceOverview.length === 0 ? (
              <EmptyState title="No attendance recorded yet" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={data.attendanceOverview} dataKey="count" nameKey="status" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {data.attendanceOverview.map((entry) => (
                      <Cell key={entry.status} fill={ATTENDANCE_COLORS[entry.status] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

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
