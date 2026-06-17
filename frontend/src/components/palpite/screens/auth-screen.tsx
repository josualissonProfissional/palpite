import Link from "next/link";
import { AuthForm } from "@/components/palpite/auth-form";
import { LightRays } from "@/components/palpite/light-rays";
import { TopMenubar } from "@/components/palpite/top-menubar";
import { NeonGradientCard } from "@/components/ui/neon-gradient-card";

type AuthScreenProps = {
  mode: "login" | "signup";
};

export function AuthScreen({ mode }: AuthScreenProps) {
  const isSignup = mode === "signup";

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-[#030712] p-4 pt-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.18),transparent_42%),linear-gradient(180deg,#020617_0%,#07111f_100%)]">
        <LightRays
          raysOrigin="top-center"
          raysColor="#00ffff"
          raysSpeed={0.55}
          lightSpread={0.68}
          rayLength={1.35}
          followMouse
          mouseInfluence={0.05}
          noiseAmount={0.015}
          distortion={0.01}
          saturation={0.85}
          className="opacity-60"
        />
      </div>
      <TopMenubar />
      <div className="relative z-10 w-full max-w-md">
        <NeonGradientCard
          borderSize={2}
          borderRadius={18}
          neonColors={{ firstColor: "#2563eb", secondColor: "#f97316" }}
          className="min-h-0"
        >
          <div>
            <div className="pb-6">
              <h1 className="font-heading text-3xl font-bold">
                {isSignup ? "Criar conta" : "Entrar"}
              </h1>
            </div>
            <div>
              <AuthForm mode={mode} />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {isSignup ? "Ja tem conta?" : "Novo por aqui?"}{" "}
                <Link
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                  href={isSignup ? "/entrar" : "/criar-conta"}
                >
                  {isSignup ? "Entrar" : "Criar conta"}
                </Link>
              </p>
            </div>
          </div>
        </NeonGradientCard>
      </div>
    </main>
  );
}
