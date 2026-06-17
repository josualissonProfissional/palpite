"use client";

import { useState } from "react";
import Link from "next/link";
import { EyeIcon, EyeOffIcon, KeyRoundIcon, MailIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function PasswordRecoveryForm() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (!canUseSupabase()) {
      toast.error("O aplicativo esta temporariamente indisponivel. Tente novamente em instantes.");
      return;
    }

    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;

    setLoading(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Enviamos um link para redefinir sua senha.");
  }

  return (
    <form action={handleSubmit} className="space-y-4" aria-busy={loading}>
      <BackendLoadingOverlay active={loading} label="Enviando link de recuperacao..." />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="voce@email.com" required />
      </div>
      <Button className="w-full" disabled={loading} type="submit">
        <InlineLoading active={loading} />
        {!loading && <MailIcon className="size-4" />}
        {loading ? "Enviando..." : "Enviar link"}
      </Button>
      <div className="text-center">
        <Button asChild variant="link" className="h-auto p-0 text-sm">
          <Link href="/entrar">Voltar para entrar</Link>
        </Button>
      </div>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (!canUseSupabase()) {
      toast.error("O aplicativo esta temporariamente indisponivel. Tente novamente em instantes.");
      return;
    }

    const password = String(formData.get("password") ?? "");

    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Senha atualizada. Voce ja pode entrar.");
  }

  return (
    <form action={handleSubmit} className="space-y-4" aria-busy={loading}>
      <BackendLoadingOverlay active={loading} label="Salvando nova senha..." />
      <div className="space-y-2">
        <Label htmlFor="password">Nova senha</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Nova senha"
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
        {!loading && <KeyRoundIcon className="size-4" />}
        {loading ? "Salvando..." : "Salvar nova senha"}
      </Button>
      <div className="text-center">
        <Button asChild variant="link" className="h-auto p-0 text-sm">
          <Link href="/entrar">Voltar para entrar</Link>
        </Button>
      </div>
    </form>
  );
}
