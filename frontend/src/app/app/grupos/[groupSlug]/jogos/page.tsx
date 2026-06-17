import { CalendarDaysIcon, RadioIcon } from "lucide-react";
import { AppShell } from "@/components/palpite/app-shell";
import { MatchList } from "@/components/palpite/match-card";
import { ScreenHeader } from "@/components/palpite/screen-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getGroupData, getGroupWorldCupData } from "@/lib/palpite-live-data";

export const dynamic = "force-dynamic";

export default async function MatchesPage({
  params,
}: {
  params: Promise<{ groupSlug: string }>;
}) {
  const { groupSlug } = await params;
  const groupData = await getGroupData(groupSlug);
  const worldCup = await getGroupWorldCupData(groupData.group?.id);

  return (
    <AppShell
      groupName={groupData.group?.name ?? "Grupo"}
      groupSlug={groupSlug}
      teams={worldCup.teams}
    >
      <ScreenHeader
        icon={CalendarDaysIcon}
        eyebrow="Jogos / Palpites"
        title="Palpites da rodada"
        description="Jogos agendados permitem palpite antes do bloqueio. Jogos ao vivo, intervalo e finalizados ficam travados."
        action={<Badge className="gap-1"><RadioIcon className="size-3" /> Atualizacao ao vivo</Badge>}
      />
      <Alert className="border-orange-200 bg-orange-50/85 dark:border-orange-500/30 dark:bg-orange-950/40">
        <CalendarDaysIcon className="size-4" />
        <AlertTitle>Salvar palpite</AlertTitle>
        <AlertDescription>
          Voce pode dar seu palpite ate o jogo comecar. Depois disso ele fica
          bloqueado e nao pode mais ser alterado.
        </AlertDescription>
      </Alert>
      <MatchList matches={worldCup.matches} groupId={groupData.group?.id} groupName={groupData.group?.name} />
    </AppShell>
  );
}
