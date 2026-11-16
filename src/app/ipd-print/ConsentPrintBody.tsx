import { CONSENT_DECLARATION, type ConsentItem } from "@/lib/ipd-forms";

/** Page height left inside the A4 page margins (297mm - 2 x 10mm), less a little for rounding. */
export const CONSENT_PAGE_MIN_H = "min-h-[272mm]";

/** A ruled line to write on, with an optional value already filled in. */
function WriteLine({ label, value, tall }: { label: string; value?: string | null; tall?: boolean }) {
  return (
    <div className={`flex items-end gap-2 ${tall ? "h-11" : "h-9"}`}>
      <span className="shrink-0 text-[12px] text-gray-700">{label}</span>
      <span className="flex-1 border-b border-gray-500 pb-0.5 text-[12.5px] font-semibold leading-none">{value || ""}</span>
    </div>
  );
}

/** One signing column: a large space to sign in, then name / details lines. */
function SignBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="h-20 border-b-2 border-gray-800" />
      <p className="mt-1.5 text-[12px] font-bold">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/**
 * Consent text, declaration and a signing area that grows to fill the rest of
 * the one A4 page, so there is room to write names and sign.
 */
export function ConsentPrintBody({ c, doctor, qualifications }: { c: ConsentItem; doctor: string; qualifications?: string | null }) {
  const signerTitle = c.signer?.kind === "RELATIVE" ? "Signature of relative" : c.signer?.kind === "PATIENT" ? "Signature of patient" : "Signature of patient / relative";
  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-3.5 text-[13.5px] leading-[1.85] text-justify">
        {c.text.split("\n").filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <p className="mt-5 text-[13px] font-semibold italic leading-relaxed">{CONSENT_DECLARATION}</p>

      <div className="mt-5 grid grid-cols-2 gap-x-10">
        <WriteLine label="Explained in (language):" value={c.language} tall />
        <WriteLine label="Explained by:" value={c.explainedBy} tall />
      </div>

      {/* Pushed to the bottom of the page; the space above is left for writing */}
      <div className="mt-auto pt-10 grid grid-cols-3 gap-10 break-inside-avoid">
        <SignBox title={signerTitle}>
          <WriteLine label="Name:" value={c.signer?.name} />
          {c.signer?.kind !== "PATIENT" && <WriteLine label="Relationship:" value={c.signer?.relation} />}
          <WriteLine label="Date & time:" />
        </SignBox>
        <SignBox title="Signature of witness">
          <WriteLine label="Name:" value={c.witness} />
          <WriteLine label="Relationship:" />
          <WriteLine label="Date & time:" />
        </SignBox>
        <SignBox title="Signature of doctor">
          <p className="h-9 flex items-end text-[12.5px] font-semibold">Dr. {doctor.replace(/^Dr\.?\s*/i, "")}</p>
          {qualifications && <p className="text-[11.5px] text-gray-700">{qualifications}</p>}
          <WriteLine label="Date & time:" />
        </SignBox>
      </div>
    </div>
  );
}
