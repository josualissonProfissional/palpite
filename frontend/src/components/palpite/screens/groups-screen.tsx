import Link from "next/link";
import { ArrowRightIcon, LogInIcon, TicketIcon, UsersIcon } from "lucide-react";
import { AppShell } from "@/components/palpite/app-shell";
import { EmptyState } from "@/components/palpite/empty-state";
import { JoinGroupForm } from "@/components/palpite/group-actions";
import { ScreenHeader } from "@/components/palpite/screen-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GroupSummary, Team } from "@/lib/palpite-data";

export function GroupsScreen({
  groups,
  configured,
  authenticated,
  teams,
}: {
  groups: GroupSummary[];
  configured: boolean;
  authenticated: boolean;
  teams: Team[];
}) {
  return (
    <AppShell groupName="Meus grupos" teams={teams}>
      <ScreenHeader
        icon={UsersIcon}
        eyebrow="Home"
        title="Meus grupos"
        description="Escolha um bolao ativo ou entre por codigo de convite."
      />
      <section className="grid gap-4">
        <Card className="border-white/70 bg-white/86 backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Grupos ativos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!configured ? (
              <EmptyState
                icon={LogInIcon}
                title="Aplicativo indisponivel"
                description="Nao foi possivel carregar seus grupos agora. Tente novamente em instantes."
              />
            ) : !authenticated ? (
              <EmptyState
                icon={LogInIcon}
                title="Entre para ver seus grupos"
                description="Entre na sua conta para ver os grupos dos quais voce participa."
                action={<Button asChild><Link href="/entrar">Entrar</Link></Button>}
              />
            ) : groups.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                title="Nenhum grupo ativo"
                description="Crie um bolao ou entre por convite para aparecer aqui."
              />
            ) : (
              groups.map((group) => (
                <article
                  key={group.id}
                  className="rounded-xl border bg-white/80 p-4 dark:bg-slate-950/70"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Badge className="mb-2">{group.role}</Badge>
                      <h2 className="font-heading text-3xl font-bold">
                        {group.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {group.description ?? "Bolao sem descricao"}
                      </p>
                    </div>
                    <Button asChild className="w-full sm:w-auto">
                      <Link href={`/app/grupos/${group.slug}`}>
                        Entrar no grupo
                        <ArrowRightIcon className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </article>
              ))
            )}
            <div className="rounded-xl border border-dashed bg-white/60 p-4 dark:border-white/10 dark:bg-slate-950/55">
              <div className="flex items-center gap-3">
                <TicketIcon className="size-5 text-primary" />
                <div>
                  <div className="font-semibold">Entrar com convite</div>
                  <div className="text-sm text-muted-foreground">
                    Cole um codigo no formato PAL-ABC123.
                  </div>
                </div>
              </div>
              <JoinGroupForm disabled={!authenticated} />
            </div>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
