import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/constants";

/* ── Shared: fetch user with all profile relations ────────────────────── */
async function fetchUserWithRelations(where: Parameters<typeof prisma.user.findFirst>[0]["where"]) {
  return prisma.user.findFirst({
    where,
    include: {
      doctor: true,
      hospitalStaff: { include: { hospital: true } },
      refractionist: true,
    },
  });
}

/* ── Shared: look up user record by mobile number ─────────────────────── */
async function findUserByMobile(mobile: string) {
  const doctor = await prisma.doctor.findFirst({
    where: { contact: mobile },
    select: { userId: true },
  });
  if (doctor?.userId) {
    const u = await fetchUserWithRelations({ id: doctor.userId, active: true });
    if (u) return u;
  }

  const staff = await prisma.hospitalStaff.findFirst({
    where: { mobile },
    select: { userId: true },
  });
  if (staff?.userId) {
    return fetchUserWithRelations({ id: staff.userId, active: true });
  }

  return null;
}

/* ── Shared: build the JWT payload from a resolved user row ───────────── */
async function buildPayload(user: NonNullable<Awaited<ReturnType<typeof fetchUserWithRelations>>>) {
  let profileId = "";
  let profileName = user.username;
  let hospitalId: string | undefined;
  let doctorId: string | undefined;

  if (user.role === "DOCTOR" && user.doctor) {
    profileId = user.doctor.id;
    profileName = user.doctor.name;
    doctorId = user.doctor.id;
  } else if (user.hospitalStaff) {
    profileId = user.hospitalStaff.id;
    profileName = user.hospitalStaff.name;
    hospitalId = user.hospitalStaff.hospitalId;
  }

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

  return {
    id: user.id,
    name: profileName,
    username: user.username,
    role: user.role as Role,
    profileId,
    hospitalId,
    doctorId,
    permissions,
  };
}

/* ── Auth config ──────────────────────────────────────────────────────── */
export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [

    /* ── 1. Username + password ── */
    Credentials({
      id: "credentials",
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (creds) => {
        const username = creds?.username as string | undefined;
        const password = creds?.password as string | undefined;
        if (!username || !password) return null;

        let user: Awaited<ReturnType<typeof fetchUserWithRelations>> = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            user = await fetchUserWithRelations({
              OR: [{ username }, { email: username }],
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

        const payload = await buildPayload(user);

        prisma.userLoginHistory.create({
          data: {
            userId: user.id,
            userName: payload.name,
            role: user.role,
            hospitalId: payload.hospitalId,
            status: "SUCCESS",
            isActive: true,
          },
        }).catch(() => {});

        return payload;
      },
    }),

    /* ── 2. Mobile OTP — exchange a verified loginToken for a session ── */
    Credentials({
      id: "mobile-otp",
      credentials: { token: { label: "Login Token" } },
      authorize: async (creds) => {
        const token = creds?.token as string | undefined;
        if (!token) return null;

        const record = await prisma.mobileOtp.findFirst({
          where: {
            loginToken: token,
            used: false,
            tokenExpAt: { gt: new Date() },
          },
        });
        if (!record) return null;

        // Single-use: mark consumed immediately
        await prisma.mobileOtp.update({
          where: { id: record.id },
          data: { used: true },
        });

        const user = await findUserByMobile(record.mobile);
        if (!user) return null;

        const payload = await buildPayload(user);

        prisma.userLoginHistory.create({
          data: {
            userId: user.id,
            userName: payload.name,
            role: user.role,
            hospitalId: payload.hospitalId,
            status: "SUCCESS",
            isActive: true,
          },
        }).catch(() => {});

        return payload;
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
        token.role       = (user as any).role;
        token.username   = (user as any).username;
        token.profileId  = (user as any).profileId;
        token.hospitalId = (user as any).hospitalId;
        token.doctorId   = (user as any).doctorId;
        token.permissions = (user as any).permissions;
      }
      return token;
    },
    session: async ({ session, token }) => {
      (session.user as any).id          = token.sub;
      (session.user as any).role        = token.role;
      (session.user as any).username    = token.username;
      (session.user as any).profileId   = token.profileId;
      (session.user as any).hospitalId  = token.hospitalId;
      (session.user as any).doctorId    = token.doctorId;
      (session.user as any).permissions = token.permissions ?? [];
      return session;
    },
  },
});
