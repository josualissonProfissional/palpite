import { TicketCheckIcon } from "lucide-react";
import { AnimatedWorldCupBackground } from "@/components/palpite/animated-world-cup-background";
import { InviteAccept } from "@/components/palpite/invite-accept";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NeonGradientCard } from "@/components/ui/neon-gradient-card";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-background p-4">
      <AnimatedWorldCupBackground />
      <NeonGradientCard className="relative z-10 min-h-0 w-full max-w-xl">
        <Card className="border-0 bg-transparent shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-3xl sm:text-4xl">
              Voce foi convidado para um bolao
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Alert>
              <TicketCheckIcon className="size-4" />
              <AlertTitle>Convite valido</AlertTitle>
              <AlertDescription>
                Crie sua conta abaixo e entre direto no grupo para fazer seus
                palpites.
              </AlertDescription>
            </Alert>
            <InviteAccept code={code} />
          </CardContent>
        </Card>
      </NeonGradientCard>
    </main>
  );
}
