"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { History } from "lucide-react";
import { parseJSON } from "@/lib/json";
import { useAutoSave, SaveIndicator } from "@/lib/useAutoSave";
import { addMedication, removeMedication, sendToPharmacy, saveRefraction, sendToOpticals } from "./actions";
import { DispositionToggle, DispensePanel, AdmitPanel, SurgicalPanel } from "./DispositionPanel";
import { Plus, X, Send, PackageCheck, BedDouble, Stethoscope } from "lucide-react";

export function PlanTab({ visit, udid, patientSex }: { visit: any; udid: string; patientSex: string }) {
  return (
    <div className="flex flex-col gap-5">
      <PrescriptionCard visit={visit} udid={udid} />
      <OpticalPrescriptionCard visit={visit} udid={udid} />
      <DispositionCard visit={visit} udid={udid} patientSex={patientSex} />
    </div>
  );
}

function PrescriptionCard({ visit, udid }: { visit: any; udid: string }) {
  const [pending, startTransition] = useTransition();
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");

  const medications: any[] = visit.medications ?? [];

  const quickAdd = (name: string) => startTransition(() => addMedication(visit.id, udid, { drugName: name }));

  const submitCustomDrug = () => {
    if (!drugName.trim()) return;
    startTransition(async () => {
      await addMedication(visit.id, udid, { drugName, dosage, frequency, duration });
      setDrugName("");
      setDosage("");
      setFrequency("");
      setDuration("");
      setShowAddDrug(false);
    });
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Prescription / Medications</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddDrug((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-[var(--color-border)] hover:border-[var(--color-primary-500)]"
          >
            <Plus size={13} /> Add Drug
          </button>
          <button
            disabled={pending || visit.sentToPharmacy}
            onClick={() => startTransition(() => sendToPharmacy(visit.id, udid))}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-primary-100)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-600)] hover:text-white transition-colors disabled:opacity-60"
          >
            <Send size={13} /> {visit.sentToPharmacy ? "Sent to Pharmacy" : "Send to Pharmacy"}
          </button>
        </div>
      </div>

      {/* Categorised presets */}
      {[
        {
          label: "Artificial Tears",
          drugs: ["Sodium hyaluronate", "Carboxymethylcellulose", "Hydroxypropyl MC"],
        },
        {
          label: "Antibiotics",
          drugs: ["Ciprofloxacin 0.3%", "Moxifloxacin 0.5%", "Tobramycin 0.3%"],
        },
        {
          label: "Lubricants",
          drugs: ["Carbomer gel", "Liquid paraffin", "Polyethylene glycol"],
        },
        {
          label: "Anti-inflammatory",
          drugs: ["Prednisolone 1%", "Ketorolac 0.5%", "Nepafenac 0.1%"],
        },
        {
          label: "Anti-glaucoma",
          drugs: ["Timolol 0.5%", "Latanoprost 0.005%", "Brimonidine 0.2%"],
        },
      ].map(({ label, drugs }) => (
        <div key={label} className="mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] mb-1">{label}</p>
          <div className="flex flex-wrap gap-1.5">
            {drugs.map((drug) => (
              <button key={drug} disabled={pending} onClick={() => quickAdd(drug)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--color-border)] bg-white hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)] transition-colors disabled:opacity-40">
                + {drug}
              </button>
            ))}
          </div>
        </div>
      ))}

      {showAddDrug && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 p-3 rounded-xl bg-[var(--color-surface-sunken)]">
          <input value={drugName} onChange={(e) => setDrugName(e.target.value)} placeholder="Drug name" className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-sm" />
          <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Dosage" className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-sm" />
          <input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="Frequency" className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-sm" />
          <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duration" className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-sm" />
          <button onClick={submitCustomDrug} className="col-span-2 md:col-span-4 rounded-lg bg-[var(--color-primary-600)] text-white text-xs font-medium py-1.5">
            Add to Prescription
          </button>
        </div>
      )}

      {medications.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-400)] py-4 text-center">No medications added. Use quick buttons above or &quot;Add Drug&quot;.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {medications.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
              <span>
                <span className="font-medium text-[var(--color-ink-900)]">{m.drugName}</span>
                {(m.dosage || m.frequency || m.duration) && (
                  <span className="text-[var(--color-ink-400)] ml-2 text-xs">
                    {[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <button onClick={() => removeMedication(m.id, udid)} className="text-[var(--color-ink-400)] hover:text-[var(--color-danger-600)]">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OpticalPrescriptionCard({ visit, udid }: { visit: any; udid: string }) {
  const rc = visit.refraction;
  const [re, setRe] = useState(parseJSON(rc?.re, { sph: "", cyl: "", axis: "", nearSph: "", nearCyl: "", nearAxis: "" }));
  const [le, setLe] = useState(parseJSON(rc?.le, { sph: "", cyl: "", axis: "", nearSph: "", nearCyl: "", nearAxis: "" }));
  const [pending, startTransition] = useTransition();

  const state = useAutoSave({ re: JSON.stringify(re), le: JSON.stringify(le) }, async (d) => {
    await saveRefraction(visit.id, udid, d);
  });

  const inp = (val: any, setVal: (v: any) => void, field: string, placeholder = "") => (
    <input
      value={val[field] ?? ""}
      onChange={(e) => setVal({ ...val, [field]: e.target.value })}
      placeholder={placeholder}
      className="w-full rounded border border-[var(--color-border)] bg-white px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-500)]"
    />
  );

  const RxPanel = ({ title, sph, cyl, axis }: { title: string; sph: string; cyl: string; axis: string }) => (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-ink-400)] mb-2">{title}</p>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-[10px] font-medium text-[var(--color-ink-400)] pb-1 w-8"></th>
            <th className="text-center text-[10px] font-medium text-[var(--color-ink-400)] pb-1 px-1">SPH</th>
            <th className="text-center text-[10px] font-medium text-[var(--color-ink-400)] pb-1 px-1">CYL</th>
            <th className="text-center text-[10px] font-medium text-[var(--color-ink-400)] pb-1 px-1">AXIS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          <tr>
            <td className="py-1 pr-1 font-semibold text-[var(--color-primary-700)]">RE</td>
            <td className="py-1 px-1">{inp(re, setRe, sph, "+0.00")}</td>
            <td className="py-1 px-1">{inp(re, setRe, cyl, "-0.00")}</td>
            <td className="py-1 px-1">{inp(re, setRe, axis, "0°")}</td>
          </tr>
          <tr>
            <td className="py-1 pr-1 font-semibold text-[var(--color-success-600)]">LE</td>
            <td className="py-1 px-1">{inp(le, setLe, sph, "+0.00")}</td>
            <td className="py-1 px-1">{inp(le, setLe, cyl, "-0.00")}</td>
            <td className="py-1 px-1">{inp(le, setLe, axis, "0°")}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">Optical Prescription</p>
        <div className="flex items-center gap-3">
          <SaveIndicator state={state} />
          <button
            disabled={pending}
            onClick={() => startTransition(() => sendToOpticals(visit.id, udid))}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-primary-100)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-600)] hover:text-white transition-colors disabled:opacity-60"
          >
            {rc?.sentToOpticals ? "Resend to Opticals" : "Send to Opticals"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <RxPanel title="Distance" sph="sph" cyl="cyl" axis="axis" />
        <RxPanel title="Near Add" sph="nearSph" cyl="nearCyl" axis="nearAxis" />
      </div>
    </Card>
  );
}

function DispositionCard({ visit, udid, patientSex }: { visit: any; udid: string; patientSex: string }) {
  const [activePanels, setActivePanels] = useState<string[]>(
    [visit.dispense && "dispense", visit.admission && "admit", visit.surgicalCounselling && "surgery"].filter(Boolean) as string[]
  );
  const togglePanel = (id: string) =>
    setActivePanels((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id]));

  return (
    <Card>
      <p className="text-sm font-medium text-[var(--color-ink-700)] mb-3">Patient Disposition</p>
      <div className="flex gap-3 flex-wrap mb-2">
        <DispositionToggle icon={<PackageCheck size={16} />} label="Patient Dispense" active={activePanels.includes("dispense")} onClick={() => togglePanel("dispense")} />
        <DispositionToggle icon={<BedDouble size={16} />} label="Admit" active={activePanels.includes("admit")} onClick={() => togglePanel("admit")} />
        <DispositionToggle icon={<Stethoscope size={16} />} label="Surgical Counselling" active={activePanels.includes("surgery")} onClick={() => togglePanel("surgery")} />
      </div>
      <p className="text-xs text-[var(--color-ink-400)] mb-4">These are not mutually exclusive — a patient may be both Admitted and have Surgical Counselling recorded.</p>
      <div className="flex flex-col gap-4">
        {activePanels.includes("dispense") && <DispensePanel visit={visit} udid={udid} />}
        {activePanels.includes("admit") && <AdmitPanel visit={visit} udid={udid} patientSex={patientSex} />}
        {activePanels.includes("surgery") && <SurgicalPanel visit={visit} udid={udid} />}
      </div>
    </Card>
  );
}
