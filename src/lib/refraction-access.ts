import { userCan, type SessionUser } from "@/lib/rbac";

/** Doctors, or staff granted Record / Edit Refraction, may enter VA, refraction, colour vision and IOP. */
export function canRecordRefraction(user: SessionUser): boolean {
  return user.role === "DOCTOR"
    || userCan(user, "refraction.create") || userCan(user, "refraction.edit")
    || userCan(user, "emr.refraction.edit");
}
