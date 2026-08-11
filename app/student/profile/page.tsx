"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client-api";
import { formatDate, initials } from "@/lib/utils";

interface StudentProfile {
  fullName: string;
  studentId: string;
  phone?: string;
  enrollmentDate: string;
  course: { courseName: string; courseCode: string };
  batch: { batchName: string };
  user: { username: string; email: string };
}

export default function StudentProfilePage() {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<StudentProfile[]>("/api/students")
      .then((list) => setStudent(list[0] ?? null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="My Profile" description="Your account and enrollment details." />
      {loading ? (
        <Skeleton className="h-64" />
      ) : !student ? (
        <p className="text-muted-foreground">Profile not found.</p>
      ) : (
        <Card className="max-w-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">{initials(student.fullName)}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-lg font-semibold">{student.fullName}</h2>
                <p className="text-sm text-muted-foreground">{student.studentId}</p>
              </div>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{student.user.email}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Username</dt>
                <dd className="font-medium">{student.user.username}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="font-medium">{student.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Enrolled on</dt>
                <dd className="font-medium">{formatDate(student.enrollmentDate)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Course</dt>
                <dd className="font-medium">
                  {student.course?.courseCode} — {student.course?.courseName}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Batch</dt>
                <dd className="font-medium">{student.batch?.batchName}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
