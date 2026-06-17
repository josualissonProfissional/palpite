import { SettingsIcon } from "lucide-react";
import { AppShell } from "@/components/palpite/app-shell";
import { EmptyState } from "@/components/palpite/empty-state";
import { GroupInviteSettings } from "@/components/palpite/group-invite-settings";
import { ScreenHeader } from "@/components/palpite/screen-header";
import { ScoringRulesForm } from "@/components/palpite/scoring-rules-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGroupData, getScoringRules, getWorldCupData } from "@/lib/palpite-live-data";

export const dynamic = "force-dynamic";

export default async function RulesPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = await params;
  const [worldCup, groupData] = await Promise.all([getWorldCupData(), getGroupData(groupSlug)]);
  const rules = await getScoringRules(groupData.group?.id);

  return (
    <AppShell groupName={groupData.group?.name ?? "Grupo"} groupSlug={groupSlug} teams={worldCup.teams}>
      <ScreenHeader icon={SettingsIcon} eyebrow="Administracao" title="Regras de pontuacao" description="Os participantes visualizam as regras. Donos e administradores podem alterar a pontuacao." action={<Badge variant="secondary">Apenas administradores</Badge>} />
      <section className="grid gap-4 lg:grid-cols-[1fr_420px]">
        {!rules ? (
          <EmptyState icon={SettingsIcon} title="Regras nao definidas" description="As regras de pontuacao deste grupo ainda nao foram configuradas." />
        ) : (
          <Card className="border-white/70 bg-white/86 backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
            <CardHeader><CardTitle className="font-heading text-2xl">Configurar pontos</CardTitle></CardHeader>
            <CardContent>
              <ScoringRulesForm groupId={groupData.group?.id} rules={rules} />
            </CardContent>
          </Card>
        )}
        <Card className="border-white/70 bg-white/86 backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
          <CardHeader><CardTitle className="font-heading text-2xl">Resumo atual</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {rules ? [["Placar exato", `${rules.exactScorePoints} pts`], ["Vencedor", `${rules.correctWinnerPoints} pts`], ["Empate", `${rules.correctDrawPoints} pts`], ["Bloqueio", `${rules.lockPredictionMinutesBefore} min`], ["Politica inversa", rules.inverseScorePolicy]].map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-white/70 p-3 dark:bg-slate-950/60"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="font-semibold">{label}</div><Badge className="w-fit">{value}</Badge></div></div>
            )) : <p className="text-sm text-muted-foreground">Nenhuma regra definida ainda.</p>}
          </CardContent>
        </Card>
        <Card className="border-white/70 bg-white/86 backdrop-blur dark:border-white/10 dark:bg-slate-950/70 lg:col-start-2">
          <CardHeader><CardTitle className="font-heading text-2xl">Convites do grupo</CardTitle></CardHeader>
          <CardContent>
            <GroupInviteSettings group={groupData.group} />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
