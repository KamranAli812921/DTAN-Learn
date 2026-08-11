import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell role="teacher">{children}</DashboardShell>;
}
