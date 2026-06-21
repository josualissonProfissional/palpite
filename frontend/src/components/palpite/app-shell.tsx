import Link from "next/link";
import Image from "next/image";
import { AnimatedWorldCupBackground } from "@/components/palpite/animated-world-cup-background";
import { AppSidebarNav } from "@/components/palpite/app-sidebar-nav";
import { BestPlayersUpdateDialog } from "@/components/palpite/best-players-update-dialog";
import { ThemeToggle } from "@/components/palpite/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { Team } from "@/lib/palpite-data";

export function AppShell({
  children,
  groupName = "Palpite",
  groupSlug,
  teams = [],
}: {
  children: React.ReactNode;
  groupName?: string;
  groupSlug?: string;
  teams?: Team[];
}) {
  return (
    <SidebarProvider>
      <BestPlayersUpdateDialog groupSlug={groupSlug} />
      <div className="relative flex min-h-svh w-full overflow-x-hidden bg-background">
        <AnimatedWorldCupBackground teams={teams} />
        <Sidebar variant="floating" collapsible="icon" className="border-white/70 dark:border-white/10">
          <SidebarHeader className="p-3">
            <Link
              href="/app"
              className="flex items-center gap-2.5 rounded-lg bg-primary p-2.5 text-primary-foreground"
            >
              <Image
                src="/logo/logo-apenas-desenho-sem-fundo.svg"
                alt="Palpitô"
                width={32}
                height={32}
                className="size-8 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <div className="font-heading text-lg font-bold leading-none">Palpitô</div>
                <div className="text-[11px] text-primary-foreground/80">Copa do Mundo 2026</div>
              </div>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <AppSidebarNav groupSlug={groupSlug} groupName={groupName} />
          </SidebarContent>
          <SidebarFooter className="p-3">
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-white/70 p-2.5 text-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
              <span className="font-medium text-muted-foreground">Tema</span>
              <ThemeToggle />
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="relative min-w-0 bg-transparent">
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/50 bg-background/80 px-3 py-2 backdrop-blur md:hidden dark:border-white/10">
            <SidebarTrigger aria-label="Abrir menu" />
            <Link href="/app" className="flex items-center gap-1.5 font-heading text-lg font-bold">
              <Image
                src="/logo/logo-apenas-desenho-sem-fundo.svg"
                alt="Palpitô"
                width={24}
                height={24}
                className="size-6 object-contain"
              />
              Palpitô
            </Link>
            <ThemeToggle />
          </div>
          <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-3 py-3 sm:gap-5 sm:px-6 sm:py-4 lg:px-8">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
