import { ArrowDownIcon, ArrowUpIcon, MinusIcon, TrophyIcon } from "lucide-react";
import { EmptyState } from "@/components/palpite/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RankingRow } from "@/lib/palpite-data";

export function RankingTable({ ranking }: { ranking: RankingRow[] }) {
  if (ranking.length === 0) {
    return (
      <EmptyState
        icon={TrophyIcon}
        title="Ranking sem pontuacao"
        description="O ranking aparece aqui assim que os participantes comecarem a dar palpites e somar pontos."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card/90">
      <Table>
        <TableCaption>Ranking do grupo.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Participante</TableHead>
            <TableHead className="hidden text-center sm:table-cell">Exatos</TableHead>
            <TableHead className="hidden text-center sm:table-cell">Parciais</TableHead>
            <TableHead className="hidden text-center sm:table-cell">Pen.</TableHead>
            <TableHead className="hidden text-center md:table-cell">Bônus</TableHead>
            <TableHead className="text-right">Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranking.map((row) => (
            <TableRow key={row.name}>
              <TableCell className="font-semibold">{row.position}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="size-7 border sm:size-9">
                    <AvatarFallback className="text-[11px]">{row.avatarFallback}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 font-semibold">
                      {row.trend === "up" ? (
                        <ArrowUpIcon className="size-3 shrink-0 text-emerald-600" />
                      ) : row.trend === "down" ? (
                        <ArrowDownIcon className="size-3 shrink-0 text-red-600" />
                      ) : (
                        <MinusIcon className="size-3 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{row.name}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground sm:hidden">
                      {row.exactScores} exatos · {row.partialHits} parc. · {row.bestPlayersPoints} bônus
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden text-center sm:table-cell">{row.exactScores}</TableCell>
              <TableCell className="hidden text-center sm:table-cell">{row.partialHits}</TableCell>
              <TableCell className="hidden text-center sm:table-cell">
                <Badge variant={row.penalties > 0 ? "destructive" : "secondary"}>
                  {row.penalties}
                </Badge>
              </TableCell>
              <TableCell className="hidden text-center font-semibold text-amber-600 md:table-cell">
                {row.bestPlayersPoints}
              </TableCell>
              <TableCell className="text-right text-base font-bold sm:text-lg">
                {row.points}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
