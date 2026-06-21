import { DashboardScreen } from "@/components/palpite/screens/dashboard-screen";
import { getGroupData, getGroupWorldCupData, getRanking, getScoringRules } from "@/lib/palpite-live-data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GroupDashboardPage({
  params,
}: {
  params: Promise<{ groupSlug: string }>;
}) {
  const { groupSlug } = await params;
  const groupData = await getGroupData(groupSlug);
  const [worldCup, ranking, scoringRules] = await Promise.all([
    getGroupWorldCupData(groupData.group?.id),
    getRanking(groupData.group?.id),
    getScoringRules(groupData.group?.id),
  ]);
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const currentUserPosition = user ? ranking.find((row) => row.userId === user.id)?.position : undefined;

  return (
    <DashboardScreen
      matches={worldCup.matches}
      standings={worldCup.standings}
      ranking={ranking}
      teams={worldCup.teams}
      group={groupData.group}
      currentUserPosition={currentUserPosition}
      lockPredictionMinutesBefore={scoringRules?.lockPredictionMinutesBefore ?? 10}
      configured={worldCup.configured && groupData.configured}
    />
  );
}
