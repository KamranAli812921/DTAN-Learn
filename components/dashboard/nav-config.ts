import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Layers,
  CalendarCheck,
  ClipboardList,
  FileCheck2,
  Award,
  FolderOpen,
  Megaphone,
  UserCircle,
  ShieldCheck,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Admins", href: "/admin/admins", icon: ShieldCheck },
  { label: "Students", href: "/admin/students", icon: Users },
  { label: "Teachers", href: "/admin/teachers", icon: GraduationCap },
  { label: "Courses", href: "/admin/courses", icon: BookOpen },
  { label: "Batches", href: "/admin/batches", icon: Layers },
  { label: "Attendance", href: "/admin/attendance", icon: CalendarCheck },
  { label: "Assignments", href: "/admin/assignments", icon: ClipboardList },
  { label: "Submissions", href: "/admin/submissions", icon: FileCheck2 },
  { label: "Results", href: "/admin/results", icon: Award },
  { label: "Materials", href: "/admin/materials", icon: FolderOpen },
  { label: "Announcements", href: "/admin/announcements", icon: Megaphone },
];

export const teacherNav: NavItem[] = [
  { label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
  { label: "Students", href: "/teacher/students", icon: Users },
  { label: "Attendance", href: "/teacher/attendance", icon: CalendarCheck },
  { label: "Assignments", href: "/teacher/assignments", icon: ClipboardList },
  { label: "Submissions", href: "/teacher/submissions", icon: FileCheck2 },
  { label: "Results", href: "/teacher/results", icon: Award },
  { label: "Materials", href: "/teacher/materials", icon: FolderOpen },
  { label: "Announcements", href: "/teacher/announcements", icon: Megaphone },
];

export const studentNav: NavItem[] = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Profile", href: "/student/profile", icon: UserCircle },
  { label: "My Course", href: "/student/course", icon: BookOpen },
  { label: "Attendance", href: "/student/attendance", icon: CalendarCheck },
  { label: "Assignments", href: "/student/assignments", icon: ClipboardList },
  { label: "Results", href: "/student/results", icon: Award },
  { label: "Materials", href: "/student/materials", icon: FolderOpen },
  { label: "Announcements", href: "/student/announcements", icon: Megaphone },
];
