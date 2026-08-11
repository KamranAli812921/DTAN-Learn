import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import { User, Student, Teacher } from "@/models";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8 hour session
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error("Username/email and password are required.");
        }

        await connectDB();

        const identifier = credentials.identifier.trim().toLowerCase();
        const user = await User.findOne({
          $or: [{ username: identifier }, { email: identifier }],
        }).select("+passwordHash");

        if (!user) {
          throw new Error("Invalid credentials.");
        }

        if (user.status !== "active") {
          throw new Error("This account has been deactivated. Contact your administrator.");
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          throw new Error("Invalid credentials.");
        }

        let profileId: string | undefined;
        let fullName: string | undefined;

        if (user.role === "student") {
          const student = await Student.findOne({ user: user._id });
          profileId = student?._id?.toString();
          fullName = student?.fullName;
        } else if (user.role === "teacher") {
          const teacher = await Teacher.findOne({ user: user._id });
          profileId = teacher?._id?.toString();
          fullName = teacher?.fullName;
        }

        return {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status,
          profileId,
          fullName,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.status = user.status;
        token.profileId = user.profileId;
        token.fullName = user.fullName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.role = token.role;
        session.user.status = token.status;
        session.user.profileId = token.profileId;
        session.user.fullName = token.fullName;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
