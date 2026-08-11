import type { UserRole, UserStatus } from "@/models/User";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    username: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    profileId?: string;
    fullName?: string;
  }

  interface Session {
    user: {
      id: string;
      username: string;
      email: string;
      role: UserRole;
      status: UserStatus;
      profileId?: string;
      fullName?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: UserRole;
    status: UserStatus;
    profileId?: string;
    fullName?: string;
  }
}
