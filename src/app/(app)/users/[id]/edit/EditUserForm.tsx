"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateUser } from "../../actions";
import { Card } from "@/components/ui/Card";

const INPUT =
  "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-[var(--color-ink-700)]">
        {label}
        {required && <span className="text-[var(--color-danger-500)] ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-[var(--color-ink-400)] mt-1">{hint}</p>}
    </div>
  );
}

interface DefaultValues {
  name: string;
  email: string;
  mobile: string;
  role: string;
  hospitalId: string;
  active: boolean;
}

export function EditUserForm({
  userId,
  hospitals,
  defaultValues,
}: {
  userId: string;
  hospitals: { id: string; name: string }[];
  defaultValues: DefaultValues;
}) {
  const [state, formAction, pending] = useActionState<
    { error?: string; success?: boolean },
    FormData
  >(
    async (_prev, formData) => {
      const result = await updateUser(userId, formData);
      if (!result.error) return { success: true };
      return result;
    },
    {}
  );

  const router = useRouter();

  useEffect(() => {
    if (state?.success) router.push("/users");
  }, [state?.success, router]);

  return (
    <Card lifted>
      <form action={formAction} className="flex flex-col gap-5">
        <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-400)] uppercase">
          Profile
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Display Name" required>
            <input
              name="name"
              required
              defaultValue={defaultValues.name}
              className={INPUT}
            />
          </Field>

          <Field label="Email">
            <input
              name="email"
              type="email"
              defaultValue={defaultValues.email}
              placeholder="user@example.com"
              className={INPUT}
            />
          </Field>

          <Field label="Mobile Number" hint="10 digits, leave blank to keep unchanged">
            <input
              name="mobile"
              type="tel"
              maxLength={10}
              defaultValue={defaultValues.mobile}
              placeholder="10-digit number"
              className={INPUT}
            />
          </Field>

          <Field label="Role">
            <select
              name="role"
              defaultValue={defaultValues.role}
              disabled
              className={`${INPUT} bg-[var(--color-surface-sunken)] text-[var(--color-ink-500)] cursor-not-allowed`}
            >
              <option value="HOSPITAL">Hospital</option>
              <option value="REFRACTIONIST">Refractionist</option>
            </select>
          </Field>

          <div className="col-span-2">
            <Field label="Hospital" required>
              <select name="hospitalId" defaultValue={defaultValues.hospitalId} required className={INPUT}>
                <option value="">— Select hospital —</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-400)] uppercase mt-1">
          Security
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Field label="New Password" hint="Leave blank to keep current password">
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Enter new password"
              className={INPUT}
            />
          </Field>

          <Field label="Account Status">
            <select name="active" defaultValue={String(defaultValues.active)} className={INPUT}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </Field>
        </div>

        {state?.error && (
          <p className="text-sm text-[var(--color-danger-600)] bg-[var(--color-danger-100)] rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        {state?.success && (
          <p className="text-sm text-[var(--color-success-600)] bg-[var(--color-success-100)] rounded-lg px-3 py-2">
            User updated successfully. Redirecting…
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-[var(--color-primary-600)] text-white font-medium py-2.5 px-5 hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save Changes"}
          </button>
          <a
            href="/users"
            className="rounded-xl border border-[var(--color-border)] text-[var(--color-ink-700)] font-medium py-2.5 px-5 hover:bg-[var(--color-ink-50)] transition-colors text-sm flex items-center"
          >
            Cancel
          </a>
        </div>
      </form>
    </Card>
  );
}
