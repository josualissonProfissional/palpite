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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type DeleteGroupButtonProps = {
  groupId: string;
  groupName: string;
};

export function DeleteGroupButton({ groupId, groupName }: DeleteGroupButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const confirmed = confirmation.trim() === groupName;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setConfirmation("");
  }

  async function handleDelete() {
    if (!confirmed) return;

    setLoading(true);
    const { data, error } = await createClient()
      .schema("palpite")
      .from("groups")
      .delete()
      .eq("id", groupId)
      .select("id")
      .maybeSingle();
    setLoading(false);

    if (error || !data) {
      toast.error(
        error?.message.toLowerCase().includes("row-level")
          ? "Apenas donos e administradores podem apagar o grupo."
          : error?.message ?? "Não foi possível apagar o grupo.",
      );
      return;
    }

    toast.success("Grupo apagado.");
    setOpen(false);
    router.replace("/app/grupos");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2Icon />
          Apagar grupo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apagar grupo permanentemente</DialogTitle>
          <DialogDescription>
            Esta ação apaga o grupo, seus palpites, ranking, regras e convites. Não é possível
            desfazer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-group-confirmation">
            Digite <strong>{groupName}</strong> para confirmar
          </Label>
          <Input
            id="delete-group-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            disabled={loading}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={loading}>
              Cancelar
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={!confirmed || loading}>
            <Trash2Icon />
            {loading ? "Apagando..." : "Apagar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
