"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/utils";

interface Course {
  courseCode: string;
  courseName: string;
  description?: string;
  duration?: string;
}
interface Batch {
  _id: string;
  batchName: string;
  startDate: string;
  endDate?: string;
  status: string;
  teacher: { fullName: string; teacherId: string };
}

export default function StudentCoursePage() {
  const [course, setCourse] = useState<Course | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<any[]>("/api/students")
      .then(async (list) => {
        const student = list[0];
        if (!student) return;
        setCourse(student.course);
        const batchDetail = await api.get<Batch>(`/api/batches/${student.batch._id}`);
        setBatch(batchDetail);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="My Course" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My Course" description="Details about your enrolled course and batch." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{course?.courseName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{course?.description || "No description provided."}</p>
            <div className="flex gap-6 pt-2">
              <div>
                <p className="text-muted-foreground text-xs">Course code</p>
                <p className="font-medium">{course?.courseCode}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Duration</p>
                <p className="font-medium">{course?.duration || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{batch?.batchName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              {batch && <StatusBadge status={batch.status} />}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Schedule</span>
              <span className="font-medium">
                {batch && formatDate(batch.startDate)} {batch?.endDate ? `– ${formatDate(batch.endDate)}` : ""}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Teacher</span>
              <span className="font-medium">{batch?.teacher?.fullName}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
