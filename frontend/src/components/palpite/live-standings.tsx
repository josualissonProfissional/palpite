"use client";

import { RadioIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StandingsTable } from "@/components/palpite/standings-table";
import { useLiveStandings } from "@/hooks/use-live-standings";
import type { Standing } from "@/lib/palpite-data";

export function LiveStandings({ initialStandings }: { initialStandings: Standing[] }) {
  const { standings, connected } = useLiveStandings(initialStandings);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Badge
          variant={connected ? "default" : "secondary"}
          className="gap-1"
          title={connected ? "Classificacao atualizando ao vivo" : "Conectando..."}
        >
          <RadioIcon className={connected ? "size-3 animate-pulse" : "size-3"} />
          {connected ? "Ao vivo conectado" : "Conectando..."}
        </Badge>
      </div>
      <StandingsTable standings={standings} />
    </div>
  );
}
