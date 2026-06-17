"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

type RemoveMemberButtonProps = {
  groupId: string;
  memberUserId: string;
  memberName: string;
};

export function RemoveMemberButton({ groupId, memberUserId, memberName }: RemoveMemberButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    setLoading(true);
    const { error } = await createClient()
      .schema("palpite")
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", memberUserId);
    setLoading(false);

    if (error) {
      toast.error(
        error.message.toLowerCase().includes("row-level")
          ? "Apenas o dono ou administradores podem remover membros."
          : error.message
      );
      return;
    }

    toast.success(`${memberName} foi removido do grupo.`);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Remover ${memberName}`}>
          <Trash2Icon className="size-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover participante</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja remover <strong>{memberName}</strong> do grupo? Os palpites
            dessa pessoa deixam de contar no ranking.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={loading}>
              Cancelar
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleRemove} disabled={loading}>
            <Trash2Icon className="size-4" />
            {loading ? "Removendo..." : "Remover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
