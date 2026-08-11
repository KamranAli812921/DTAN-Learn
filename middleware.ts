import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    const role = token?.role as string | undefined;

    const roleHome: Record<string, string> = {
      admin: "/admin/dashboard",
      teacher: "/teacher/dashboard",
      student: "/student/dashboard",
    };

    const roleForPath = (p: string): string | null => {
      if (p.startsWith("/admin")) return "admin";
      if (p.startsWith("/teacher")) return "teacher";
      if (p.startsWith("/student")) return "student";
      return null;
    };

    const requiredRole = roleForPath(pathname);

    if (requiredRole && role !== requiredRole) {
      const home = role ? roleHome[role] : "/login";
      return NextResponse.redirect(new URL(home ?? "/login", req.url));
    }

    if (token?.status !== "active") {
      return NextResponse.redirect(new URL("/login?deactivated=1", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/teacher/:path*", "/student/:path*"],
};
