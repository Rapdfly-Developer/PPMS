"use client";

import { useTransition } from "react";
import { deleteUser } from "./actions";
import { Trash2 } from "lucide-react";

export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete user "${userName}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteUser(userId);
      if (result?.error) alert(result.error);
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] text-xs font-medium text-[var(--color-danger-700)] hover:bg-[var(--color-danger-100)] transition-colors disabled:opacity-50"
    >
      <Trash2 size={12} />
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
