"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, KeyRoundIcon, MailIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  BackendLoadingOverlay,
  InlineLoading,
} from "@/components/palpite/backend-loading";

type AuthFormProps = {
  mode: "login" | "signup";
};

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

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === "signup";

  async function handleSubmit(formData: FormData) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
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
          body: {
            email,
            password,
            full_name: name,
          },
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

      toast.success(isSignup ? "Conta criada." : "Sessao iniciada.");
      router.push("/app");
      router.refresh();
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
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" placeholder="Seu nome no bolao" />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="voce@email.com" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Sua senha"
            className="pr-10"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute right-0.5 top-1/2 -translate-y-1/2"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </Button>
        </div>
      </div>
      <Button className="w-full" disabled={loading} type="submit">
        <InlineLoading active={loading} />
        {!loading && (isSignup ? <ShieldCheckIcon className="size-4" /> : <MailIcon className="size-4" />)}
        {loading ? "Aguarde..." : isSignup ? "Criar e entrar" : "Entrar no bolao"}
      </Button>
      {!isSignup ? (
        <Button asChild variant="outline" className="w-full">
          <Link href="/recuperar-senha">
            <KeyRoundIcon className="size-4" />
            Esqueci a senha
          </Link>
        </Button>
      ) : null}
    </form>
  );
}
