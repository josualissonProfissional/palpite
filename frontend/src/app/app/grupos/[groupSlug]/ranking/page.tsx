import { ChartNoAxesColumnIncreasingIcon, RefreshCcwIcon } from "lucide-react";
import { AppShell } from "@/components/palpite/app-shell";
import { EmptyState } from "@/components/palpite/empty-state";
import { RankingTable } from "@/components/palpite/ranking-table";
import { ResetRankingButton } from "@/components/palpite/reset-ranking-button";
import { ScreenHeader } from "@/components/palpite/screen-header";
import { ShareGroupSummary } from "@/components/palpite/share-group-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getGroupData, getRanking, getWorldCupData } from "@/lib/palpite-live-data";

export const dynamic = "force-dynamic";

export default async function RankingPage({
  params,
}: {
  params: Promise<{ groupSlug: string }>;
}) {
  const { groupSlug } = await params;
  const [worldCup, groupData] = await Promise.all([
    getWorldCupData(),
    getGroupData(groupSlug),
  ]);
  const ranking = await getRanking(groupData.group?.id);
  const groupName = groupData.group?.name ?? "Grupo";
  const canResetRanking = groupData.group?.role === "owner" || groupData.group?.role === "admin";

  return (
    <AppShell groupName={groupName} groupSlug={groupSlug} teams={worldCup.teams}>
      <ScreenHeader
        icon={ChartNoAxesColumnIncreasingIcon}
        eyebrow="Ranking"
        title="Ranking do grupo"
        description="A classificacao atualiza automaticamente conforme os resultados dos jogos saem."
        action={
          <div className="flex flex-wrap gap-2">
            <ShareGroupSummary groupId={groupData.group?.id} groupName={groupName} ranking={ranking} />
            {canResetRanking ? <ResetRankingButton groupId={groupData.group?.id} /> : null}
            <Button variant="secondary"><RefreshCcwIcon className="size-4" /> Atualizar</Button>
          </div>
        }
      />
      <Card className="border-white/70 bg-white/86 backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
        <CardContent className="grid gap-3 p-4 md:grid-cols-5">
          <div className="space-y-2"><Label htmlFor="round">Rodada</Label><Input id="round" placeholder="Rodada 1" /></div>
          <div className="space-y-2"><Label htmlFor="date">Dia</Label><Input id="date" type="date" /></div>
          <div className="space-y-2"><Label htmlFor="stage">Fase</Label><Input id="stage" placeholder="Fase de grupos" /></div>
          <div className="space-y-2"><Label htmlFor="from">De</Label><Input id="from" type="date" /></div>
          <div className="space-y-2"><Label htmlFor="to">Ate</Label><Input id="to" type="date" /></div>
        </CardContent>
      </Card>
      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <RankingTable ranking={ranking} />
        <Card className="border-white/70 bg-white/86 backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
          <CardHeader><CardTitle className="font-heading text-2xl">Historico</CardTitle></CardHeader>
          <CardContent>
            <EmptyState icon={ChartNoAxesColumnIncreasingIcon} title="Sem historico ainda" description="O grafico de evolucao aparece aqui assim que houver pontuacao acumulada nas rodadas." />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
