"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InlineLoading } from "@/components/palpite/backend-loading";
import { createClient } from "@/lib/supabase/client";

type ResetRankingButtonProps = {
  groupId?: string;
};

function canUseSupabase() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

async function getFunctionErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;

    if (context instanceof Response) {
      const payload = await context
        .clone()
        .json()
        .catch(() => null);
      const message = (payload as { error?: unknown; message?: unknown } | null)
        ?.error ?? (payload as { message?: unknown } | null)?.message;

      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Nao foi possivel resetar a tabela.";
}

export function ResetRankingButton({ groupId }: ResetRankingButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!groupId) {
      toast.error("Grupo nao identificado.");
      return;
    }

    if (!canUseSupabase()) {
      toast.error("O aplicativo esta temporariamente indisponivel. Tente novamente em instantes.");
      return;
    }

    const confirmed = window.confirm(
      "Resetar a tabela de pontuacao do grupo? Os palpites salvos serao mantidos, mas os pontos calculados serao zerados."
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const { data, error } = await createClient().functions.invoke("reset-ranking", {
        body: { group_id: groupId },
      });

      if (error) {
        toast.error(await getFunctionErrorMessage(error));
        return;
      }

      const deletedCount = (data as { deleted_count?: number } | null)?.deleted_count ?? 0;
      toast.success(`Tabela resetada. ${deletedCount} pontuacoes foram removidas.`);
      router.refresh();
    } catch (error) {
      toast.error(await getFunctionErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="destructive" onClick={handleReset} disabled={loading}>
      <InlineLoading active={loading} />
      {!loading && <RotateCcwIcon className="size-4" />}
      {loading ? "Resetando..." : "Resetar tabela"}
    </Button>
  );
}
