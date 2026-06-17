"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { InviteFriendButton } from "@/components/palpite/invite-friend-button";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import type { GroupSummary } from "@/lib/palpite-data";
import {
  BackendLoadingOverlay,
  InlineLoading,
} from "@/components/palpite/backend-loading";

type GroupInviteSettingsProps = {
  group?: GroupSummary | null;
};

export function GroupInviteSettings({ group }: GroupInviteSettingsProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [allowMemberInvites, setAllowMemberInvites] = useState(
    group?.allowMemberInvites ?? false,
  );

  const canManage = group?.role === "owner" || group?.role === "admin";
  const canInvite = canManage || allowMemberInvites;

  async function handleSave() {
    if (!group?.id) {
      toast.error("Grupo nao identificado.");
      return;
    }

    setSaving(true);
    const { error } = await createClient()
      .schema("palpite")
      .from("groups")
      .update({ allow_member_invites: allowMemberInvites })
      .eq("id", group.id);
    setSaving(false);

    if (error) {
      toast.error(
        error.message.toLowerCase().includes("row-level")
          ? "Apenas o dono ou administradores podem alterar convites."
          : error.message,
      );
      return;
    }

    toast.success("Configuracao de convites salva.");
    router.refresh();
  }

  return (
    <div className="relative space-y-4" aria-busy={saving}>
      <BackendLoadingOverlay active={saving} label="Salvando convites..." />
      <div className="flex flex-col gap-3 rounded-lg border bg-white/70 p-3 dark:bg-slate-950/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">Membros podem convidar</div>
            <div className="text-sm text-muted-foreground">
              Quando ativado, qualquer participante ativo pode copiar o codigo do grupo e gerar convite.
            </div>
          </div>
          <Switch
            checked={allowMemberInvites}
            onCheckedChange={setAllowMemberInvites}
            disabled={!canManage || saving}
          />
        </div>
        {!canManage ? (
          <p className="text-xs text-muted-foreground">
            Apenas donos e administradores podem alterar esta configuracao.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-white/70 p-3 dark:bg-slate-950/60">
        <div>
          <div className="font-semibold">Codigo de compartilhamento</div>
          <div className="text-sm text-muted-foreground">
            Use este botao para copiar o codigo do grupo ou o link completo de convite.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <InviteFriendButton
            groupId={group?.id}
            inviteCode={group?.inviteCode}
            canInvite={canInvite}
          />
          {canManage ? (
            <Button onClick={handleSave} disabled={saving}>
              <InlineLoading active={saving} />
              {saving ? "Salvando..." : "Salvar permissao"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
