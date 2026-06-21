"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  MailIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    title: string;
    description: string;
  } | null>(null);

  async function handleSubmit(formData: FormData) {
    if (!canUseSupabase()) {
      toast.error("O aplicativo esta temporariamente indisponivel. Tente novamente em instantes.");
      return;
    }

    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;

    setFeedback(null);
    setLoading(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setLoading(false);

    if (error) {
      const isRateLimit =
        error.status === 429 ||
        error.code === "over_email_send_rate_limit" ||
        /rate limit|too many requests/i.test(error.message);
      const message = isRateLimit
        ? "O serviço de e-mail atingiu o limite temporário de envios. Aguarde alguns minutos e tente novamente; a liberação pode levar até 1 hora."
        : "Não foi possível enviar o link agora. Tente novamente em alguns instantes.";

      setFeedback({
        type: "error",
        title: isRateLimit ? "Muitos pedidos de recuperação" : "Não foi possível enviar",
        description: message,
      });
      toast.error(message);
      return;
    }

    setFeedback({
      type: "success",
      title: "Confira seu e-mail",
      description: "Se a conta estiver cadastrada, você receberá um link para criar uma nova senha.",
    });
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
      {feedback ? (
        <Alert variant={feedback.type === "error" ? "destructive" : "default"}>
          {feedback.type === "error" ? (
            <CircleAlertIcon className="size-4" />
          ) : (
            <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
          )}
          <AlertTitle>{feedback.title}</AlertTitle>
          <AlertDescription>{feedback.description}</AlertDescription>
        </Alert>
      ) : null}
      <div className="text-center">
        <Button asChild variant="link" className="h-auto p-0 text-sm">
          <Link href="/entrar">Voltar para entrar</Link>
        </Button>
      </div>
    </form>
  );
}

export function UpdatePasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (!canUseSupabase()) {
      toast.error("O aplicativo esta temporariamente indisponivel. Tente novamente em instantes.");
      return;
    }

    const password = String(formData.get("password") ?? "");

    const supabase = createClient();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    await supabase.auth.signOut({ scope: "local" });
    setLoading(false);
    toast.success("Senha atualizada. Voce ja pode entrar.");
    router.replace("/entrar");
    router.refresh();
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
