import { ShirtIcon } from "lucide-react";
import { AppShell } from "@/components/palpite/app-shell";
import { BestPlayersHub } from "@/components/palpite/best-players-hub";
import { ScreenHeader } from "@/components/palpite/screen-header";
import { getBestPlayerPageData, getGroupData, getWorldCupData } from "@/lib/palpite-live-data";

export const dynamic = "force-dynamic";

export default async function TimesPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = await params;
  const [worldCup, groupData] = await Promise.all([getWorldCupData(), getGroupData(groupSlug)]);
  const data = await getBestPlayerPageData(groupData.group?.id);
  const groupName = groupData.group?.name ?? "Grupo";

  return (
    <AppShell groupName={groupName} groupSlug={groupSlug} teams={worldCup.teams}>
      <ScreenHeader
        icon={ShirtIcon}
        eyebrow="Times da galera"
        title="Escolha os melhores da Copa"
        description="Monte seu Time do Dia, participe da rodada e compare suas escolhas com o Time Médio do grupo."
      />
      {groupData.group?.id ? <BestPlayersHub groupId={groupData.group.id} data={data} /> : null}
    </AppShell>
  );
}
