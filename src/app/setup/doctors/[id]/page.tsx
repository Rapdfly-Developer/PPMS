import { requireSuperAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Stethoscope, Building2, KeyRound,
  Phone, Mail, Hash, Award, BadgeCheck,
  Clock, Monitor, ShieldCheck, CalendarDays, AlertTriangle, Eye,
} from "lucide-react";

function fmt(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
        <span className="text-teal-600">{icon}</span>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">{children}</div>;
}

function InfoRow({
  label, value, mono, icon,
}: {
  label: string; value?: string | null; mono?: boolean; icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className={`text-sm text-slate-700 ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
      </div>
    </div>
  );
}

export default async function DoctorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const doctor = await prisma.doctor.findUnique({
    where: { id },
    include: {
      user: { select: { username: true, active: true, role: true, email: true } },
      hospitalLinks: {
        include: {
          hospital: { select: { id: true, name: true, shortCode: true, contact: true, address: true } },
        },
        orderBy: { hospital: { name: "asc" } },
      },
      license: true,
    },
  });

  if (!doctor) notFound();

  const lic = doctor.license;
  const now = new Date();

  const hasKey = !!lic?.licenseKey;
  const licActive = hasKey && lic!.isActive && !!lic!.subscriptionEndsAt && lic!.subscriptionEndsAt > now;
  const licExpired = hasKey && (!lic!.isActive || !lic!.subscriptionEndsAt || lic!.subscriptionEndsAt <= now);
  const isTrial = !hasKey && !!lic?.trialEndsAt && lic.trialEndsAt > now;
  const trialExpired = !hasKey && !!lic?.trialEndsAt && lic.trialEndsAt <= now;
  const daysRemaining = licActive ? Math.ceil((lic!.subscriptionEndsAt!.getTime() - now.getTime()) / 86_400_000) : 0;
  const urgent = licActive && daysRemaining <= 7;
  const warning = licActive && daysRemaining <= 30 && !urgent;

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(135deg, #f0fdfa 0%, #e6fffa 30%, #f8fafc 70%, #ffffff 100%)" }}
    >
      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-4 md:px-8 py-4 border-b border-slate-200/60 backdrop-blur-sm"
        style={{ background: "rgba(255,255,255,0.7)" }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #0f766e, #14b8a6)" }}
        >
          <Eye size={16} className="text-white" />
        </div>
        <span className="font-bold text-slate-800 text-sm">PPMS</span>
        <span className="text-slate-300">/</span>
        <Link href="/setup" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">Setup</Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-700 font-medium truncate">{doctor.name}</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-6">
        {/* Back link */}
        <Link
          href="/setup"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors w-fit"
        >
          <ArrowLeft size={15} />
          Back to Doctor&apos;s Login
        </Link>

        {/* ── Hero header card ── */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 flex items-start gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0"
            style={{ background: "linear-gradient(135deg, #0f766e, #14b8a6)" }}
          >
            {initials(doctor.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">{doctor.name}</h1>
            {doctor.specialty && (
              <p className="text-sm text-slate-500 mt-0.5">{doctor.specialty}</p>
            )}
            <p className="text-xs text-slate-400 font-mono mt-0.5">@{doctor.user.username}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {/* Login status */}
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                doctor.user.active
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-red-50 text-red-600 border-red-200"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${doctor.user.active ? "bg-emerald-500" : "bg-red-500"}`} />
                {doctor.user.active ? "Login Active" : "Login Disabled"}
              </span>
              {/* License badge */}
              {licActive && !urgent && !warning && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  License Active · {daysRemaining}d
                </span>
              )}
              {urgent && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Expires in {daysRemaining}d — Urgent
                </span>
              )}
              {warning && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  License · {daysRemaining}d left
                </span>
              )}
              {isTrial && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Trial Active
                </span>
              )}
              {trialExpired && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Trial Expired
                </span>
              )}
              {licExpired && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  License Expired
                </span>
              )}
              {!hasKey && !isTrial && !trialExpired && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  No License
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Profile ── */}
        <Section title="Profile" icon={<Stethoscope size={16} />}>
          <Grid>
            <InfoRow label="Full Name" value={doctor.name} />
            <InfoRow label="Username" value={`@${doctor.user.username}`} mono />
            <InfoRow label="Role" value={doctor.user.role} />
            <InfoRow label="Short Code" value={doctor.shortCode} mono />
            <InfoRow label="Specialty" value={doctor.specialty} />
            <InfoRow
              label="Contact"
              value={doctor.contact}
              icon={<Phone size={12} className="text-slate-400 shrink-0" />}
            />
            <InfoRow
              label="Email"
              value={doctor.email ?? doctor.user.email}
              icon={<Mail size={12} className="text-slate-400 shrink-0" />}
            />
            <InfoRow
              label="Medical Reg. No."
              value={doctor.medicalRegNumber}
              icon={<Hash size={12} className="text-slate-400 shrink-0" />}
            />
            <InfoRow
              label="Qualifications"
              value={doctor.qualifications}
              icon={<Award size={12} className="text-slate-400 shrink-0" />}
            />
            <InfoRow
              label="Credentials"
              value={doctor.credentials}
              icon={<BadgeCheck size={12} className="text-slate-400 shrink-0" />}
            />
            <InfoRow label="Experience" value={doctor.experience} />
            <InfoRow
              label="Account Created"
              value={fmt(doctor.createdAt)}
              icon={<CalendarDays size={12} className="text-slate-400 shrink-0" />}
            />
          </Grid>
        </Section>

        {/* ── Linked Hospitals ── */}
        <Section title={`Linked Hospitals (${doctor.hospitalLinks.length})`} icon={<Building2 size={16} />}>
          {doctor.hospitalLinks.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No hospitals linked to this doctor.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {doctor.hospitalLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Building2 size={14} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{link.hospital.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Code: <span className="font-mono">{link.hospital.shortCode}</span>
                      {link.hospital.contact && (
                        <span className="ml-3">{link.hospital.contact}</span>
                      )}
                      {link.hospital.address && (
                        <span className="ml-3 truncate">{link.hospital.address}</span>
                      )}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${
                    link.active
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-400 border-slate-200"
                  }`}>
                    <span className={`w-1 h-1 rounded-full ${link.active ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {link.active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── License ── */}
        <Section title="License Details" icon={<KeyRound size={16} />}>
          {/* Status banner */}
          {licActive && !urgent && !warning && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-emerald-50 border border-emerald-200 mb-5">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">License is Active</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {daysRemaining} days remaining · expires {fmt(lic?.subscriptionEndsAt)}
                </p>
              </div>
            </div>
          )}
          {urgent && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-red-50 border border-red-200 mb-5">
              <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">License Expiring Soon — {daysRemaining} days</p>
                <p className="text-xs text-red-700 mt-0.5">Renew before {fmt(lic?.subscriptionEndsAt)} to avoid interruption.</p>
              </div>
            </div>
          )}
          {warning && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-amber-50 border border-amber-200 mb-5">
              <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">License Active — {daysRemaining} days remaining</p>
                <p className="text-xs text-amber-700 mt-0.5">Consider renewing before {fmt(lic?.subscriptionEndsAt)}.</p>
              </div>
            </div>
          )}
          {isTrial && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-amber-50 border border-amber-200 mb-5">
              <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Trial Period Active</p>
                <p className="text-xs text-amber-700 mt-0.5">Trial ends {fmt(lic?.trialEndsAt)}. Activate a license key to continue after trial.</p>
              </div>
            </div>
          )}
          {trialExpired && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-orange-50 border border-orange-200 mb-5">
              <AlertTriangle size={16} className="text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-800">Trial Expired — License Required</p>
                <p className="text-xs text-orange-700 mt-0.5">Trial ended {fmt(lic?.trialEndsAt)}. Activate a license key to restore access.</p>
              </div>
            </div>
          )}
          {licExpired && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-red-50 border border-red-200 mb-5">
              <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">License Expired</p>
                <p className="text-xs text-red-700 mt-0.5">Expired {fmt(lic?.subscriptionEndsAt)}. Renew to restore access.</p>
              </div>
            </div>
          )}
          {!lic && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 mb-5">
              <KeyRound size={16} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-600">No License Assigned</p>
                <p className="text-xs text-slate-500 mt-0.5">This doctor has not started a trial or activated a license key.</p>
              </div>
            </div>
          )}

          <Grid>
            <InfoRow label="Plan" value={lic?.plan ?? "—"} />
            <InfoRow label="Payment Status" value={lic?.paymentStatus ?? "—"} />
            <InfoRow
              label="Trial Start"
              value={fmt(lic?.trialStartsAt)}
              icon={<CalendarDays size={12} className="text-slate-400 shrink-0" />}
            />
            <InfoRow
              label="Trial End"
              value={fmt(lic?.trialEndsAt)}
              icon={<CalendarDays size={12} className="text-slate-400 shrink-0" />}
            />
            <InfoRow
              label="Subscription Start"
              value={fmt(lic?.subscriptionStartsAt)}
              icon={<CalendarDays size={12} className="text-slate-400 shrink-0" />}
            />
            <InfoRow
              label="Subscription End"
              value={fmt(lic?.subscriptionEndsAt)}
              icon={<CalendarDays size={12} className="text-slate-400 shrink-0" />}
            />
            <InfoRow
              label="Days Remaining"
              value={licActive ? `${daysRemaining} days` : "—"}
            />
            <InfoRow
              label="Last Verified"
              value={fmt(lic?.lastVerifiedAt)}
              icon={<Clock size={12} className="text-slate-400 shrink-0" />}
            />
            <InfoRow
              label="Device"
              value={lic?.deviceName}
              icon={<Monitor size={12} className="text-slate-400 shrink-0" />}
            />
            <InfoRow label="License Key" value={lic?.licenseKey ? `${lic.licenseKey.slice(0, 12)}…` : "—"} mono />
            <InfoRow label="Razorpay Order" value={lic?.razorpayOrderId ?? "—"} mono />
            <InfoRow label="Razorpay Payment" value={lic?.razorpayPaymentId ?? "—"} mono />
          </Grid>
        </Section>
      </div>
    </div>
  );
}
