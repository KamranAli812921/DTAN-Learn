"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { MobileList, MobileCard, MobileCardHeader, MobileField } from "@/components/shared/mobile-list";
import { StatCard } from "@/components/dashboard/stat-card";
import { CalendarCheck } from "lucide-react";
import { api } from "@/lib/client-api";
import { formatDate, percentage } from "@/lib/utils";

interface AttendanceSession {
  joinTime: string;
  leaveTime?: string;
  durationMinutes: number;
}
interface AttendanceRecord {
  _id: string;
  date: string;
  status: "present" | "absent" | "late" | "excused";
  source: "zoom" | "manual";
  totalDurationMinutes: number;
  sessions: AttendanceSession[];
  remarks?: string;
}

export default function StudentAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AttendanceRecord[]>("/api/attendance")
      .then(setRecords)
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const present = records.filter((r) => r.status === "present" || r.status === "late").length;
    return { total: records.length, present, pct: percentage(present, records.length) };
  }, [records]);

  return (
    <div>
      <PageHeader title="My Attendance" description="Your attendance history, including Zoom session detail." />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Attendance %" value={`${stats.pct}%`} icon={CalendarCheck} tone={stats.pct >= 75 ? "success" : "warning"} />
        <StatCard label="Classes attended" value={stats.present} icon={CalendarCheck} />
        <StatCard label="Total classes" value={stats.total} icon={CalendarCheck} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <EmptyState title="No attendance records yet" />
          ) : (
            <>
              <div className="hidden sm:block">
                <Accordion type="multiple" className="px-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r) => (
                        <TableRow key={r._id} className="align-top">
                          <TableCell className="font-medium">{formatDate(r.date)}</TableCell>
                          <TableCell>
                            <StatusBadge status={r.status} />
                          </TableCell>
                          <TableCell>
                            {r.sessions?.length > 0 ? (
                              <AccordionItem value={r._id} className="border-none">
                                <AccordionTrigger className="py-0 text-sm hover:no-underline">
                                  {r.totalDurationMinutes} min ({r.sessions.length} session{r.sessions.length > 1 ? "s" : ""})
                                </AccordionTrigger>
                                <AccordionContent>
                                  <ul className="space-y-1 text-xs text-muted-foreground">
                                    {r.sessions.map((s, i) => (
                                      <li key={i} className="flex gap-2">
                                        <span>{formatDate(s.joinTime, true)}</span>
                                        <span>→</span>
                                        <span>{s.leaveTime ? formatDate(s.leaveTime, true) : "still connected"}</span>
                                        <span className="font-medium text-foreground">{s.durationMinutes} min</span>
                                      </li>
                                    ))}
                                  </ul>
                                </AccordionContent>
                              </AccordionItem>
                            ) : (
                              <span className="text-sm text-muted-foreground">{r.remarks || "—"}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Accordion>
              </div>

              <MobileList>
                <Accordion type="multiple">
                  {records.map((r) => (
                    <MobileCard key={r._id} className="space-y-3">
                      <MobileCardHeader>
                        <p className="font-medium">{formatDate(r.date)}</p>
                      </MobileCardHeader>
                      <MobileField label="Status">
                        <StatusBadge status={r.status} />
                      </MobileField>
                      {r.sessions?.length > 0 ? (
                        <AccordionItem value={r._id} className="border-none -mx-1">
                          <AccordionTrigger className="py-0 text-sm hover:no-underline justify-between px-1">
                            <span className="text-muted-foreground">Duration</span>
                            <span className="font-medium text-foreground mr-auto ml-2">
                              {r.totalDurationMinutes} min ({r.sessions.length} session{r.sessions.length > 1 ? "s" : ""})
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="px-1">
                            <ul className="space-y-1 text-xs text-muted-foreground">
                              {r.sessions.map((s, i) => (
                                <li key={i} className="flex flex-wrap gap-x-2">
                                  <span>{formatDate(s.joinTime, true)}</span>
                                  <span>→</span>
                                  <span>{s.leaveTime ? formatDate(s.leaveTime, true) : "still connected"}</span>
                                  <span className="font-medium text-foreground">{s.durationMinutes} min</span>
                                </li>
                              ))}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      ) : (
                        <MobileField label="Duration">{r.remarks || "—"}</MobileField>
                      )}
                    </MobileCard>
                  ))}
                </Accordion>
              </MobileList>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
