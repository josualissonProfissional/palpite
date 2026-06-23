"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlarmClockIcon,
  CalendarClockIcon,
  ListTodoIcon,
  ShirtIcon,
  TrophyIcon,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PendingAction } from "@/lib/palpite-data";
import { createClient } from "@/lib/supabase/client";

const onboardingVersions = ["best-players-2026-06-21", "goal-assist-2026-06-21"];

const actionVisuals: Record<PendingAction["kind"], {
  icon: LucideIcon;
  className: string;
  iconClassName: string;
}> = {
  prediction: {
    icon: CalendarClockIcon,
    className: "border-blue-200 bg-blue-50/80 dark:border-blue-500/20 dark:bg-blue-950/25",
    iconClassName: "bg-blue-600 text-white",
  },
  daily_team: {
    icon: ShirtIcon,
    className: "border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-950/25",
    iconClassName: "bg-emerald-600 text-white",
  },
  round_team: {
    icon: TrophyIcon,
    className: "border-amber-200 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-950/25",
    iconClassName: "bg-amber-500 text-slate-950",
  },
};

function countdownLabel(deadline: string, now: number | null) {
  if (now === null) return "Calculando prazo...";
  const totalSeconds = Math.max(0, Math.floor((new Date(deadline).getTime() - now) / 1_000));
  if (totalSeconds === 0) return "Prazo encerrado";
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `Faltam ${days}d ${hours}h ${minutes}min`;
  if (hours > 0) return `Faltam ${hours}h ${minutes}min ${seconds}s`;
  return `Faltam ${minutes}min ${seconds}s`;
}

export function PendingActionsDialog({ actions, groupSlug }: {
  actions: PendingAction[];
  groupSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [storageKey, setStorageKey] = useState<string>();
  const [now, setNow] = useState<number | null>(null);
  const signature = useMemo(() => actions.map((action) => action.id).join("|"), [actions]);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let userId = "";

    function tryOpen() {
      if (!active || !userId) return;
      const onboardingFinished = onboardingVersions.every((version) =>
        window.localStorage.getItem(`palpito:update:${version}:${userId}`) === "seen"
      );
      if (!onboardingFinished) return;
      const key = `palpito:pending:${groupSlug}:${userId}:${signature}`;
      setStorageKey(key);
      if (window.sessionStorage.getItem(key) !== "seen") setOpen(true);
    }

    function handleOnboardingDismissed() {
      tryOpen();
    }

    window.addEventListener("palpito:update-dismissed", handleOnboardingDismissed);
    void createClient().auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      userId = data.user.id;
      tryOpen();
    });

    return () => {
      active = false;
      window.removeEventListener("palpito:update-dismissed", handleOnboardingDismissed);
    };
  }, [groupSlug, signature]);

  function dismiss() {
    if (storageKey) window.sessionStorage.setItem(storageKey, "seen");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => nextOpen ? setOpen(true) : dismiss()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-950 px-5 pb-5 pt-6 text-white sm:px-6">
          <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20">
            <ListTodoIcon className="size-6" />
          </div>
          <DialogTitle className="text-2xl font-black leading-tight">Você tem {actions.length === 1 ? "uma pendência" : `${actions.length} pendências`}</DialogTitle>
          <DialogDescription className="text-blue-100">Conclua as tarefas antes do prazo para não perder pontos.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 px-5 sm:px-6">
          {actions.map((action) => {
            const visual = actionVisuals[action.kind];
            const Icon = visual.icon;
            const remaining = now === null ? 1 : new Date(action.deadline).getTime() - now;
            return (
              <section key={action.id} className={`rounded-2xl border p-4 ${visual.className}`}>
                <div className="flex items-start gap-3">
                  <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${visual.iconClassName}`}><Icon className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-heading text-lg font-black leading-tight">{action.title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{action.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Badge variant={remaining <= 30 * 60_000 ? "destructive" : "secondary"} className="w-fit gap-1 font-mono">
                    <AlarmClockIcon className="size-3" />{countdownLabel(action.deadline, now)}
                  </Badge>
                  <Button size="sm" asChild disabled={remaining <= 0}>
                    <Link href={action.href} onClick={dismiss}>{action.buttonLabel}</Link>
                  </Button>
                </div>
              </section>
            );
          })}
        </div>

        <DialogFooter className="mt-1 px-5 sm:px-6">
          <Button variant="outline" onClick={dismiss}>Lembrar depois</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
