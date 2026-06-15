import { FileQuestion } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <div className="rounded-full bg-slate-200 p-3">
        <FileQuestion className="h-10 w-10 text-slate-500" />
      </div>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        The page or record you&apos;re looking for doesn&apos;t exist, was removed, or you don&apos;t
        have access to it.
      </p>
      <LinkButton href="/dashboard" className="mt-6">
        Back to Dashboard
      </LinkButton>
    </div>
  );
}
