"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TicketIcon, TrophyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  BackendLoadingOverlay,
  InlineLoading,
} from "@/components/palpite/backend-loading";

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

  return "Nao foi possivel concluir a operacao.";
}

export function JoinGroupForm({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (!canUseSupabase()) {
      toast.error("O aplicativo esta temporariamente indisponivel. Tente novamente em instantes.");
      return;
    }

    const code = String(formData.get("code") ?? "").trim();
    if (!code) return;

    setLoading(true);
    try {
      const { error } = await createClient().functions.invoke("join-group", {
        body: { code },
      });

      if (error) {
        toast.error(await getFunctionErrorMessage(error));
        return;
      }

      toast.success("Voce entrou no grupo.");
      router.refresh();
    } catch (error) {
      toast.error(await getFunctionErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="mt-4 flex gap-2" aria-busy={loading}>
      <BackendLoadingOverlay active={loading} label="Entrando no grupo..." />
      <Input name="code" placeholder="PAL-ABC123" disabled={disabled || loading} />
      <Button variant="secondary" disabled={disabled || loading}>
        <InlineLoading active={loading} />
        {!loading && <TicketIcon className="size-4" />}
        {loading ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}

export function CreateGroupForm({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (!canUseSupabase()) {
      toast.error("O aplicativo esta temporariamente indisponivel. Tente novamente em instantes.");
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await createClient().functions.invoke("create-group", {
        body: {
          name: String(formData.get("name") ?? ""),
          slug: String(formData.get("slug") ?? ""),
          description: String(formData.get("description") ?? ""),
        },
      });

      if (error) {
        toast.error(await getFunctionErrorMessage(error));
        return;
      }

      const group = (data as { group?: { slug?: string } } | null)?.group;
      toast.success("Grupo criado.");
      router.push(group?.slug ? `/app/grupos/${group.slug}` : "/app/grupos");
      router.refresh();
    } catch (error) {
      toast.error(await getFunctionErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4" aria-busy={loading}>
      <BackendLoadingOverlay active={loading} label="Criando grupo..." />
      <div className="space-y-2">
        <Label htmlFor="group-name">Nome</Label>
        <Input id="group-name" name="name" placeholder="Nome do bolao" disabled={disabled || loading} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="group-slug">Slug</Label>
        <Input id="group-slug" name="slug" placeholder="meu-bolao" disabled={disabled || loading} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="group-description">Descricao</Label>
        <Textarea id="group-description" name="description" placeholder="Descricao do bolao" disabled={disabled || loading} />
      </div>
      <Button className="w-full" disabled={disabled || loading}>
        <InlineLoading active={loading} />
        {!loading && <TrophyIcon className="size-4" />}
        {loading ? "Criando..." : "Criar grupo"}
      </Button>
    </form>
  );
}
