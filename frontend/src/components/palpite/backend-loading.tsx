import { LoaderCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function BackendLoadingOverlay({
  active,
  label = "Carregando dados...",
}: {
  active: boolean;
  label?: string;
}) {
  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/72 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
        <LoaderCircleIcon className="size-5 animate-spin text-primary" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}

export function InlineLoading({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  if (!active) return null;

  return <LoaderCircleIcon className={cn("size-4 animate-spin", className)} aria-hidden="true" />;
}

export function RouteLoadingScreen({ label = "Carregando dados..." }: { label?: string }) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-4">
      <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-sm">
        <LoaderCircleIcon className="size-5 animate-spin text-primary" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </main>
  );
}
