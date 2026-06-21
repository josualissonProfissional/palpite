"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2Icon, Settings2Icon, ShirtIcon, SparklesIcon, TrophyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

const updateVersion = "best-players-2026-06-21";

const memberSteps = [
  {
    icon: ShirtIcon,
    title: "1. Monte o Time do Dia",
    description: "Quando os jogos do dia terminarem, escolha 11 jogadores que realmente entraram em campo.",
  },
  {
    icon: TrophyIcon,
    title: "2. Participe do Time da Rodada",
    description: "No fim da rodada, monte sua seleção usando os jogadores escolhidos nos Times do Dia.",
  },
  {
    icon: SparklesIcon,
    title: "3. Compare com a galera",
    description: "Veja o Time Médio, os votos, os percentuais, seus acertos e os pontos extras no ranking.",
  },
];

export function BestPlayersUpdateDialog({ groupSlug }: { groupSlug?: string }) {
  const [open, setOpen] = useState(false);
  const [storageKey, setStorageKey] = useState<string>();

  useEffect(() => {
    let active = true;
    void createClient().auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      const key = `palpito:update:${updateVersion}:${data.user.id}`;
      setStorageKey(key);
      if (window.localStorage.getItem(key) !== "seen") setOpen(true);
    });
    return () => { active = false; };
  }, []);

  function dismiss() {
    if (storageKey) window.localStorage.setItem(storageKey, "seen");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => nextOpen ? setOpen(true) : dismiss()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 px-5 pb-6 pt-7 text-white sm:px-7">
          <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20">
            <SparklesIcon className="size-6" />
          </div>
          <DialogTitle className="text-2xl font-black leading-tight sm:text-3xl">Novidade: Times da Galera</DialogTitle>
          <DialogDescription className="max-w-xl text-emerald-100">
            Escolha os melhores da Copa, compare sua escalação com o grupo e ganhe pontos extras.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 sm:px-7">
          <div className="grid gap-3 sm:grid-cols-3">
            {memberSteps.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border bg-card p-4 shadow-sm">
                <Icon className="mb-3 size-5 text-emerald-600" />
                <div className="text-sm font-black">{title}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="flex items-center gap-2 font-heading text-lg font-black"><Settings2Icon className="size-5" />Como o dono ou administrador configura?</div>
            <ol className="mt-3 space-y-2 text-sm">
              <li className="flex gap-2"><CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>Entre no grupo e abra <strong>Regras</strong>.</span></li>
              <li className="flex gap-2"><CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>Ative <strong>Time da Rodada</strong> e defina os pontos por jogador acertado.</span></li>
              <li className="flex gap-2"><CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>Escolha a rodada, quando liberar e quanto tempo a votação ficará aberta.</span></li>
            </ol>
          </div>
        </div>

        <DialogFooter className="mt-1 px-5 sm:px-7">
          {groupSlug ? (
            <Button variant="outline" asChild onClick={dismiss}>
              <Link href={`/app/grupos/${groupSlug}/regras`}>Ver configurações</Link>
            </Button>
          ) : null}
          <Button onClick={dismiss}>Entendi, começar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
