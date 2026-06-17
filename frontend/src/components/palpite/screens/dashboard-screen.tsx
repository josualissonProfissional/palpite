import {
  CalendarDaysIcon,
  ChartNoAxesColumnIncreasingIcon,
  RadioIcon,
  ShieldIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";
import { AppShell } from "@/components/palpite/app-shell";
import { EmptyState } from "@/components/palpite/empty-state";
import { MatchList } from "@/components/palpite/match-card";
import { RankingTable } from "@/components/palpite/ranking-table";
import { LiveStandings } from "@/components/palpite/live-standings";
import { TeamFlag } from "@/components/palpite/team-flag";
import { ThemeToggle } from "@/components/palpite/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NeonGradientCard } from "@/components/ui/neon-gradient-card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GroupSummary, Match, RankingRow, Standing, Team } from "@/lib/palpite-data";

type DashboardScreenProps = {
  matches: Match[];
  standings: Standing[];
  ranking: RankingRow[];
  teams: Team[];
  group?: GroupSummary | null;
  configured: boolean;
};

export function DashboardScreen({
  matches,
  standings,
  ranking,
  teams,
  group,
  configured,
}: DashboardScreenProps) {
  const groupName = group?.name ?? "Grupo";
  const liveMatches = matches.filter((match) => match.status === "live").length;
  const scheduledMatches = matches.filter((match) => match.status === "scheduled").length;
  const userRanking = ranking[0]?.position ? `${ranking[0].position}o` : "-";
  const progress = matches.length > 0 ? Math.round((matches.filter((match) => match.status === "finished").length / matches.length) * 100) : 0;

  return (
    <AppShell groupName={groupName} groupSlug={group?.slug} teams={teams}>
      <NeonGradientCard
        borderSize={2}
        borderRadius={18}
        neonColors={{ firstColor: "#2563eb", secondColor: "#00fff1" }}
        className="min-h-0"
      >
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Badge className="mb-2 gap-1 bg-orange-500 text-white hover:bg-orange-500">
            <RadioIcon className="size-3" />
            {liveMatches > 0 ? "Rodada ao vivo" : "Tudo atualizado"}
          </Badge>
          <h1 className="font-heading text-3xl font-bold tracking-normal text-slate-950 dark:text-white sm:text-4xl md:text-5xl">
            {groupName}
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            {configured
              ? "Acompanhe seus palpites, a classificacao e o ranking em tempo real."
              : "Estamos preparando tudo. Em instantes seus jogos e palpites aparecem aqui."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {teams.slice(0, 3).map((team) => (
            <TeamFlag key={team.id ?? team.name} team={team} />
          ))}
          <ThemeToggle />
          <Button className="w-full sm:w-auto">
            <TrophyIcon className="size-4" />
            Novo palpite
          </Button>
        </div>
      </header>
      </NeonGradientCard>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CalendarDaysIcon} label="Jogos" value={String(matches.length)} detail={`${scheduledMatches} abertos`} />
        <MetricCard icon={ShieldIcon} label="Ao vivo" value={String(liveMatches)} detail="jogos acontecendo agora" />
        <MetricCard icon={ChartNoAxesColumnIncreasingIcon} label="Posicao" value={userRanking} detail="sua colocacao no ranking" />
        <MetricCard icon={UsersIcon} label="Ranking" value={String(ranking.length)} detail="participantes listados" />
      </section>

      <Tabs defaultValue="jogos" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 bg-white/80 md:w-fit dark:bg-slate-950/70">
          <TabsTrigger value="jogos">Jogos</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="copa">Copa</TabsTrigger>
        </TabsList>
        <TabsContent value="jogos" className="space-y-4">
          <MatchList matches={matches} groupId={group?.id} groupName={groupName} />
        </TabsContent>
        <TabsContent value="ranking" className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <RankingTable ranking={ranking} />
          <Card className="border-white/70 bg-white/86 backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
            <CardHeader>
              <CardTitle className="font-heading text-2xl">Estado do ranking</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={ChartNoAxesColumnIncreasingIcon}
                title="Sem grafico ainda"
                description="O grafico de evolucao aparece aqui assim que houver historico suficiente de pontuacao."
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="copa" className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <LiveStandings initialStandings={standings} />
          <Card className="border-white/70 bg-white/86 backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
            <CardHeader>
              <CardTitle className="font-heading text-2xl">Progresso do bolao</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold">Palpites da rodada</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
                <Progress value={progress} />
              </div>
              <Separator />
              <div className="grid gap-3">
                {teams.slice(0, 3).map((team) => (
                  <div key={team.shortName} className="flex items-center justify-between rounded-lg border bg-white/70 p-3 dark:border-white/10 dark:bg-slate-950/60">
                    <TeamFlag team={team} showName size="sm" />
                    <Badge variant="secondary">Em disputa</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof TrophyIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="border-white/70 bg-white/86 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
          <div className="font-heading text-3xl font-bold leading-none text-slate-950 dark:text-white">{value}</div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">{detail}</div>
        </div>
      </CardContent>
    </Card>
  );
}
