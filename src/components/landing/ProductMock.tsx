/* Code-built RF Health product visuals.
 *
 * These replace the stock clinical photography the hero used to carry. Two
 * reasons they are drawn rather than shipped as images: a screenshot of a real
 * console would need a signed-in session to capture, and a raster asset large
 * enough to stay sharp on a 3840px display is a megabyte the page does not
 * need to spend. Everything here is layout and SVG, so it is resolution
 * independent and costs nothing to scale.
 *
 * The figures shown are illustrative, and the surrounding copy says so. The
 * module names, roles and visit flow are the real ones, so the picture matches
 * the product it is selling.
 */

const TEAL = "#0D7A63";

/* Hand-authored path data. Generating these from floats at render time is what
   produces server/client text mismatches in React. */
const AREA_LINE =
  "M0,74 L38,62 L76,68 L114,44 L152,52 L190,30 L228,38 L266,18 L304,26 L342,10";
const AREA_FILL = AREA_LINE + " L342,96 L0,96 Z";

function Bar({ h, dim = false }: { h: number; dim?: boolean }) {
  return (
    <div
      className="w-full rounded-[3px]"
      style={{ height: h + "%", background: dim ? "#D7E8E2" : TEAL }}
    />
  );
}

/** The large hero visual: a full console window. */
export function DashboardMock() {
  const schedule = [
    { t: "09:00", n: "Ananya Rao", w: "Follow-up", s: "Done" },
    { t: "09:20", n: "Vikram Iyer", w: "New patient", s: "Done" },
    { t: "09:40", n: "Meera Nair", w: "Post-op review", s: "In room" },
    { t: "10:00", n: "Rahul Menon", w: "Follow-up", s: "Waiting" },
    { t: "10:20", n: "Sana Qureshi", w: "Investigation review", s: "Waiting" },
  ];

  return (
    <div className="w-full overflow-hidden rounded-[1.75rem] bg-white shadow-[0_40px_90px_-50px_rgba(6,60,45,0.45)] ring-1 ring-inset ring-emerald-950/[0.08] 4xl:rounded-[2.25rem]">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3 4xl:px-6 4xl:py-4">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300 4xl:h-3 4xl:w-3" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-200 4xl:h-3 4xl:w-3" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-200 4xl:h-3 4xl:w-3" />
        <div className="ml-3 flex-1 rounded-md bg-white px-3 py-1 text-[10px] text-slate-400 ring-1 ring-inset ring-slate-200 4xl:text-[12px]">
          app.rfhealth.in / dashboard
        </div>
      </div>

      <div className="flex">
        <div className="hidden w-[64px] shrink-0 flex-col gap-1.5 border-r border-slate-100 bg-[#0B3D3A] px-2.5 py-4 sm:flex 4xl:w-[84px] 4xl:gap-2 4xl:px-3.5 4xl:py-6">
          <div className="mb-2 h-7 w-7 rounded-lg bg-emerald-400/20 ring-1 ring-inset ring-emerald-300/30 4xl:h-9 4xl:w-9" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-6 w-full rounded-md 4xl:h-8"
              style={{ background: i === 1 ? "rgba(94,234,212,0.22)" : "rgba(255,255,255,0.06)" }}
            />
          ))}
        </div>

        <div className="min-w-0 flex-1 p-4 sm:p-5 4xl:p-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold tracking-tight text-emerald-950 4xl:text-[17px]">
                Today at Apollo Speciality
              </div>
              <div className="text-[10.5px] text-slate-500 4xl:text-[13px]">
                Dr Sreenivasan &middot; OPD session 09:00&ndash;13:00
              </div>
            </div>
            <div
              className="rounded-full px-2.5 py-1 text-[9.5px] font-semibold 4xl:px-3.5 4xl:py-1.5 4xl:text-[12px]"
              style={{ background: "#DCEFEC", color: TEAL }}
            >
              Live
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 4xl:mt-6 4xl:gap-3">
            {[
              { k: "Booked", v: "24" },
              { k: "Seen", v: "11" },
              { k: "Waiting", v: "6" },
              { k: "Surgery", v: "3" },
            ].map((s) => (
              <div
                key={s.k}
                className="rounded-xl bg-slate-50 px-2.5 py-2 ring-1 ring-inset ring-slate-950/[0.04] 4xl:rounded-2xl 4xl:px-4 4xl:py-3.5"
              >
                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 4xl:text-[11px]">
                  {s.k}
                </div>
                <div className="mt-0.5 text-[17px] font-bold tabular-nums tracking-tight text-emerald-950 4xl:text-[24px]">
                  {s.v}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_1fr] 4xl:mt-5 4xl:gap-4">
            <div className="rounded-xl ring-1 ring-inset ring-slate-950/[0.06] 4xl:rounded-2xl">
              <div className="border-b border-slate-100 px-3 py-2 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 4xl:px-5 4xl:py-3 4xl:text-[11.5px]">
                Consultation queue
              </div>
              <div className="divide-y divide-slate-100">
                {schedule.map((r) => (
                  <div key={r.t} className="flex items-center gap-2.5 px-3 py-2 4xl:gap-4 4xl:px-5 4xl:py-3">
                    <span className="w-9 shrink-0 text-[10px] font-medium tabular-nums text-slate-400 4xl:w-14 4xl:text-[13px]">
                      {r.t}
                    </span>
                    <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-50 ring-1 ring-inset ring-emerald-600/10 4xl:h-8 4xl:w-8" />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-emerald-950 4xl:text-[14px]">
                      {r.n}
                    </span>
                    <span className="hidden truncate text-[10px] text-slate-500 sm:block 4xl:text-[13px]">
                      {r.w}
                    </span>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[8.5px] font-semibold 4xl:px-3 4xl:py-1 4xl:text-[11px]"
                      style={
                        r.s === "In room"
                          ? { background: "#DCEFEC", color: TEAL }
                          : r.s === "Done"
                            ? { background: "#F1F5F4", color: "#64748B" }
                            : { background: "#FBE9D8", color: "#B5651D" }
                      }
                    >
                      {r.s}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 4xl:gap-4">
              <div className="rounded-xl p-3 ring-1 ring-inset ring-slate-950/[0.06] 4xl:rounded-2xl 4xl:p-5">
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 4xl:text-[11.5px]">
                  OPD volume &middot; 10 weeks
                </div>
                <svg viewBox="0 0 342 96" className="mt-2 h-[72px] w-full 4xl:h-[104px]" aria-hidden="true">
                  <defs>
                    <linearGradient id="rf-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TEAL} stopOpacity="0.20" />
                      <stop offset="100%" stopColor={TEAL} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={AREA_FILL} fill="url(#rf-area)" />
                  <path
                    d={AREA_LINE}
                    fill="none"
                    stroke={TEAL}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="342" cy="10" r="3.5" fill={TEAL} />
                </svg>
              </div>

              <div className="flex-1 rounded-xl p-3 ring-1 ring-inset ring-slate-950/[0.06] 4xl:rounded-2xl 4xl:p-5">
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 4xl:text-[11.5px]">
                  Theatre by day
                </div>
                <div className="mt-2.5 flex h-[52px] items-end gap-1.5 4xl:h-[76px] 4xl:gap-2.5">
                  {[46, 72, 38, 88, 60, 30, 54].map((h, i) => (
                    <Bar key={i} h={h} dim={i === 5} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Chrome for the smaller single-purpose screens further down the page. */
export function ScreenCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-hidden rounded-[1.5rem] bg-white shadow-[0_28px_60px_-44px_rgba(6,60,45,0.45)] ring-1 ring-inset ring-emerald-950/[0.07] 4xl:rounded-[2rem]">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3.5 py-2.5 4xl:px-5 4xl:py-3.5">
        <span className="h-2 w-2 rounded-full bg-slate-300 4xl:h-2.5 4xl:w-2.5" />
        <span className="text-[10px] font-semibold tracking-tight text-slate-500 4xl:text-[13px]">
          {label}
        </span>
      </div>
      <div className="p-3.5 4xl:p-6">{children}</div>
    </div>
  );
}

export function PatientScreen() {
  return (
    <div className="flex flex-col gap-3 4xl:gap-4">
      <div className="flex items-center gap-2.5 4xl:gap-4">
        <span className="h-9 w-9 shrink-0 rounded-full bg-emerald-50 ring-1 ring-inset ring-emerald-600/10 4xl:h-12 4xl:w-12" />
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold tracking-tight text-emerald-950 4xl:text-[15px]">
            Meera Nair
          </div>
          <div className="text-[9.5px] text-slate-500 4xl:text-[12px]">
            UDID RFH-4821 &middot; 47F &middot; 14 visits
          </div>
        </div>
      </div>
      {[
        { k: "Allergies", v: "Penicillin" },
        { k: "Conditions", v: "Type 2 diabetes, hypertension" },
        { k: "Last visit", v: "Post-op review, 6 days ago" },
      ].map((r) => (
        <div key={r.k} className="rounded-lg bg-slate-50 px-2.5 py-2 4xl:rounded-xl 4xl:px-4 4xl:py-3">
          <div className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 4xl:text-[10.5px]">
            {r.k}
          </div>
          <div className="mt-0.5 text-[10.5px] text-emerald-950 4xl:text-[13px]">{r.v}</div>
        </div>
      ))}
    </div>
  );
}

export function EmrScreen() {
  const rows = [
    { k: "Vision (R / L)", v: "6/9 · 6/6" },
    { k: "IOP (R / L)", v: "16 · 18 mmHg" },
    { k: "Anterior segment", v: "Quiet, IOL in place" },
  ];
  return (
    <div className="flex flex-col gap-2.5 4xl:gap-3.5">
      <div className="flex gap-1.5 4xl:gap-2">
        {["Complaints", "Exam", "Diagnosis", "Plan"].map((t, i) => (
          <span
            key={t}
            className="rounded-full px-2 py-0.5 text-[8.5px] font-semibold 4xl:px-3.5 4xl:py-1.5 4xl:text-[11px]"
            style={i === 1 ? { background: TEAL, color: "#fff" } : { background: "#F1F5F4", color: "#64748B" }}
          >
            {t}
          </span>
        ))}
      </div>
      {rows.map((r) => (
        <div
          key={r.k}
          className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 4xl:pb-2.5"
        >
          <span className="text-[9.5px] text-slate-500 4xl:text-[12px]">{r.k}</span>
          <span className="text-[10px] font-medium tabular-nums text-emerald-950 4xl:text-[13px]">
            {r.v}
          </span>
        </div>
      ))}
      <div className="rounded-lg bg-emerald-50/70 px-2.5 py-2 text-[9.5px] leading-relaxed text-emerald-900 ring-1 ring-inset ring-emerald-600/10 4xl:rounded-xl 4xl:px-4 4xl:py-3 4xl:text-[12px]">
        Copilot draft, review before saving.
      </div>
    </div>
  );
}

export function AppointmentScreen() {
  const cols = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const filled: Record<string, number[]> = {
    Mon: [0, 1, 3],
    Tue: [1, 2],
    Wed: [0, 2, 3, 4],
    Thu: [2],
    Fri: [0, 1, 4],
  };
  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5 4xl:gap-2.5">
        {cols.map((c) => (
          <div
            key={c}
            className="text-center text-[8.5px] font-semibold uppercase tracking-[0.1em] text-slate-400 4xl:text-[11px]"
          >
            {c}
          </div>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-5 gap-1.5 4xl:mt-2.5 4xl:gap-2.5">
        {cols.map((c) => (
          <div key={c} className="flex flex-col gap-1.5 4xl:gap-2">
            {[0, 1, 2, 3, 4].map((r) => {
              const on = filled[c].includes(r);
              return (
                <div
                  key={r}
                  className="h-4 rounded-[4px] 4xl:h-6 4xl:rounded-md"
                  style={{ background: on ? TEAL : "#F1F5F4", opacity: on ? 1 - r * 0.12 : 1 }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[9px] text-slate-500 4xl:mt-5 4xl:text-[11.5px]">
        <span className="h-2 w-2 rounded-[3px] 4xl:h-2.5 4xl:w-2.5" style={{ background: TEAL }} />
        Booked
        <span className="ml-2 h-2 w-2 rounded-[3px] bg-[#F1F5F4] 4xl:h-2.5 4xl:w-2.5" />
        Open
      </div>
    </div>
  );
}
