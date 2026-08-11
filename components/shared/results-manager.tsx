"use client";

import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { MobileList, MobileCard, MobileCardHeader, MobileField } from "@/components/shared/mobile-list";
import { api } from "@/lib/client-api";
import { formatDate, percentage } from "@/lib/utils";

interface Assignment {
  _id: string;
  title: string;
  totalMarks: number;
  dueDate: string;
}
interface Mark {
  _id: string;
  student: { fullName: string; studentId: string };
  assignment: Assignment;
  marksObtained: number;
  feedback?: string;
  gradedAt: string;
}

export function ResultsManager() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState("all");
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Assignment[]>("/api/assignments").then(setAssignments);
  }, []);

  function load() {
    setLoading(true);
    const url = selectedAssignment === "all" ? "/api/marks" : `/api/marks?assignmentId=${selectedAssignment}`;
    api
      .get<Mark[]>(url)
      .then(setMarks)
      .finally(() => setLoading(false));
  }

  useEffect(load, [selectedAssignment]);

  return (
    <div>
      <PageHeader title="Results" description="Graded assignment results." />

      <div className="w-full sm:w-80 mb-6 space-y-1.5">
        <Label>Assignment</Label>
        <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignments</SelectItem>
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
          ) : marks.length === 0 ? (
            <EmptyState title="No graded results yet" icon={Award} />
          ) : (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Marks</TableHead>
                      <TableHead>Percentage</TableHead>
                      <TableHead>Feedback</TableHead>
                      <TableHead>Graded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {marks.map((m) => (
                      <TableRow key={m._id}>
                        <TableCell className="font-medium">
                          {m.student.fullName}
                          <div className="text-xs text-muted-foreground">{m.student.studentId}</div>
                        </TableCell>
                        <TableCell>{m.assignment.title}</TableCell>
                        <TableCell>
                          {m.marksObtained} / {m.assignment.totalMarks}
                        </TableCell>
                        <TableCell>{percentage(m.marksObtained, m.assignment.totalMarks)}%</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs">{m.feedback || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(m.gradedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <MobileList>
                {marks.map((m) => (
                  <MobileCard key={m._id}>
                    <MobileCardHeader>
                      <p className="font-medium">{m.student.fullName}</p>
                      <p className="text-xs text-muted-foreground">{m.student.studentId}</p>
                    </MobileCardHeader>
                    <MobileField label="Assignment">{m.assignment.title}</MobileField>
                    <MobileField label="Marks">
                      {m.marksObtained} / {m.assignment.totalMarks}
                    </MobileField>
                    <MobileField label="Percentage">{percentage(m.marksObtained, m.assignment.totalMarks)}%</MobileField>
                    {m.feedback && <MobileField label="Feedback">{m.feedback}</MobileField>}
                    <MobileField label="Graded">{formatDate(m.gradedAt)}</MobileField>
                  </MobileCard>
                ))}
              </MobileList>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
