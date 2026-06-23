"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

function InlineSpinner() {
  return (
    <div className="grid min-h-[120px] place-items-center">
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <span className="size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        Carregando...
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  WebGL / heavy-canvas component                                     */
/* ------------------------------------------------------------------ */
export const LightRays = dynamic(
  () => import("@/components/palpite/light-rays").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="light-rays-container" aria-hidden="true" />
    ),
  },
);

/* ------------------------------------------------------------------ */
/*  Complex data hubs & builders                                       */
/* ------------------------------------------------------------------ */
export const BestPlayersHub = dynamic(
  () =>
    import("@/components/palpite/best-players-hub").then(
      (m) => m.BestPlayersHub,
    ),
  { loading: () => <CardSkeleton /> },
);

export const BestTeamBuilder = dynamic(
  () =>
    import("@/components/palpite/best-team-builder").then(
      (m) => m.BestTeamBuilder,
    ),
  { ssr: false, loading: () => <CardSkeleton /> },
);

/* ------------------------------------------------------------------ */
/*  Heavy client-only libs                                             */
/* ------------------------------------------------------------------ */
export const PhotoPitch = dynamic(
  () =>
    import("@/components/palpite/photo-pitch").then((m) => m.PhotoPitch),
  { ssr: false, loading: () => <InlineSpinner /> },
);

export const SharePredictions = dynamic(
  () =>
    import("@/components/palpite/share-predictions").then(
      (m) => m.SharePredictions,
    ),
  { ssr: false, loading: () => <InlineSpinner /> },
);

/* Re-export the type so consuming files don't need a separate import */
export type { SharePrediction } from "@/components/palpite/share-predictions";
