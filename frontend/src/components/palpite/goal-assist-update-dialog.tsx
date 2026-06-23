"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2Icon, GoalIcon, HandshakeIcon, Settings2Icon, SparklesIcon, TrophyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

const updateVersion = "goal-assist-2026-06-21";
const previousUpdateVersion = "best-players-2026-06-21";

const steps = [
  { icon: TrophyIcon, title: "1. Escolha o placar", description: "Faça seu palpite normalmente e toque em Salvar palpite." },
  { icon: GoalIcon, title: "2. Monte cada gol", description: "Indique quem vai marcar e quem dará a assistência. Também há opções para gol contra e sem assistência." },
  { icon: HandshakeIcon, title: "3. Ganhe pontos extras", description: "Seus autores e assistências ficam no card e valem conforme as regras do grupo." },
];

export function GoalAssistUpdateDialog({ groupSlug }: { groupSlug?: string }) {
  const [open, setOpen] = useState(false);
  const [storageKey, setStorageKey] = useState<string>();

  useEffect(() => {
    let active = true;
    let userId = "";

    function tryOpen() {
      if (!active || !userId) return;
      const ownKey = `palpito:update:${updateVersion}:${userId}`;
      const previousKey = `palpito:update:${previousUpdateVersion}:${userId}`;
      if (window.localStorage.getItem(ownKey) !== "seen" && window.localStorage.getItem(previousKey) === "seen") setOpen(true);
    }

    function handlePreviousDismiss(event: Event) {
      if ((event as CustomEvent<string>).detail === previousUpdateVersion) tryOpen();
    }

    window.addEventListener("palpito:update-dismissed", handlePreviousDismiss);
    void createClient().auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      userId = data.user.id;
      setStorageKey(`palpito:update:${updateVersion}:${userId}`);
      tryOpen();
    });

    return () => {
      active = false;
      window.removeEventListener("palpito:update-dismissed", handlePreviousDismiss);
    };
  }, []);

  function dismiss() {
    if (storageKey) window.localStorage.setItem(storageKey, "seen");
    setOpen(false);
    window.dispatchEvent(new CustomEvent("palpito:update-dismissed", { detail: updateVersion }));
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => nextOpen ? setOpen(true) : dismiss()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="bg-gradient-to-br from-slate-950 via-blue-950 to-emerald-950 px-5 pb-6 pt-7 text-white sm:px-7">
          <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20"><SparklesIcon className="size-6" /></div>
          <DialogTitle className="text-2xl font-black leading-tight sm:text-3xl">Novidade: autores e assistências</DialogTitle>
          <DialogDescription className="max-w-xl text-blue-100">Agora seu palpite pode ir além do placar: diga quem fará cada gol e quem dará a assistência.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 sm:px-7">
          <div className="grid gap-3 sm:grid-cols-3">
            {steps.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border bg-card p-4 shadow-sm">
                <Icon className="mb-3 size-5 text-emerald-600" />
                <div className="text-sm font-black">{title}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="flex items-center gap-2 font-heading text-lg font-black"><Settings2Icon className="size-5" />Como funciona a pontuação?</div>
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex gap-2"><CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>O administrador define os pontos por autor e assistência, inclusive valores como <strong>0,50</strong>.</span></p>
              <p className="flex gap-2"><CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>A regra pode pontuar cada acerto separadamente ou exigir a dupla exata.</span></p>
              <p className="flex gap-2"><CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>Palpites antigos exibem um botão temporário para completar os jogadores.</span></p>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-1 px-5 sm:px-7">
          {groupSlug ? <Button variant="outline" asChild onClick={dismiss}><Link href={`/app/grupos/${groupSlug}/regras`}>Ver regras do grupo</Link></Button> : null}
          <Button onClick={dismiss}>Entendi, vamos palpitar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
