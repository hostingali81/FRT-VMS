export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="fixed left-0 top-0 z-50 h-1 w-full overflow-hidden bg-slate-200">
        <div className="h-full w-1/2 animate-pulse bg-slate-950" />
      </div>
      <div className="lg:pl-64">
        <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
          <div className="h-5 w-48 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-72 rounded bg-slate-100" />
        </div>
        <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-24 rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
          <div className="h-96 rounded-lg border border-slate-200 bg-white" />
        </div>
      </div>
    </div>
  );
}

