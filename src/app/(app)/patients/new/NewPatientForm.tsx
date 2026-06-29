"use client";

import { useActionState, useState, useRef, useCallback, useEffect } from "react";
import { registerPatientAction, type RegisterPatientState } from "./actions";
import { SingleChipSelect } from "@/components/ui/Chip";
import { SEXES } from "@/lib/constants";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, UploadCloud, Camera, X, FileText, Aperture } from "lucide-react";
import Link from "next/link";

interface UploadedFile {
  savedName: string;
  originalFileName: string;
  mimeType: string;
  previewUrl?: string;
}

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu",
  "Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-[var(--color-ink-700)]">{label}</label>
      {children}
      {error && <p className="text-xs text-[var(--color-danger-600)] mt-1">{error}</p>}
    </div>
  );
}

const INPUT = "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] aria-[invalid=true]:border-[var(--color-danger-400)]";

// ─── Inline camera capture ──────────────────────────────────────────────────
function CameraCapture({ onCapture }: { onCapture: (blob: Blob, name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOpen(false);
  }, []);

  async function openCam() {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setOpen(true);
    } catch {
      setErr("Camera access denied or unavailable.");
    }
  }

  useEffect(() => {
    if (open && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [open]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  function capture() {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob((blob) => { if (blob) { onCapture(blob, `photo-${Date.now()}.jpg`); stop(); } }, "image/jpeg", 0.92);
  }

  return (
    <>
      {/* Camera panel — matches upload panel style */}
      <button
        type="button"
        onClick={openCam}
        className="flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-sunken)] py-7 px-4 cursor-pointer hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)] transition-colors"
      >
        <Camera size={22} className="text-[var(--color-primary-600)]" />
        <p className="text-sm font-semibold text-[var(--color-ink-700)]">Take Photo</p>
        <p className="text-xs text-[var(--color-ink-400)]">Capture with camera</p>
      </button>

      {err && <p className="text-xs text-[var(--color-danger-600)] mt-1">{err}</p>}

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-lg">
            <button
              type="button"
              onClick={stop}
              className="absolute top-3 right-3 z-10 size-9 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
            >
              <X size={18} />
            </button>
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl" />
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={capture}
                className="flex items-center gap-2 px-8 py-3 rounded-full bg-white text-[var(--color-ink-900)] font-semibold text-sm hover:bg-gray-100 transition-colors shadow-lg"
              >
                <Aperture size={18} /> Capture
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main form ──────────────────────────────────────────────────────────────
export function NewPatientForm({
  hospitals,
  lockedHospitalId,
}: {
  hospitals: { id: string; name: string }[];
  lockedHospitalId?: string;
}) {
  const [state, formAction, pending] = useActionState<RegisterPatientState, FormData>(registerPatientAction, {});
  const [sex, setSex] = useState("MALE");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File | Blob, filename: string) {
    setUploadError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file instanceof File ? file : new File([file], filename, { type: "image/jpeg" }));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setUploadError(json.error ?? "Upload failed."); return; }

      const isImage = (file instanceof File ? file.type : "image/jpeg").startsWith("image/");
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

      setDocs((prev) => [
        ...prev,
        { savedName: json.savedName, originalFileName: json.originalFileName ?? filename, mimeType: json.mimeType, previewUrl },
      ]);
    } catch {
      setUploadError("Network error during upload.");
    } finally {
      setUploading(false);
    }
  }

  function removeDoc(savedName: string) {
    setDocs((prev) => {
      const doc = prev.find((d) => d.savedName === savedName);
      if (doc?.previewUrl) URL.revokeObjectURL(doc.previewUrl);
      return prev.filter((d) => d.savedName !== savedName);
    });
  }

  function validate(formData: FormData) {
    const e: Record<string, string> = {};
    const name = (formData.get("name") as string).trim();
    const age = formData.get("age") as string;
    const mobile = (formData.get("mobile") as string).trim();
    const aadhaar = (formData.get("aadhaar") as string).replace(/\s/g, "");
    const pincode = (formData.get("pincode") as string).trim();
    const hospitalId = formData.get("hospitalId") as string;

    if (!name) e.name = "Full name is required.";
    if (!age || parseInt(age) < 0 || parseInt(age) > 130) e.age = "Valid age (0–130) is required.";
    if (!mobile || !/^\d{10}$/.test(mobile)) e.mobile = "Enter a valid 10-digit mobile number.";
    if (!aadhaar || !/^\d{12}$/.test(aadhaar)) e.aadhaar = "Aadhaar must be exactly 12 digits.";
    if (pincode && !/^\d{6}$/.test(pincode)) e.pincode = "Pincode must be 6 digits.";
    if (!lockedHospitalId && !hospitalId) e.hospitalId = "Please select a hospital.";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(formData: FormData) {
    docs.forEach((d) => {
      formData.append("pastVisitFiles[]", d.savedName);
      formData.append("pastVisitMimes[]", d.mimeType);
      formData.append("pastVisitNames[]", d.originalFileName);
    });
    if (validate(formData)) formAction(formData);
  }

  return (
    <div className="fade-in min-h-full flex flex-col items-center justify-center py-10 px-4">
      <div className="w-full max-w-2xl">
        <Link
          href="/patients"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-500)] hover:text-[var(--color-ink-800)] mb-5 transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Patients
        </Link>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">Register Patient</h1>
          <p className="text-sm text-[var(--color-ink-500)] mt-1">
            A unique UDID will be generated automatically on save.
          </p>
        </div>

        <Card lifted>
          <form action={handleSubmit} className="flex flex-col gap-5">

            {/* Personal Information */}
            <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-400)] uppercase">Personal Information</p>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name *" error={errors.name}>
                <input name="name" aria-invalid={!!errors.name} className={`${INPUT} col-span-2`} placeholder="Enter full name" />
              </Field>

              <Field label="Age *" error={errors.age}>
                <input name="age" type="number" min={0} max={130} aria-invalid={!!errors.age} className={INPUT} placeholder="Years" />
              </Field>

              <div>
                <label className="text-sm font-medium text-[var(--color-ink-700)] mb-1.5 block">Sex *</label>
                <input type="hidden" name="sex" value={sex} />
                <SingleChipSelect options={SEXES} value={sex} onChange={setSex} />
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium text-[var(--color-ink-700)] mb-1.5 block">Category *</label>
                <div className="flex flex-wrap gap-2">
                  {["GENERAL","BPL","SUBSIDISED","ECHS","INSURANCE"].map((cat) => (
                    <label key={cat} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="category" value={cat} defaultChecked={cat === "GENERAL"} className="accent-[var(--color-primary-600)]" />
                      <span className="text-sm text-[var(--color-ink-700)]">{cat.charAt(0) + cat.slice(1).toLowerCase()}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Field label="Mobile Number *" error={errors.mobile}>
                <input name="mobile" type="tel" maxLength={10} aria-invalid={!!errors.mobile} className={INPUT} placeholder="10-digit number" />
              </Field>

              <Field label="Aadhaar Number *" error={errors.aadhaar}>
                <input name="aadhaar" aria-invalid={!!errors.aadhaar} placeholder="XXXX XXXX XXXX" className={INPUT} />
                <p className="text-xs text-[var(--color-ink-400)] mt-1">Stored encrypted; masked everywhere except Doctor view.</p>
              </Field>
            </div>

            {/* Address */}
            <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-400)] uppercase mt-1">Address</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium text-[var(--color-ink-700)]">Address</label>
                <textarea name="address" rows={2} placeholder="Door no., Street, Area" className={`${INPUT} resize-none`} />
              </div>
              <Field label="City" error={errors.city}><input name="city" className={INPUT} placeholder="City" /></Field>
              <Field label="State" error={errors.state}>
                <select name="state" className={INPUT}>
                  <option value="">— Select state —</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Pincode" error={errors.pincode}>
                <input name="pincode" maxLength={6} aria-invalid={!!errors.pincode} className={INPUT} placeholder="6-digit pincode" />
              </Field>
            </div>

            {/* Clinical */}
            <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-400)] uppercase mt-1">Clinical</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium text-[var(--color-ink-700)]">Chief Complaint (optional)</label>
                <textarea name="complaint" rows={3} placeholder="Will auto-populate the Chief Complaint field of the patient's first visit" className={`${INPUT} resize-none`} />
              </div>
              <div className="col-span-2">
                <Field label="Registering Hospital *" error={errors.hospitalId}>
                  {lockedHospitalId ? (
                    <>
                      <input type="hidden" name="hospitalId" value={lockedHospitalId} />
                      <div className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3.5 py-2.5 text-sm text-[var(--color-ink-600)]">
                        {hospitals[0]?.name ?? "Your hospital"}
                      </div>
                    </>
                  ) : (
                    <select name="hospitalId" aria-invalid={!!errors.hospitalId} className={INPUT}>
                      <option value="">— Select hospital —</option>
                      {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  )}
                </Field>
              </div>
            </div>

            {/* Prior External Records */}
            <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-400)] uppercase mt-1">Prior External Records</p>
            <p className="text-xs text-[var(--color-ink-400)] -mt-3">
              Documents and records from previous visits at other hospitals or clinics.
            </p>

            <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 flex flex-col gap-4">
              <p className="text-[10px] font-semibold tracking-widest text-[var(--color-ink-400)] uppercase">Add Document</p>

              {/* Two-panel upload row */}
              <div className="flex gap-3">
                {/* Upload File panel */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={(e) => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach((f) => uploadFile(f, f.name)); }}
                  onDragOver={(e) => e.preventDefault()}
                  className="flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-sunken)] py-7 px-4 cursor-pointer hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)] transition-colors"
                >
                  <UploadCloud size={22} className="text-[var(--color-primary-600)]" />
                  <p className="text-sm font-semibold text-[var(--color-ink-700)]">Upload File</p>
                  <p className="text-xs text-[var(--color-ink-400)]">Image or PDF</p>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => { Array.from(e.target.files ?? []).forEach((f) => uploadFile(f, f.name)); e.target.value = ""; }}
                />

                {/* Camera panel */}
                <CameraCapture onCapture={uploadFile} />
              </div>

              {/* Status */}
              {uploading && <p className="text-xs text-[var(--color-ink-400)] animate-pulse">Uploading…</p>}
              {uploadError && <p className="text-xs text-[var(--color-danger-600)]">{uploadError}</p>}

              {/* Uploaded file list */}
              {docs.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {docs.map((doc) => (
                    <li key={doc.savedName} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2.5">
                      {doc.previewUrl ? (
                        <img src={doc.previewUrl} alt="preview" className="size-10 object-cover rounded-lg shrink-0" />
                      ) : (
                        <div className="size-10 flex items-center justify-center rounded-lg bg-[var(--color-danger-50)] shrink-0">
                          <FileText size={16} className="text-[var(--color-danger-600)]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-ink-800)] truncate">{doc.originalFileName}</p>
                        <p className="text-xs text-[var(--color-ink-400)]">{doc.mimeType}</p>
                      </div>
                      <button type="button" onClick={() => removeDoc(doc.savedName)} className="text-[var(--color-ink-400)] hover:text-[var(--color-danger-600)] transition-colors">
                        <X size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {state?.error && (
              <p className="text-sm text-[var(--color-danger-600)] bg-[var(--color-danger-100)] rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending || uploading}
              className="rounded-xl bg-[var(--color-primary-600)] text-white font-medium py-2.5 hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-60"
            >
              {pending ? "Registering..." : "Register Patient & Generate UDID"}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
