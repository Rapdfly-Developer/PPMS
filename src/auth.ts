import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/constants";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (creds) => {
        const username = creds?.username as string | undefined;
        const password = creds?.password as string | undefined;
        if (!username || !password) return null;

        // Retry once on DB error — Neon serverless wakes up on first connection
        let user: any;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            user = await prisma.user.findFirst({
              where: { OR: [{ username }, { email: username }] },
              include: { doctor: true, hospitalStaff: { include: { hospital: true } }, refractionist: true },
            });
            break;
          } catch (err: any) {
            console.error(`[auth] DB error (attempt ${attempt}):`, err?.message ?? err);
            if (attempt === 2) return null;
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        let profileId = "";
        let profileName = username;
        let hospitalId: string | undefined;
        let doctorId: string | undefined;

        if (user.role === "DOCTOR" && user.doctor) {
          profileId = user.doctor.id;
          profileName = user.doctor.name;
          doctorId = user.doctor.id;
        } else if (user.role === "HOSPITAL" && user.hospitalStaff) {
          profileId = user.hospitalStaff.id;
          profileName = user.hospitalStaff.name;
          hospitalId = user.hospitalStaff.hospitalId;
        } else if (user.role === "REFRACTIONIST" && user.refractionist) {
          profileId = user.refractionist.id;
          profileName = user.refractionist.name;
          hospitalId = user.refractionist.hospitalId;
          doctorId = user.refractionist.doctorId;
        } else if (user.hospitalStaff) {
          // Custom role (Receptionist, Nurse, etc.) — always stored in HospitalStaff
          profileId = user.hospitalStaff.id;
          profileName = user.hospitalStaff.name;
          hospitalId = user.hospitalStaff.hospitalId;
        }

        // Fetch permissions for this role from DB (Doctor gets wildcard "*")
        let permissions: string[];
        if (user.role === "DOCTOR") {
          permissions = ["*"];
        } else {
          const rolePerms = await prisma.rolePermission.findMany({
            where: { role: user.role },
            include: { permission: { select: { key: true } } },
          });
          permissions = rolePerms.map((rp) => rp.permission.key);
        }

        // Record successful login (fire-and-forget; IP captured separately via /api/auth/track)
        prisma.userLoginHistory.create({
          data: {
            userId: user.id,
            userName: profileName,
            role: user.role,
            hospitalId,
            status: "SUCCESS",
            isActive: true,
          },
        }).catch(() => {});

        return {
          id: user.id,
          name: profileName,
          role: user.role as Role,
          profileId,
          hospitalId,
          doctorId,
          permissions,
        };
      },
    }),
  ],
  events: {
    signOut: async (message: any) => {
      const userId = message?.token?.sub ?? message?.session?.user?.id;
      if (userId) {
        prisma.userLoginHistory.updateMany({
          where: { userId, isActive: true },
          data: { isActive: false, logoutAt: new Date() },
        }).catch(() => {});
      }
    },
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = (user as any).role;
        token.profileId = (user as any).profileId;
        token.hospitalId = (user as any).hospitalId;
        token.doctorId = (user as any).doctorId;
        token.permissions = (user as any).permissions;
      }
      return token;
    },
    session: async ({ session, token }) => {
      (session.user as any).id = token.sub;
      (session.user as any).role = token.role;
      (session.user as any).profileId = token.profileId;
      (session.user as any).hospitalId = token.hospitalId;
      (session.user as any).doctorId = token.doctorId;
      (session.user as any).permissions = token.permissions ?? [];
      return session;
    },
  },
});
