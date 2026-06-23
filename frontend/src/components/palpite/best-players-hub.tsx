"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3Icon, CopyIcon, DownloadIcon, ImageIcon, LockIcon, Share2Icon, ShirtIcon, SparklesIcon, TrophyIcon, UsersIcon } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BestTeamBuilder } from "@/components/palpite/lazy";
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

function MessageCard({ icon: Icon, title, description }: { icon: typeof LockIcon; title: string; description: string }) {
  return (
    <Card className="border-dashed"><CardContent className="grid min-h-52 place-items-center p-6 text-center"><div className="space-y-3"><Icon className="mx-auto size-10 text-muted-foreground" /><div className="font-heading text-xl font-bold">{title}</div><p className="max-w-xl text-sm text-muted-foreground">{description}</p></div></CardContent></Card>
  );
}

export function BestPlayersHub({ groupId, data, initialTab }: {
  groupId: string;
  data: BestPlayerPageData;
  initialTab?: "daily" | "round" | "average";
}) {
  const dailySelections = data.dailyVote?.selections ?? [];
  const roundSelections = data.roundVote?.selections ?? [];
  const resultSelections = data.result.map(({ playerId, slotIndex, selectedRole }) => ({ playerId, slotIndex, selectedRole }));
  const resultPlayers = useMemo(() => data.result.map((row) => row.player), [data.result]);
  const resultStats = useMemo(() => Object.fromEntries(data.result.map((row) => [row.playerId, {
    votes: row.roundVotes,
    percentage: data.roundBallotCount > 0 ? Math.min(100, Math.round((row.roundVotes * 1_000) / data.roundBallotCount) / 10) : 0,
  }])), [data.result, data.roundBallotCount]);
  const [selectedGroupUserId, setSelectedGroupUserId] = useState(() => data.groupTeams[0]?.userId ?? "");
  const selectedGroupTeam = data.groupTeams.find((team) => team.userId === selectedGroupUserId) ?? data.groupTeams[0];
  const defaultTab = initialTab ?? (data.roundWindow?.status === "open" ? "round" : "daily");

  const dailyResultSelections = useMemo(() => data.dailyResult.map(({ playerId, slotIndex, selectedRole }) => ({ playerId, slotIndex, selectedRole })), [data.dailyResult]);
  const dailyResultPlayers = useMemo(() => data.dailyResult.map((row) => row.player), [data.dailyResult]);
  const dailyResultStats = useMemo(() => Object.fromEntries(data.dailyResult.map((row) => [row.playerId, {
    votes: row.roundVotes,
    percentage: data.dailyBallotCount > 0 ? Math.min(100, Math.round((row.roundVotes * 1_000) / data.dailyBallotCount) / 10) : 0,
  }])), [data.dailyResult, data.dailyBallotCount]);
  const [selectedDailyGroupUserId, setSelectedDailyGroupUserId] = useState(() => data.dailyGroupTeams[0]?.userId ?? "");
  const selectedDailyGroupTeam = data.dailyGroupTeams.find((team) => team.userId === selectedDailyGroupUserId) ?? data.dailyGroupTeams[0];


  // Detecta expiracao local do countdown para travar a UI imediatamente,
  // sem esperar o proximo sync-live atualizar o status no banco.
  const dailyCountdown = useCountdown(data.dailyWindow?.status === "open" ? data.dailyWindow.closesAt : undefined);
  const dailyExpired = dailyCountdown !== null && dailyCountdown.remaining <= 0;
  const roundCountdown = useCountdown(data.roundWindow?.status === "open" ? data.roundWindow.closesAt : undefined);
  const roundExpired = roundCountdown !== null && roundCountdown.remaining <= 0;
  const dailyOpen = data.dailyWindow?.status === "open" && !dailyExpired;
  const roundOpen = data.roundWindow?.status === "open" && !roundExpired;
  // Dados do último Time do Dia finalizado (parse via JSON string)
  const last = useMemo(() => {
    try { return data.lastFinalizedDailyJson ? JSON.parse(data.lastFinalizedDailyJson) : null; }
    catch { return null; }
  }, [data.lastFinalizedDailyJson]) as typeof data.lastFinalizedDaily;


  // Compartilhamento do resultado anterior

  // Segundo dia anterior (paginacao)
  const older = useMemo(() => {
    try { return data.olderFinalizedDailyJson ? JSON.parse(data.olderFinalizedDailyJson) : null; }
    catch { return null; }
  }, [data.olderFinalizedDailyJson]) as typeof data.lastFinalizedDaily;
  const [showingOlder, setShowingOlder] = useState(false);
  const activePrevious = showingOlder && older ? older : last;
  const activePreviousSelections = useMemo(() => activePrevious?.result.map(({ playerId, slotIndex, selectedRole }: any) => ({ playerId, slotIndex, selectedRole })) ?? [], [activePrevious]);
  const activePreviousPlayers = useMemo(() => activePrevious?.allPlayers ?? [], [activePrevious]);
  const activePreviousStats = useMemo(() => {
    if (!activePrevious) return {};
    return Object.fromEntries(activePrevious.result.map((row: any) => [row.playerId, {
      votes: row.roundVotes,
      percentage: activePrevious.ballotCount > 0 ? Math.min(100, Math.round((row.roundVotes * 1_000) / activePrevious.ballotCount) / 10) : 0,
    }]));
  }, [activePrevious]);
  const [selectedPrevUserId, setSelectedPrevUserId] = useState(() => activePrevious?.groupTeams[0]?.userId ?? "");
  const selectedPrevTeam = activePrevious?.groupTeams.find((t: any) => t.userId === selectedPrevUserId) ?? activePrevious?.groupTeams[0];
  const prevCorrectIds = useMemo(() => {
    if (!selectedPrevTeam || !activePrevious) return undefined;
    const resultByPlayer = new Map(activePrevious.result.map((r: any) => [r.playerId, r.selectedRole]));
    const correct = new Set<string>();
    for (const s of selectedPrevTeam.selections) {
      if (resultByPlayer.get(s.playerId) === s.selectedRole) correct.add(s.playerId);
    }
    return correct;
  }, [selectedPrevTeam, activePrevious]);
  const captureRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  async function handleShareImage() {
    if (!captureRef.current) return;
    setGenerating(true);
    try {
      await new Promise(r => setTimeout(r, 200));
      const dataUrl = await toPng(captureRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `time-do-dia-${activePrevious?.window.voteDate ?? "data"}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Imagem salva!");
    } catch {
      toast.error("Não foi possível gerar a imagem.");
    } finally { setGenerating(false); }
  }

  function buildShareText() {
    if (!activePrevious) return "";
    const date = activePrevious?.window.voteDate ?? "";
    const lines = [`🏆 Time do Dia — ${date}`];
    if (activePrevious?.score) lines.push(`Meus acertos: ${activePrevious?.score?.hits} · ${activePrevious?.score?.points} pts`);
    lines.push("", "📋 Placar:");
    activePrevious.groupTeams.forEach((t: any, i: number) => {
      const m = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`;
      lines.push(`${m} ${t.displayName}: ${t.hits} acertos · ${t.points} pts`);
    });
    lines.push("", "Montado no Palpitô ✦ palpitô.shop");
    return lines.join("\n");
  }

  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(buildShareText());
      toast.success("Placar copiado!");
    } catch { toast.error("Não foi possível copiar."); }
  }

  return (
    <Tabs defaultValue={defaultTab} className="gap-4">
      <TabsList className="grid h-auto w-full grid-cols-3">
        <TabsTrigger value="daily"><ShirtIcon />Time do Dia</TabsTrigger>
        <TabsTrigger value="round"><TrophyIcon />Time da Rodada</TabsTrigger>
        <TabsTrigger value="average"><SparklesIcon />Time Médio</TabsTrigger>
      </TabsList>

      <TabsContent value="daily" className="space-y-4">
        {data.dailyWindow?.status === "finalized" && data.dailyScore ? (
          <Card className="border-amber-300 bg-amber-50/80 dark:bg-amber-950/30">
            <CardContent className="flex items-center gap-3 p-4 font-heading text-lg font-bold">
              <SparklesIcon className="size-5 shrink-0 text-amber-500" />
              Você acertou {data.dailyScore.hits} {data.dailyScore.hits === 1 ? "jogador" : "jogadores"} e ganhou {data.dailyScore.points} {data.dailyScore.points === 1 ? "ponto" : "pontos"}.
            </CardContent>
          </Card>
        ) : null}
        {!data.rules.dailyVotingEnabled ? (
          <MessageCard icon={LockIcon} title="Time do Dia desativado" description="O administrador desativou esta votação para o grupo." />
        ) : !data.dailyWindow ? (
          <MessageCard icon={Clock3Icon} title="Aguardando os jogos do dia" description="A votação abre depois que todos os jogos terminarem e os jogadores forem confirmados." />
        ) : data.dailyWindow.status === "scheduled" ? (
          <MessageCard
            icon={Clock3Icon}
            title="Aguardando o fim dos jogos"
            description={
              data.dailyPendingMatch
                ? `Votação será aberta após ${data.dailyPendingMatch.homeName} x ${data.dailyPendingMatch.awayName} (início ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Recife" }).format(new Date(data.dailyPendingMatch.matchDate))})`
                : "O campo será liberado quando os jogos do dia terminarem e os jogadores estiverem disponíveis."
            }
          />
        ) : dailyOpen && data.dailyVote && !data.dailyWindow.allowEdit ? (
          <>
            <WindowStatus closesAt={data.dailyWindow.closesAt} />
            <BestTeamViewer title="Meu Time do Dia" formation={data.dailyVote.formation} players={data.dailyPlayers} selections={dailySelections} subtitle={data.dailyWindow.voteDate} />
          </>
        ) : dailyOpen && data.dailyPlayers.length >= 11 ? (
          <>
            <WindowStatus closesAt={data.dailyWindow.closesAt} />
            {data.dailyWindow.eligibilitySource === "squad" ? <Badge variant="secondary">Escalação indisponível: usando elenco completo</Badge> : <Badge variant="secondary">Somente jogadores que entraram em campo</Badge>}
            <BestTeamBuilder groupId={groupId} window={data.dailyWindow} players={data.dailyPlayers} initialFormation={data.dailyVote?.formation} initialSelections={dailySelections} />
            {data.dailyVote ? <BestTeamViewer title="Time do Dia salvo" formation={data.dailyVote.formation} players={data.dailyPlayers} selections={dailySelections} subtitle={data.dailyWindow.voteDate} /> : null}
          </>
        ) : dailyOpen ? (
          <MessageCard icon={Clock3Icon} title="Carregando jogadores" description="A fonte de dados ainda está preparando a lista de jogadores deste dia." />
        ) : data.dailyWindow.status === "finalized" && data.dailyResult.length === 11 && data.dailyWindow.resultFormation ? (
          <>
            {data.dailyPendingMatch ? (
              <Card className="border-sky-300 bg-sky-50/80 dark:bg-sky-950/30">
                <CardContent className="flex items-center gap-3 p-4">
                  <Clock3Icon className="size-5 shrink-0 text-sky-500" />
                  <div>
                    <div className="font-heading text-base font-bold">Próxima votação</div>
                    <p className="text-sm text-muted-foreground">Abre após {data.dailyPendingMatch.homeName} x {data.dailyPendingMatch.awayName} (início {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Recife" }).format(new Date(data.dailyPendingMatch.matchDate))})</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            {data.dailyScore ? (
              <Card className="border-amber-300 bg-amber-50/80 dark:bg-amber-950/30">
                <CardContent className="flex items-center gap-3 p-4 font-heading text-lg font-bold">
                  <SparklesIcon className="size-5 shrink-0 text-amber-500" />
                  Você acertou {data.dailyScore.hits} {data.dailyScore.hits === 1 ? "jogador" : "jogadores"} e ganhou {data.dailyScore.points} {data.dailyScore.points === 1 ? "ponto" : "pontos"}.
                </CardContent>
              </Card>
            ) : null}
            <BestTeamViewer title="Time do Dia da Galera" formation={data.dailyWindow.resultFormation} players={dailyResultPlayers} selections={dailyResultSelections} subtitle={data.dailyWindow.voteDate} score={data.dailyScore ?? undefined} playerStats={dailyResultStats} />
            {data.dailyGroupTeams.length > 0 ? (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><UsersIcon className="text-emerald-600" />Placar do dia</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    {data.dailyGroupTeams.map((team, index) => {
                      const isSelected = selectedDailyGroupTeam?.userId === team.userId;
                      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
                      return (
                        <Button key={team.userId} type="button" variant={isSelected ? "default" : "ghost"} className="flex w-full items-center justify-between gap-3 px-4 py-3 h-auto" onClick={() => setSelectedDailyGroupUserId(team.userId)}>
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="shrink-0 w-8 text-center text-sm font-bold tabular-nums">{medal || `${index + 1}º`}</span>
                            <span className="truncate text-sm font-semibold">{team.displayName}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-3 text-xs">
                            <span className="font-bold tabular-nums">{team.hits} {team.hits === 1 ? "acerto" : "acertos"}</span>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-black tabular-nums">{team.points} pts</span>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                  {selectedDailyGroupTeam ? (
                    <>
                      <div className="border-t pt-3" />
                      <BestTeamViewer title="Time do Dia" ownerName={selectedDailyGroupTeam.displayName} formation={selectedDailyGroupTeam.formation} players={dailyResultPlayers} selections={selectedDailyGroupTeam.selections} subtitle={data.dailyWindow.voteDate} score={{ hits: selectedDailyGroupTeam.hits, points: selectedDailyGroupTeam.points }} />
                    </>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : data.dailyWindow.status === "finalized" ? (
          <MessageCard icon={UsersIcon} title="Resultado sem votos suficientes" description="São necessários pelo menos dois Times do Dia para formar o time médio e distribuir pontos." />
        ) : data.dailyVote ? (
          <BestTeamViewer title="Meu Time do Dia" formation={data.dailyVote.formation} players={data.dailyPlayers} selections={dailySelections} subtitle={data.dailyWindow.voteDate} />
        ) : (
          <MessageCard icon={LockIcon} title="Votação do Time do Dia encerrada" description="Você não enviou um time antes do fechamento desta janela." />
        )}

        {/* Resultado do dia anterior */}
        {activePrevious && data.dailyWindow?.status !== "finalized" && activePrevious.result.length === 11 ? (
          <div className="mt-6 border-t pt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-heading text-lg font-bold">Resultado anterior — {activePrevious.window.voteDate}</div>
                {(older || showingOlder) ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant={showingOlder ? "default" : "outline"} onClick={() => setShowingOlder(false)} disabled={!showingOlder} className="text-xs h-7 px-2">Ontem</Button>
                    <Button size="sm" variant={showingOlder ? "outline" : "default"} onClick={() => setShowingOlder(true)} disabled={showingOlder || !older} className="text-xs h-7 px-2">{older?.window.voteDate ?? "Anterior"}</Button>
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleShareImage} disabled={generating}>
                  {generating ? <DownloadIcon className="animate-pulse" /> : <ImageIcon />}
                  <span className="hidden sm:inline ml-1">{generating ? "Gerando..." : "Salvar imagem"}</span>
                </Button>
                <Button size="sm" variant="outline" onClick={handleCopyText}>
                  <CopyIcon />
                  <span className="hidden sm:inline ml-1">Copiar texto</span>
                </Button>
              </div>
            </div>

            {/* Área capturável para imagem */}
            <div ref={captureRef} className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
              <div className="text-center">
                <div className="font-heading text-xl font-black">Time do Dia — {activePrevious.window.voteDate}</div>
              </div>
              {activePrevious?.score ? (
                <Card className="border-amber-300 bg-amber-50/80 dark:bg-amber-950/30">
                  <CardContent className="flex items-center gap-3 p-4 font-heading text-lg font-bold">
                    <SparklesIcon className="size-5 shrink-0 text-amber-500" />
                    Você acertou {activePrevious?.score?.hits} {activePrevious.score.hits === 1 ? "jogador" : "jogadores"} e ganhou {activePrevious?.score?.points} {activePrevious.score.points === 1 ? "ponto" : "pontos"}.
                  </CardContent>
                </Card>
              ) : null}
              <BestTeamViewer title="Time do Dia da Galera" formation={activePrevious.window.resultFormation ?? "4-3-3"} players={activePreviousPlayers} selections={activePreviousSelections} subtitle={activePrevious.window.voteDate} score={activePrevious?.score ?? undefined} playerStats={activePreviousStats} shareable={false} />
              {activePrevious.groupTeams.length > 0 ? (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><UsersIcon className="text-emerald-600" />Placar do dia</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {activePrevious.groupTeams.map((team: any, index: number) => {
                      const m = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}º`;
                      return (
                        <div key={team.userId} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 bg-muted/40">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0 w-7 text-center text-sm font-bold">{m}</span>
                            <span className="truncate text-sm font-semibold">{team.displayName}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-xs">
                            <span className="font-bold tabular-nums">{team.hits} ac</span>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-black tabular-nums">{team.points} pts</span>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ) : null}
              <div className="text-center text-xs font-bold text-muted-foreground">Palpitô · Copa do Mundo 2026</div>
            </div>

            {/* Times individuais (fora da captura) */}
            {activePrevious.groupTeams.length > 0 ? (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><UsersIcon className="text-emerald-600" />Times do grupo</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    {activePrevious.groupTeams.map((team: any, index: number) => {
                      const isSelected = selectedPrevTeam?.userId === team.userId;
                      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
                      return (
                        <Button key={team.userId} type="button" variant={isSelected ? "default" : "ghost"} className="flex w-full items-center justify-between gap-3 px-4 py-3 h-auto" onClick={() => setSelectedPrevUserId(team.userId)}>
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="shrink-0 w-8 text-center text-sm font-bold tabular-nums">{medal || `${index + 1}º`}</span>
                            <span className="truncate text-sm font-semibold">{team.displayName}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-3 text-xs">
                            <span className="font-bold tabular-nums">{team.hits} {team.hits === 1 ? "acerto" : "acertos"}</span>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-black tabular-nums">{team.points} pts</span>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                  {selectedPrevTeam ? (
                    <>
                      <div className="border-t pt-3" />
                      <BestTeamViewer title="Time do Dia" ownerName={selectedPrevTeam.displayName} formation={selectedPrevTeam.formation} players={activePreviousPlayers} selections={selectedPrevTeam.selections} subtitle={activePrevious.window.voteDate} score={{ hits: selectedPrevTeam.hits, points: selectedPrevTeam.points }} correctPlayerIds={prevCorrectIds} />
                    </>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </TabsContent>

      <TabsContent value="round" className="space-y-4">
        {!data.rules.roundTeamVotingEnabled ? (
          <MessageCard icon={LockIcon} title="Time da Rodada desativado" description="O dono ou administrador ainda não ativou esta modalidade." />
        ) : !data.roundWindow ? (
          <MessageCard icon={Clock3Icon} title="O Time da Rodada ainda não foi liberado" description="O administrador precisa configurar a abertura e a duração da votação." />
        ) : data.roundWindow.status === "scheduled" ? (
          <MessageCard icon={Clock3Icon} title="O Time da Rodada ainda não foi liberado pelo administrador" description="A janela abrirá somente depois do fim real da rodada e do horário configurado." />
        ) : roundOpen && data.roundVote && !data.roundWindow.allowEdit ? (
          <>
            <WindowStatus closesAt={data.roundWindow.closesAt} />
            <BestTeamViewer title="Meu Time da Rodada" formation={data.roundVote.formation} players={data.roundPlayers} selections={roundSelections} subtitle={data.roundWindow.roundName} />
          </>
        ) : roundOpen && data.roundPlayers.length >= 11 ? (
          <>
            <WindowStatus closesAt={data.roundWindow.closesAt} />
            <BestTeamBuilder groupId={groupId} window={data.roundWindow} players={data.roundPlayers} initialFormation={data.roundVote?.formation} initialSelections={roundSelections} />
            {data.roundVote ? <BestTeamViewer title="Time da Rodada salvo" formation={data.roundVote.formation} players={data.roundPlayers} selections={roundSelections} subtitle={data.roundWindow.roundName} /> : null}
          </>
        ) : roundOpen ? (
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
            <BestTeamViewer title="Time Médio da Galera" formation={data.roundWindow.resultFormation} players={resultPlayers} selections={resultSelections} subtitle={data.roundWindow.roundName} score={data.score ?? undefined} playerStats={resultStats} />
            {data.groupTeams.length > 0 ? (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><UsersIcon className="text-emerald-600" />Times do grupo</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {data.groupTeams.map((team) => (
                      <Button key={team.userId} type="button" variant={selectedGroupTeam?.userId === team.userId ? "default" : "outline"} className="h-auto justify-between py-3" onClick={() => setSelectedGroupUserId(team.userId)}>
                        <span className="truncate">{team.displayName}</span>
                        <span className="shrink-0 text-xs">{team.hits} acertos · {team.points} pts</span>
                      </Button>
                    ))}
                  </div>
                  {selectedGroupTeam ? (
                    <BestTeamViewer title="Time da Rodada" ownerName={selectedGroupTeam.displayName} formation={selectedGroupTeam.formation} players={data.roundPlayers} selections={selectedGroupTeam.selections} subtitle={data.roundWindow.roundName} score={{ hits: selectedGroupTeam.hits, points: selectedGroupTeam.points }} />
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
