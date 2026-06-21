"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3Icon, LockIcon, ShirtIcon, SparklesIcon, TrophyIcon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BestTeamBuilder } from "@/components/palpite/best-team-builder";
import { BestTeamViewer } from "@/components/palpite/best-team-viewer";
import type { BestPlayerPageData } from "@/lib/palpite-live-data";

function formatMoment(value?: string) {
  if (!value) return "prazo ainda não definido";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Recife",
  }).format(new Date(value));
}

function useCountdown(closesAt?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!closesAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [closesAt]);
  if (!closesAt) return null;
  const remaining = Math.max(0, new Date(closesAt).getTime() - now);
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return { remaining, label: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` };
}

function WindowStatus({ closesAt }: { closesAt?: string }) {
  const countdown = useCountdown(closesAt);
  const ending = countdown && countdown.remaining <= 30 * 60_000;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${ending ? "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100" : "bg-muted/40"}`}>
      <div className="flex items-center gap-2"><Clock3Icon className="size-4" /><span className="font-semibold">Você tem até {formatMoment(closesAt)} para salvar.</span></div>
      {countdown ? <Badge variant={ending ? "default" : "secondary"} className="font-mono text-sm">{countdown.label}</Badge> : null}
    </div>
  );
}

function MessageCard({ icon: Icon, title, description }: {
  icon: typeof LockIcon;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed"><CardContent className="grid min-h-52 place-items-center p-6 text-center"><div className="space-y-3"><Icon className="mx-auto size-10 text-muted-foreground" /><div className="font-heading text-xl font-bold">{title}</div><p className="max-w-xl text-sm text-muted-foreground">{description}</p></div></CardContent></Card>
  );
}

export function BestPlayersHub({ groupId, data }: { groupId: string; data: BestPlayerPageData }) {
  const dailySelections = data.dailyVote?.selections ?? [];
  const roundSelections = data.roundVote?.selections ?? [];
  const resultSelections = data.result.map(({ playerId, slotIndex, selectedRole }) => ({ playerId, slotIndex, selectedRole }));
  const resultPlayers = useMemo(() => data.result.map((row) => row.player), [data.result]);
  const resultStats = useMemo(() => Object.fromEntries(data.result.map((row) => [row.playerId, {
    votes: row.roundVotes,
    percentage: data.roundBallotCount > 0
      ? Math.min(100, Math.round((row.roundVotes * 1_000) / data.roundBallotCount) / 10)
      : 0,
  }])), [data.result, data.roundBallotCount]);
  const [selectedGroupUserId, setSelectedGroupUserId] = useState(() => data.groupTeams[0]?.userId ?? "");
  const selectedGroupTeam = data.groupTeams.find((team) => team.userId === selectedGroupUserId) ?? data.groupTeams[0];
  const initialTab = data.roundWindow?.status === "open" ? "round" : "daily";

  return (
    <Tabs defaultValue={initialTab} className="gap-4">
      <TabsList className="grid h-auto w-full grid-cols-3">
        <TabsTrigger value="daily"><ShirtIcon />Time do Dia</TabsTrigger>
        <TabsTrigger value="round"><TrophyIcon />Time da Rodada</TabsTrigger>
        <TabsTrigger value="average"><SparklesIcon />Time Médio</TabsTrigger>
      </TabsList>

      <TabsContent value="daily" className="space-y-4">
        {data.roundWindow?.status === "finalized" && data.score ? (
          <Card className="border-amber-300 bg-amber-50/80 dark:bg-amber-950/30">
            <CardContent className="flex items-center gap-3 p-4 font-heading text-lg font-bold">
              <SparklesIcon className="size-5 shrink-0 text-amber-500" />
              Você acertou {data.score.hits} {data.score.hits === 1 ? "jogador" : "jogadores"} e ganhou {data.score.points} {data.score.points === 1 ? "ponto" : "pontos"}.
            </CardContent>
          </Card>
        ) : null}
        {!data.rules.dailyVotingEnabled ? (
          <MessageCard icon={LockIcon} title="Time do Dia desativado" description="O administrador desativou esta votação para o grupo." />
        ) : !data.dailyWindow ? (
          <MessageCard icon={Clock3Icon} title="Aguardando os jogos do dia" description="A votação abre depois que todos os jogos terminarem e os jogadores forem confirmados." />
        ) : data.dailyWindow.status === "scheduled" ? (
          <MessageCard icon={Clock3Icon} title="Aguardando o fim dos jogos" description="O campo será liberado quando os jogos do dia terminarem e os jogadores estiverem disponíveis." />
        ) : data.dailyWindow.status === "open" && data.dailyVote && !data.dailyWindow.allowEdit ? (
          <>
            <WindowStatus closesAt={data.dailyWindow.closesAt} />
            <BestTeamViewer title="Meu Time do Dia" formation={data.dailyVote.formation} players={data.dailyPlayers} selections={dailySelections} subtitle={data.dailyWindow.voteDate} />
          </>
        ) : data.dailyWindow.status === "open" && data.dailyPlayers.length >= 11 ? (
          <>
            <WindowStatus closesAt={data.dailyWindow.closesAt} />
            {data.dailyWindow.eligibilitySource === "squad" ? <Badge variant="secondary">Escalação indisponível: usando elenco completo</Badge> : <Badge variant="secondary">Somente jogadores que entraram em campo</Badge>}
            <BestTeamBuilder groupId={groupId} window={data.dailyWindow} players={data.dailyPlayers} initialFormation={data.dailyVote?.formation} initialSelections={dailySelections} />
            {data.dailyVote ? <BestTeamViewer title="Time do Dia salvo" formation={data.dailyVote.formation} players={data.dailyPlayers} selections={dailySelections} subtitle={data.dailyWindow.voteDate} /> : null}
          </>
        ) : data.dailyWindow.status === "open" ? (
          <MessageCard icon={Clock3Icon} title="Carregando jogadores" description="A fonte de dados ainda está preparando a lista de jogadores deste dia." />
        ) : data.dailyVote ? (
          <BestTeamViewer title="Meu Time do Dia" formation={data.dailyVote.formation} players={data.dailyPlayers} selections={dailySelections} subtitle={data.dailyWindow.voteDate} />
        ) : (
          <MessageCard icon={LockIcon} title="Votação do Time do Dia encerrada" description="Você não enviou um time antes do fechamento desta janela." />
        )}
      </TabsContent>

      <TabsContent value="round" className="space-y-4">
        {!data.rules.roundTeamVotingEnabled ? (
          <MessageCard icon={LockIcon} title="Time da Rodada desativado" description="O dono ou administrador ainda não ativou esta modalidade." />
        ) : !data.roundWindow ? (
          <MessageCard icon={Clock3Icon} title="O Time da Rodada ainda não foi liberado" description="O administrador precisa configurar a abertura e a duração da votação." />
        ) : data.roundWindow.status === "scheduled" ? (
          <MessageCard icon={Clock3Icon} title="O Time da Rodada ainda não foi liberado pelo administrador" description="A janela abrirá somente depois do fim real da rodada e do horário configurado." />
        ) : data.roundWindow.status === "open" && data.roundVote && !data.roundWindow.allowEdit ? (
          <>
            <WindowStatus closesAt={data.roundWindow.closesAt} />
            <BestTeamViewer title="Meu Time da Rodada" formation={data.roundVote.formation} players={data.roundPlayers} selections={roundSelections} subtitle={data.roundWindow.roundName} />
          </>
        ) : data.roundWindow.status === "open" && data.roundPlayers.length >= 11 ? (
          <>
            <WindowStatus closesAt={data.roundWindow.closesAt} />
            <BestTeamBuilder groupId={groupId} window={data.roundWindow} players={data.roundPlayers} initialFormation={data.roundVote?.formation} initialSelections={roundSelections} />
            {data.roundVote ? <BestTeamViewer title="Time da Rodada salvo" formation={data.roundVote.formation} players={data.roundPlayers} selections={roundSelections} subtitle={data.roundWindow.roundName} /> : null}
          </>
        ) : data.roundWindow.status === "open" ? (
          <MessageCard icon={ShirtIcon} title="Complete seus Times do Dia" description="Você precisa ter pelo menos 11 jogadores diferentes votados nos Times do Dia desta rodada." />
        ) : data.roundVote ? (
          <BestTeamViewer title="Meu Time da Rodada" formation={data.roundVote.formation} players={data.roundPlayers} selections={roundSelections} subtitle={data.roundWindow.roundName} />
        ) : (
          <MessageCard icon={LockIcon} title="Votação do Time da Rodada encerrada" description="O campo está em modo de leitura e novos votos não são aceitos." />
        )}
      </TabsContent>

      <TabsContent value="average" className="space-y-4">
        {data.roundWindow?.status === "finalized" && data.result.length === 11 && data.roundWindow.resultFormation ? (
          <>
            {data.score ? <Card className="border-amber-300 bg-amber-50/80 dark:bg-amber-950/30"><CardHeader><CardTitle className="flex items-center gap-2"><SparklesIcon className="text-amber-500" />Você acertou {data.score.hits} jogadores e ganhou {data.score.points} pontos</CardTitle></CardHeader></Card> : null}
            <BestTeamViewer
              title="Time Médio da Galera"
              formation={data.roundWindow.resultFormation}
              players={resultPlayers}
              selections={resultSelections}
              subtitle={data.roundWindow.roundName}
              score={data.score ?? undefined}
              playerStats={resultStats}
            />
            {data.groupTeams.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><UsersIcon className="text-emerald-600" />Times do grupo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {data.groupTeams.map((team) => (
                      <Button
                        key={team.userId}
                        type="button"
                        variant={selectedGroupTeam?.userId === team.userId ? "default" : "outline"}
                        className="h-auto justify-between py-3"
                        onClick={() => setSelectedGroupUserId(team.userId)}
                      >
                        <span className="truncate">{team.displayName}</span>
                        <span className="shrink-0 text-xs">{team.hits} acertos · {team.points} pts</span>
                      </Button>
                    ))}
                  </div>
                  {selectedGroupTeam ? (
                    <BestTeamViewer
                      title="Time da Rodada"
                      ownerName={selectedGroupTeam.displayName}
                      formation={selectedGroupTeam.formation}
                      players={data.roundPlayers}
                      selections={selectedGroupTeam.selections}
                      subtitle={data.roundWindow.roundName}
                      score={{ hits: selectedGroupTeam.hits, points: selectedGroupTeam.points }}
                    />
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : data.roundWindow?.status === "finalized" ? (
          <MessageCard icon={UsersIcon} title="Resultado sem votos suficientes" description="São necessários pelo menos dois Times da Rodada para formar o Time Médio e distribuir pontos." />
        ) : (
          <MessageCard icon={SparklesIcon} title="Resultado ainda não liberado" description="O Time Médio da Galera aparece automaticamente quando a votação da rodada fechar." />
        )}
      </TabsContent>
    </Tabs>
  );
}
