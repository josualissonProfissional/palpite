import { notFound } from "next/navigation";
import {
  CalendarClockIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import { AppShell } from "@/components/palpite/app-shell";
import { ScreenHeader } from "@/components/palpite/screen-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_EMAIL, isAdminEmail } from "@/lib/admin";
import { getWorldCupData } from "@/lib/palpite-live-data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  full_name: string | null;
  nickname: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  password: null;
  password_note: string;
};

type AdminGroup = {
  id: string;
  name: string;
  slug: string;
  invite_code: string | null;
  created_at: string | null;
  creator: { id: string; email: string | null; name: string | null } | null;
  members: {
    user_id: string;
    email: string | null;
    name: string | null;
    role: string;
    status: string;
    joined_at: string | null;
  }[];
};

type AdminDashboardData = {
  generated_at: string;
  totals: { users: number; groups: number };
  users: AdminUser[];
  groups: AdminGroup[];
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Recife",
  }).format(new Date(value));
}

function displayName(name?: string | null, email?: string | null) {
  return name || email || "Sem identificacao";
}

async function getAdminDashboardData(accessToken: string): Promise<AdminDashboardData> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-dashboard`, {
    method: "GET",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Nao foi possivel carregar a area admin.");
  }

  return payload as AdminDashboardData;
}

export default async function AdminPage() {
  const supabase = await createClient();
  const [{ data: userResult }, { data: sessionResult }, worldCup] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
    getWorldCupData(),
  ]);

  const user = userResult.user;
  if (!user || !isAdminEmail(user.email)) {
    notFound();
  }

  const accessToken = sessionResult.session?.access_token;
  if (!accessToken) {
    throw new Error("Sessao expirada. Entre novamente para acessar o admin.");
  }

  const data = await getAdminDashboardData(accessToken);

  return (
    <AppShell groupName="Admin" teams={worldCup.teams}>
      <ScreenHeader
        icon={ShieldCheckIcon}
        eyebrow="Admin"
        title="Painel administrativo"
        description={`Acesso restrito a ${ADMIN_EMAIL}. Senhas originais nao ficam disponiveis por seguranca.`}
        action={<Badge variant="secondary">Atualizado {formatDate(data.generated_at)}</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="rounded-lg bg-card/90">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Usuarios cadastrados</CardTitle>
            <UsersIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.totals.users}</div>
          </CardContent>
        </Card>
        <Card className="rounded-lg bg-card/90">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Grupos criados</CardTitle>
            <ShieldCheckIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.totals.groups}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg bg-card/90">
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Senha</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead>Ultimo acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{displayName(item.name, item.email)}</TableCell>
                  <TableCell>{item.email ?? "-"}</TableCell>
                  <TableCell>
                    <span className="inline-flex max-w-72 items-center gap-1 whitespace-normal text-muted-foreground">
                      <KeyRoundIcon className="size-3 shrink-0" />
                      {item.password_note}
                    </span>
                  </TableCell>
                  <TableCell>{formatDate(item.created_at)}</TableCell>
                  <TableCell>{formatDate(item.last_sign_in_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {data.groups.map((group) => (
          <Card key={group.id} className="rounded-lg bg-card/90">
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>{group.name}</CardTitle>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Criado por {displayName(group.creator?.name, group.creator?.email)}</span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClockIcon className="size-3" />
                      {formatDate(group.created_at)}
                    </span>
                  </div>
                </div>
                <Badge variant="secondary">{group.members.length} membros</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membro</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entrada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.members.map((member) => (
                    <TableRow key={`${group.id}-${member.user_id}`}>
                      <TableCell className="font-medium">{displayName(member.name, member.email)}</TableCell>
                      <TableCell>{member.email ?? "-"}</TableCell>
                      <TableCell>{member.role}</TableCell>
                      <TableCell>{member.status}</TableCell>
                      <TableCell>{formatDate(member.joined_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
