import { GroupsScreen } from "@/components/palpite/screens/groups-screen";
import { getGroupsData, getWorldCupData } from "@/lib/palpite-live-data";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const [groups, worldCup] = await Promise.all([getGroupsData(), getWorldCupData()]);
  return <GroupsScreen groups={groups.groups} configured={groups.configured} authenticated={groups.authenticated ?? false} teams={worldCup.teams} />;
}
