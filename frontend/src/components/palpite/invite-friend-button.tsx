"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { getBaseUrl } from "@/lib/base-url";
import { InlineLoading } from "@/components/palpite/backend-loading";

type InviteFriendButtonProps = {
  groupId?: string;
};

async function getFunctionErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null);
      const message =
        (payload as { error?: unknown } | null)?.error ??
        (payload as { message?: unknown } | null)?.message;
      if (typeof message === "string" && message.trim()) return message;
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Nao foi possivel gerar o convite.";
}

export function InviteFriendButton({ groupId }: InviteFriendButtonProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleInvite() {
    if (!groupId) {
      toast.error("Grupo nao identificado.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await createClient().functions.invoke(
        "create-invite",
        { body: { group_id: groupId, role: "member" } }
      );

      if (error) {
        toast.error(await getFunctionErrorMessage(error));
        return;
      }

      const code = (data as { invite?: { code?: string } } | null)?.invite?.code;
      if (!code) {
        toast.error("Convite gerado sem codigo. Tente novamente.");
        return;
      }

      const inviteLink = `${getBaseUrl()}/convite/${code}`;
      setLink(inviteLink);
      setCopied(false);
      setOpen(true);
      await copyToClipboard(inviteLink, false);
    } catch (error) {
      toast.error(await getFunctionErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(value: string, announce = true) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (announce) toast.success("Link copiado.");
    } catch {
      if (announce) toast.error("Copie o link manualmente.");
    }
  }

  return (
    <>
      <Button onClick={handleInvite} disabled={loading}>
        <InlineLoading active={loading} />
        {!loading && <UserPlusIcon className="size-4" />}
        {loading ? "Gerando..." : "Convidar amigo"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convide um amigo</DialogTitle>
            <DialogDescription>
              Envie este link. Ao abrir, seu amigo cria a conta e ja entra no
              grupo para fazer os palpites.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="invite-link">Link do convite</Label>
            <div className="flex gap-2">
              <Input id="invite-link" readOnly value={link} />
              <Button
                type="button"
                variant="secondary"
                onClick={() => copyToClipboard(link)}
              >
                {copied ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <CopyIcon className="size-4" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
