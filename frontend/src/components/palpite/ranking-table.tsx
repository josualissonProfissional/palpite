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
      <Table className="min-w-[640px]">
        <TableCaption>Ranking do grupo.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Participante</TableHead>
            <TableHead className="text-center">Exatos</TableHead>
            <TableHead className="text-center">Parciais</TableHead>
            <TableHead className="text-center">Pen.</TableHead>
            <TableHead className="text-right">Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranking.map((row) => (
            <TableRow key={row.name}>
              <TableCell className="font-semibold">{row.position}</TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="size-9 border">
                    <AvatarFallback>{row.avatarFallback}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">{row.name}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {row.trend === "up" ? (
                        <ArrowUpIcon className="size-3 text-emerald-600" />
                      ) : row.trend === "down" ? (
                        <ArrowDownIcon className="size-3 text-red-600" />
                      ) : (
                        <MinusIcon className="size-3" />
                      )}
                      {row.predicted} palpites
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-center">{row.exactScores}</TableCell>
              <TableCell className="text-center">{row.partialHits}</TableCell>
              <TableCell className="text-center">
                <Badge variant={row.penalties > 0 ? "destructive" : "secondary"}>
                  {row.penalties}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-lg font-bold">
                {row.points}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
