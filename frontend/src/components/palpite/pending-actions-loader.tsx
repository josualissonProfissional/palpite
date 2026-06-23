import { PendingActionsDialog } from "@/components/palpite/pending-actions-dialog";
import { getPendingActions } from "@/lib/palpite-live-data";

export async function PendingActionsLoader({ groupSlug }: { groupSlug: string }) {
  const actions = await getPendingActions(groupSlug);
  if (actions.length === 0) return null;

  return <PendingActionsDialog actions={actions} groupSlug={groupSlug} />;
}
