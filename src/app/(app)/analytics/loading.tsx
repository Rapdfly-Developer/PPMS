function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-[var(--color-surface-sunken)] ${className}`} />;
}

export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading analytics">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Bone className="h-3 w-32" />
          <Bone className="h-7 w-72" />
          <Bone className="h-3.5 w-96 max-w-full" />
        </div>
        <div className="flex gap-2"><Bone className="h-9 w-24" /><Bone className="h-9 w-24" /><Bone className="h-9 w-36" /></div>
      </div>
      <Bone className="h-[68px] w-full rounded-xl" />
      <div className="flex gap-2 overflow-hidden">{Array.from({ length: 8 }, (_, i) => <Bone key={i} className="h-8 w-24 shrink-0" />)}</div>
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="rounded-xl border border-[var(--color-border)] bg-white p-4 flex flex-col gap-3">
            <Bone className="h-3 w-28" />
            <Bone className="h-7 w-20" />
            <Bone className="h-3 w-40" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 flex flex-col gap-4">
        <Bone className="h-4 w-56" />
        <Bone className="h-[260px] w-full" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Bone className="h-[230px] w-full rounded-xl" />
        <Bone className="h-[230px] w-full rounded-xl" />
      </div>
    </div>
  );
}
