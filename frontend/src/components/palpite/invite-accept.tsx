"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogInIcon, TrophyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  BackendLoadingOverlay,
  InlineLoading,
} from "@/components/palpite/backend-loading";

type InviteAcceptProps = {
  code: string;
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
      const payload = await context.clone().json().catch(() => null);
      const message =
        (payload as { error?: unknown } | null)?.error ??
        (payload as { message?: unknown } | null)?.message;
      if (typeof message === "string" && message.trim()) return message;
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Nao foi possivel concluir a operacao.";
}

export function InviteAccept({ code }: InviteAcceptProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";

  async function joinAndRedirect(supabase: ReturnType<typeof createClient>) {
    const { data, error } = await supabase.functions.invoke("join-group", {
      body: { code },
    });
    if (error) {
      toast.error(await getFunctionErrorMessage(error));
      return false;
    }

    const groupId = (data as { membership?: { group_id?: string } } | null)
      ?.membership?.group_id;

    let slug: string | undefined;
    if (groupId) {
      const { data: group } = await supabase
        .schema("palpite")
        .from("groups")
        .select("slug")
        .eq("id", groupId)
        .maybeSingle();
      slug = group?.slug ?? undefined;
    }

    toast.success("Voce entrou no grupo!");
    router.push(slug ? `/app/grupos/${slug}` : "/app/grupos");
    router.refresh();
    return true;
  }

  async function handleSubmit(formData: FormData) {
    if (!canUseSupabase()) {
      toast.error("O aplicativo esta temporariamente indisponivel. Tente novamente em instantes.");
      return;
    }

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "");
    const supabase = createClient();

    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.functions.invoke("signup-password", {
          body: { email, password, full_name: name },
        });
        if (error) {
          toast.error(await getFunctionErrorMessage(error));
          return;
        }
      }

      const response = await supabase.auth.signInWithPassword({ email, password });
      if (response.error) {
        toast.error(response.error.message);
        return;
      }

      await joinAndRedirect(supabase);
    } catch (error) {
      toast.error(await getFunctionErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4" aria-busy={loading}>
      <BackendLoadingOverlay
        active={loading}
        label={isSignup ? "Criando sua conta..." : "Entrando no bolao..."}
      />
      {isSignup ? (
        <div className="space-y-2">
          <Label htmlFor="invite-name">Nome</Label>
          <Input id="invite-name" name="name" placeholder="Seu nome no bolao" />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="invite-email">Email</Label>
        <Input id="invite-email" name="email" type="email" placeholder="voce@email.com" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-password">Senha</Label>
        <Input id="invite-password" name="password" type="password" placeholder="Sua senha" required />
      </div>
      <Button className="w-full" disabled={loading} type="submit">
        <InlineLoading active={loading} />
        {!loading && (isSignup ? <TrophyIcon className="size-4" /> : <LogInIcon className="size-4" />)}
        {loading
          ? "Aguarde..."
          : isSignup
            ? "Criar conta e entrar no bolao"
            : "Entrar e aceitar convite"}
      </Button>
      <Button
        type="button"
        variant="link"
        className="h-auto w-full p-0 text-sm"
        disabled={loading}
        onClick={() => setMode(isSignup ? "login" : "signup")}
      >
        {isSignup ? "Ja tenho conta" : "Criar uma nova conta"}
      </Button>
    </form>
  );
}
