"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUser } from "../actions";
import { Card } from "@/components/ui/Card";

const INPUT =
  "mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-[var(--color-ink-700)]">
        {label}
        {required && <span className="text-[var(--color-danger-500)] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export function NewUserForm({
  doctorId,
  hospitals,
}: {
  doctorId: string;
  hospitals: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<{ error?: string; success?: boolean }, FormData>(
    async (_prev, formData) => {
      const result = await createUser(formData);
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
        <input type="hidden" name="doctorId" value={doctorId} />

        <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-400)] uppercase">
          Account
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Username" required>
            <input
              name="username"
              required
              autoComplete="off"
              placeholder="e.g. hosp_admin"
              className={INPUT}
            />
          </Field>

          <Field label="Password" required>
            <input
              name="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Min. 6 characters"
              className={INPUT}
            />
          </Field>
        </div>

        <p className="text-xs font-semibold tracking-widest text-[var(--color-ink-400)] uppercase mt-1">
          Profile
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Display Name" required>
            <input
              name="name"
              required
              placeholder="Full name"
              className={INPUT}
            />
          </Field>

          <Field label="Email">
            <input
              name="email"
              type="email"
              placeholder="user@example.com"
              className={INPUT}
            />
          </Field>

          <Field label="Mobile Number">
            <input
              name="mobile"
              type="tel"
              maxLength={10}
              placeholder="10-digit number"
              className={INPUT}
            />
          </Field>

          <Field label="Role" required>
            <select name="role" required className={INPUT}>
              <option value="">— Select role —</option>
              <option value="HOSPITAL">Hospital</option>
              <option value="REFRACTIONIST">Refractionist</option>
            </select>
          </Field>

          <div className="col-span-2">
            <Field label="Hospital" required>
              <select name="hospitalId" required className={INPUT}>
                <option value="">— Select hospital —</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {state?.error && (
          <p className="text-sm text-[var(--color-danger-600)] bg-[var(--color-danger-100)] rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-[var(--color-primary-600)] text-white font-medium py-2.5 px-5 hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create User"}
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
