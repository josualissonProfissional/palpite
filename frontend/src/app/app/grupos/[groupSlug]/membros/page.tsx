import { CrownIcon, ShieldIcon, UsersIcon } from "lucide-react";
import { AppShell } from "@/components/palpite/app-shell";
import { EmptyState } from "@/components/palpite/empty-state";
import { InviteFriendButton } from "@/components/palpite/invite-friend-button";
import { RemoveMemberButton } from "@/components/palpite/remove-member-button";
import { ScreenHeader } from "@/components/palpite/screen-header";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getGroupData, getMembers, getWorldCupData } from "@/lib/palpite-live-data";

const roleLabel = { owner: "Owner", admin: "Admin", member: "Membro" };

export const dynamic = "force-dynamic";

export default async function MembersPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = await params;
  const [worldCup, groupData] = await Promise.all([getWorldCupData(), getGroupData(groupSlug)]);
  const members = await getMembers(groupData.group?.id);

  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const myRole = members.find((member) => member.userId === user?.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";
  const canInvite = canManage || Boolean(groupData.group?.allowMemberInvites);
  const groupId = groupData.group?.id;

  return (
    <AppShell groupName={groupData.group?.name ?? "Grupo"} groupSlug={groupSlug} teams={worldCup.teams}>
      <ScreenHeader icon={UsersIcon} eyebrow="Membros" title="Participantes do grupo" description="Veja quem participa do grupo. Donos e administradores podem gerenciar cargos e status." action={<div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{members.length} listados</Badge>{canInvite ? <InviteFriendButton groupId={groupData.group?.id} inviteCode={groupData.group?.inviteCode} canInvite={canInvite} /> : null}</div>} />
      {members.length === 0 ? (
        <EmptyState icon={UsersIcon} title="Nenhum membro ainda" description="Os participantes aparecem aqui assim que entrarem no grupo." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card/90">
          <Table className="min-w-[560px]">
            <TableCaption>Membros do grupo.</TableCaption>
            <TableHeader><TableRow><TableHead>Participante</TableHead><TableHead>Cargo</TableHead><TableHead>Status</TableHead><TableHead>Entrada</TableHead><TableHead className="text-right">Pontos</TableHead>{canManage ? <TableHead className="text-right">Acoes</TableHead> : null}</TableRow></TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell><div className="flex items-center gap-3"><Avatar className="size-9 border">{member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt={member.name} /> : null}<AvatarFallback>{member.avatarFallback}</AvatarFallback></Avatar><span className="max-w-48 truncate font-semibold">{member.name}</span></div></TableCell>
                  <TableCell><Badge variant={member.role === "member" ? "secondary" : "default"} className="gap-1">{member.role === "owner" ? <CrownIcon className="size-3" /> : <ShieldIcon className="size-3" />}{roleLabel[member.role]}</Badge></TableCell>
                  <TableCell>{member.status}</TableCell>
                  <TableCell>{member.joinedAt}</TableCell>
                  <TableCell className="text-right font-bold">{member.points ?? "-"}</TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      {groupId && member.role !== "owner" && member.userId !== user?.id ? (
                        <RemoveMemberButton groupId={groupId} memberUserId={member.userId} memberName={member.name} />
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
