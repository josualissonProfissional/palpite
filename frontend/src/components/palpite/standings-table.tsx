import { Badge } from "@/components/ui/badge";
import { ClipboardListIcon } from "lucide-react";
import { EmptyState } from "@/components/palpite/empty-state";
import {
  Table,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Standing } from "@/lib/palpite-data";
import { TeamFlag } from "@/components/palpite/team-flag";

export function StandingsTable({ standings }: { standings: Standing[] }) {
  if (standings.length === 0) {
    return (
      <EmptyState
        icon={ClipboardListIcon}
        title="Classificacao ainda vazia"
        description="A classificacao aparece aqui assim que os jogos da Copa comecarem a ser disputados."
      />
    );
  }

  const grouped = standings.reduce<Record<string, Standing[]>>((acc, row) => {
    const group = row.groupName ?? `Grupo ${row.team.group}`;
    acc[group] = acc[group] ?? [];
    acc[group].push(row);
    return acc;
  }, {});

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-lg border bg-card/90">
      <Table className="min-w-[540px]">
        <TableCaption>Classificacao da Copa do Mundo 2026.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Selecao</TableHead>
            <TableHead className="text-center">J</TableHead>
            <TableHead className="text-center">V</TableHead>
            <TableHead className="text-center">E</TableHead>
            <TableHead className="text-center">D</TableHead>
            <TableHead className="text-center">SG</TableHead>
            <TableHead className="text-right">Pts</TableHead>
          </TableRow>
        </TableHeader>
        {Object.entries(grouped).map(([group, rows]) => (
          <tbody key={group}>
            <TableRow className="bg-muted/60">
              <TableCell colSpan={8} className="font-heading text-base font-bold">
                {group}
              </TableCell>
            </TableRow>
            {rows.map((row) => {
              const goalDiff = row.goalsFor - row.goalsAgainst;

              return (
                <TableRow key={`${group}-${row.team.shortName}`}>
                  <TableCell className="font-semibold">{row.position}</TableCell>
                  <TableCell>
                    <TeamFlag team={row.team} showName size="sm" />
                  </TableCell>
                  <TableCell className="text-center">{row.played}</TableCell>
                  <TableCell className="text-center">{row.won}</TableCell>
                  <TableCell className="text-center">{row.drawn}</TableCell>
                  <TableCell className="text-center">{row.lost}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={goalDiff >= 0 ? "secondary" : "destructive"}>
                      {goalDiff > 0 ? `+${goalDiff}` : goalDiff}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-base font-bold">
                    {row.points}
                  </TableCell>
                </TableRow>
              );
            })}
          </tbody>
        ))}
      </Table>
    </div>
  );
}
