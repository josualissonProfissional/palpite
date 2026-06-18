import Link from "next/link";
import Image from "next/image";
import { LogInIcon, SparklesIcon, UsersRoundIcon } from "lucide-react";
import { LightRays } from "@/components/palpite/light-rays";
import { TopMenubar } from "@/components/palpite/top-menubar";
import { TrueFocus } from "@/components/palpite/true-focus";
import { Button } from "@/components/ui/button";
import { NeonGradientCard } from "@/components/ui/neon-gradient-card";

export function LandingScreen() {
  return (
    <main className="relative h-[calc(100svh-57px)] overflow-hidden bg-[#030712] text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.18),transparent_42%),linear-gradient(180deg,#020617_0%,#07111f_100%)]">
        <LightRays
          raysOrigin="top-center"
          raysColor="#00ffff"
          raysSpeed={0.65}
          lightSpread={0.72}
          rayLength={1.45}
          followMouse
          mouseInfluence={0.06}
          noiseAmount={0.02}
          distortion={0.015}
          pulsating={false}
          fadeDistance={1}
          saturation={0.85}
          className="opacity-70"
        />
      </div>
      <TopMenubar />

      <section className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col items-center justify-center px-4 pb-4 pt-20 text-center sm:pb-5 sm:pt-20">
        <Image
          src="/world-cup-trophy.png"
          alt=""
          aria-hidden="true"
          width={4096}
          height={4096}
          priority
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[58vh] max-h-[700px] min-h-[260px] -translate-x-1/2 -translate-y-[45%] select-none object-contain opacity-34 mix-blend-screen drop-shadow-[0_0_90px_rgba(250,204,21,0.42)] sm:h-[74vh] sm:min-h-[420px] sm:opacity-40"
        />
        <div className="relative z-10 flex flex-col items-center">
          <Image
            src="/logo/logo-detalhada-sem-fundo.svg"
            alt="Palpitô"
            width={260}
            height={260}
            priority
            className="mb-2 h-20 w-auto object-contain drop-shadow-[0_0_40px_rgba(56,189,248,0.45)] sm:h-28"
          />
          <TrueFocus
            sentence="Palpitô entre amigos"
            blurAmount={2.4}
            borderColor="#38bdf8"
            glowColor="rgba(56, 189, 248, 0.72)"
            animationDuration={0.55}
            pauseBetweenAnimations={0.9}
          />

          <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-white/60 bg-white/45 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-100 sm:mt-4 sm:text-sm">
            <SparklesIcon className="size-4 text-primary" />
            Copa do Mundo, grupos e ranking em tempo real
          </div>

          <NeonGradientCard
            borderSize={2}
            borderRadius={18}
            neonColors={{ firstColor: "#ff2975", secondColor: "#00fff1" }}
            autoSize
            className="mt-3 max-w-2xl text-center sm:mt-4"
            contentClassName="p-2.5 sm:p-3"
          >
            <p className="pointer-events-none z-10 bg-linear-to-br from-[#ff2975] from-30% via-[#2563eb] to-[#00fff1] bg-clip-text text-center text-base font-bold leading-snug tracking-normal text-transparent text-balance sm:text-lg md:text-xl dark:drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]">
              Crie seu bolao, convide a galera e acompanhe palpites, jogos e
              ranking com uma interface viva para a Copa.
            </p>
          </NeonGradientCard>

          <div className="mt-4 flex w-full max-w-md flex-col items-stretch gap-2.5 sm:mt-5 sm:max-w-none sm:flex-row sm:items-center sm:justify-center">
            <Button
              asChild
              size="lg"
              className="h-11 w-full bg-primary shadow-[0_0_28px_rgba(37,99,235,0.35)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_0_36px_rgba(37,99,235,0.5)] sm:min-w-48"
            >
              <Link href="/criar-conta">
                <UsersRoundIcon className="size-4" />
                Criar conta e grupo
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="h-11 w-full border border-white/50 bg-white/62 shadow-sm backdrop-blur-xl transition-transform hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-950/62 sm:min-w-48"
            >
              <Link href="/entrar">
                <LogInIcon className="size-4" />
                Fazer login
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
