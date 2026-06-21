"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldPlusIcon } from "lucide-react";
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

type PromoteMemberButtonProps = {
  groupId: string;
  memberUserId: string;
  memberName: string;
};

export function PromoteMemberButton({
  groupId,
  memberUserId,
  memberName,
}: PromoteMemberButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handlePromote() {
    setLoading(true);
    const { data, error } = await createClient()
      .schema("palpite")
      .from("group_members")
      .update({ role: "admin" })
      .eq("group_id", groupId)
      .eq("user_id", memberUserId)
      .eq("role", "member")
      .eq("status", "active")
      .select("user_id")
      .maybeSingle();
    setLoading(false);

    if (error || !data) {
      toast.error(
        error?.message.toLowerCase().includes("row-level")
          ? "Apenas donos e administradores podem definir outro administrador."
          : error?.message ?? "Não foi possível alterar o cargo deste participante.",
      );
      return;
    }

    toast.success(`${memberName} agora é admin do grupo.`);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShieldPlusIcon />
          Tornar admin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Definir administrador</DialogTitle>
          <DialogDescription>
            Deseja tornar <strong>{memberName}</strong> admin do grupo? Essa pessoa poderá
            gerenciar membros, regras, convites e também apagar o grupo.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={loading}>
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={handlePromote} disabled={loading}>
            <ShieldPlusIcon />
            {loading ? "Alterando..." : "Confirmar admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
