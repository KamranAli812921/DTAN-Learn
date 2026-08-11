import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const roleHome: Record<string, string> = {
  admin: "/admin/dashboard",
  teacher: "/teacher/dashboard",
  student: "/student/dashboard",
};

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect(roleHome[session.user.role] ?? "/login");
  }
  redirect("/login");
}
