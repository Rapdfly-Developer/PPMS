import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { markAllRead } from "./actions";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";

function NotificationIcon({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-600)] shrink-0">
      <Bell size={15} />
    </span>
  );
}

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fade-in max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink-900)] tracking-tight">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-[var(--color-ink-500)] mt-1">
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {unreadCount > 0 && (
          <form action={markAllRead}>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] transition-colors"
            >
              <CheckCheck size={15} />
              Mark all as read
            </button>
          </form>
        )}
      </div>

      <div className="surface-card divide-y divide-[var(--color-border)] overflow-hidden">
        {notifications.length === 0 ? (
          <div className="py-16 text-center text-[var(--color-ink-400)] text-sm">
            No notifications yet.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                !n.read
                  ? "border-l-4 border-l-[var(--color-primary-500)] bg-[var(--color-primary-50)]/40"
                  : "border-l-4 border-l-transparent"
              }`}
            >
              <NotificationIcon type={n.type} />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm leading-snug ${
                    !n.read
                      ? "font-medium text-[var(--color-ink-900)]"
                      : "text-[var(--color-ink-700)]"
                  }`}
                >
                  {n.message}
                </p>
                <p className="text-xs text-[var(--color-ink-400)] mt-1">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </p>
              </div>
              {!n.read && (
                <span className="mt-1 w-2 h-2 rounded-full bg-[var(--color-primary-500)] shrink-0" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
