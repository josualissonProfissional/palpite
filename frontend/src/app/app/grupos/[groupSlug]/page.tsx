import { DashboardScreen } from "@/components/palpite/screens/dashboard-screen";
import { getGroupData, getGroupWorldCupData, getRanking } from "@/lib/palpite-live-data";

export const dynamic = "force-dynamic";

export default async function GroupDashboardPage({
  params,
}: {
  params: Promise<{ groupSlug: string }>;
}) {
  const { groupSlug } = await params;
  const groupData = await getGroupData(groupSlug);
  const [worldCup, ranking] = await Promise.all([
    getGroupWorldCupData(groupData.group?.id),
    getRanking(groupData.group?.id),
  ]);

  return (
    <DashboardScreen
      matches={worldCup.matches}
      standings={worldCup.standings}
      ranking={ranking}
      teams={worldCup.teams}
      group={groupData.group}
      configured={worldCup.configured && groupData.configured}
    />
  );
}
