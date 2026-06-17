import { ClipboardListIcon, RadioIcon } from "lucide-react";
import { AppShell } from "@/components/palpite/app-shell";
import { ScreenHeader } from "@/components/palpite/screen-header";
import { LiveStandings } from "@/components/palpite/live-standings";
import { Badge } from "@/components/ui/badge";
import { getWorldCupData } from "@/lib/palpite-live-data";

export const dynamic = "force-dynamic";

export default async function WorldCupPage() {
  const worldCup = await getWorldCupData();

  return (
    <AppShell groupName="Copa do Mundo 2026" teams={worldCup.teams}>
      <ScreenHeader
        icon={ClipboardListIcon}
        eyebrow="Copa 2026"
        title="Classificacao da Copa"
        description="Classificacao oficial da Copa, atualizada conforme os jogos sao finalizados."
        action={<Badge className="gap-1"><RadioIcon className="size-3" /> Copa 2026</Badge>}
      />
      <LiveStandings initialStandings={worldCup.standings} />
    </AppShell>
  );
}
