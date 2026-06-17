import { UserIcon } from "lucide-react";
import { AppShell } from "@/components/palpite/app-shell";
import { EmptyState } from "@/components/palpite/empty-state";
import { ScreenHeader } from "@/components/palpite/screen-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initials } from "@/lib/palpite-data";
import { getProfile, getWorldCupData } from "@/lib/palpite-live-data";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [profileData, worldCup] = await Promise.all([getProfile(), getWorldCupData()]);
  const profile = profileData.profile;
  const name = profile?.full_name ?? profile?.nickname ?? "";

  return (
    <AppShell groupName="Perfil" teams={worldCup.teams}>
      <ScreenHeader
        icon={UserIcon}
        eyebrow="Perfil"
        title="Seus dados no bolao"
        description="Atualize seu nome e suas informacoes que aparecem para os outros participantes."
      />
      {!profileData.configured ? (
        <EmptyState
          icon={UserIcon}
          title="Aplicativo indisponivel"
          description="Nao foi possivel carregar seu perfil agora. Tente novamente em instantes."
        />
      ) : !profileData.authenticated ? (
        <EmptyState
          icon={UserIcon}
          title="Voce nao esta conectado"
          description="Entre na sua conta para visualizar e editar seu perfil."
        />
      ) : (
      <Card className="w-full max-w-2xl border-white/70 bg-white/86 backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Perfil publico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Avatar className="size-16 border">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={name} /> : null}
            <AvatarFallback>{initials(name) || "P"}</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <Label htmlFor="full-name">Nome</Label>
            <Input id="full-name" defaultValue={profile?.full_name ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nickname">Apelido</Label>
            <Input id="nickname" defaultValue={profile?.nickname ?? ""} />
          </div>
          <Button>Salvar perfil</Button>
        </CardContent>
      </Card>
      )}
    </AppShell>
  );
}
