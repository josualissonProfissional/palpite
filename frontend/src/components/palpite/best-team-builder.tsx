"use client";

import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { motion } from "motion/react";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, CircleDotIcon, GripVerticalIcon, SaveIcon, SearchIcon, UsersIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { createClient } from "@/lib/supabase/client";
import type {
  BestPlayer,
  BestPlayerFormation,
  BestPlayerPosition,
  BestPlayerSelection,
  BestPlayerWindow,
} from "@/lib/palpite-data";
import { countryFlag } from "@/lib/palpite-data";

type Slot = { index: number; role: BestPlayerPosition | null };
type PositionFilter = BestPlayerPosition | "all";

const positionLabels: Record<BestPlayerPosition, string> = {
  gk: "Goleiro", df: "Defesa", mf: "Meio", fw: "Ataque",
};

const formations: BestPlayerFormation[] = ["4-3-3", "4-4-2", "3-5-2", "free-11"];
const positionFilters: Array<{ value: PositionFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "gk", label: "Goleiros" },
  { value: "df", label: "Defesa" },
  { value: "mf", label: "Meio" },
  { value: "fw", label: "Ataque" },
];

function participationCopy(status: BestPlayer["participationStatus"]) {
  if (status === "starter") return { label: "Titular", className: "bg-emerald-100 text-emerald-800" };
  if (status === "bench") return { label: "Banco", className: "bg-slate-100 text-slate-600" };
  return { label: "Pendente", className: "bg-amber-100 text-amber-800" };
}

function PositionTabs({ value, onChange }: { value: PositionFilter; onChange: (value: PositionFilter) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1" aria-label="Posições dos jogadores">
      {positionFilters.map((position) => (
        <button
          key={position.value}
          type="button"
          onClick={() => onChange(position.value)}
          className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${
            value === position.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {position.label}
        </button>
      ))}
    </div>
  );
}

function slotsForFormation(formation: BestPlayerFormation): Slot[] {
  const roles: Array<BestPlayerPosition | null> = formation === "4-3-3"
    ? ["gk", ...Array(4).fill("df"), ...Array(3).fill("mf"), ...Array(3).fill("fw")]
    : formation === "4-4-2"
      ? ["gk", ...Array(4).fill("df"), ...Array(4).fill("mf"), ...Array(2).fill("fw")]
      : formation === "3-5-2"
        ? ["gk", ...Array(3).fill("df"), ...Array(5).fill("mf"), ...Array(2).fill("fw")]
        : ["gk", ...Array(10).fill(null)];
  return roles.map((role, index) => ({ index, role }));
}

function PlayerChip({ player, disabled = false, onClick }: {
  player: BestPlayer;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `bench:${player.id}`,
    disabled,
  });
  const participation = participationCopy(player.participationStatus);
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
      className="flex min-h-28 w-full flex-col items-center justify-center gap-1 rounded-xl border bg-background px-2 py-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md disabled:opacity-40"
      {...listeners}
      {...attributes}
    >
      <span className="flex items-center gap-1 text-xl leading-none" aria-label={player.teamName}>
        {countryFlag(player.teamCountry)}
        <GripVerticalIcon className="size-3.5 text-muted-foreground" />
      </span>
      <span className="line-clamp-2 min-h-9 text-xs font-extrabold leading-tight">{player.name}</span>
      <span className="text-[10px] font-semibold text-muted-foreground">{positionLabels[player.position]}</span>
      <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide ${participation.className}`}>
        {participation.label}
      </span>
      {isDragging ? <span className="sr-only">Arrastando</span> : null}
    </button>
  );
}

function FieldSlot({ slot, player, onRemove, onPick }: {
  slot: Slot;
  player?: BestPlayer;
  onRemove: () => void;
  onPick: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `slot:${slot.index}` });
  const draggable = useDraggable({ id: player ? `player:${player.id}` : `empty:${slot.index}`, disabled: !player });
  const role = slot.role ?? player?.position;
  const participation = player ? participationCopy(player.participationStatus) : null;
  return (
    <motion.button
      ref={(node) => { setNodeRef(node); draggable.setNodeRef(node); }}
      type="button"
      layout
      onClick={() => player ? onRemove() : onPick()}
      style={{
        transform: draggable.transform
          ? `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`
          : undefined,
      }}
      className={`relative flex min-h-16 min-w-20 flex-col items-center justify-center rounded-xl border-2 p-1 text-center shadow-lg transition ${
        isOver ? "scale-105 border-amber-300 bg-amber-100" : "border-white/70 bg-white/90"
      }`}
      {...draggable.listeners}
      {...draggable.attributes}
    >
      {player ? (
        <>
          <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-red-500 text-white"><XIcon className="size-3" /></span>
          <span className="text-lg leading-none" aria-label={player.teamName}>{countryFlag(player.teamCountry)}</span>
          <span className="line-clamp-2 text-xs font-bold text-slate-950">{player.name}</span>
          <span className="text-[10px] font-semibold uppercase text-emerald-800">{role ? positionLabels[role] : "Livre"}</span>
          <span className={`mt-0.5 rounded-full px-1.5 text-[9px] font-bold uppercase ${participation?.className}`}>
            {participation?.label}
          </span>
        </>
      ) : <><CircleDotIcon className="mb-1 size-4 text-emerald-800/60" /><span className="text-[10px] font-bold uppercase text-emerald-900/70">{role ? positionLabels[role] : "Livre"}</span></>}
    </motion.button>
  );
}

export function BestTeamBuilder({
  groupId,
  window,
  players,
  initialFormation = "4-3-3",
  initialSelections = [],
}: {
  groupId: string;
  window: BestPlayerWindow;
  players: BestPlayer[];
  initialFormation?: BestPlayerFormation;
  initialSelections?: BestPlayerSelection[];
}) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const playerPanelRef = useRef<HTMLElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  const [formation, setFormation] = useState<BestPlayerFormation>(initialFormation);
  const [selections, setSelections] = useState<BestPlayerSelection[]>(initialSelections);
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);
  const [playerPage, setPlayerPage] = useState(0);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [applyAll, setApplyAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const slots = useMemo(() => slotsForFormation(formation), [formation]);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const selectedBySlot = useMemo(() => new Map(selections.map((selection) => [selection.slotIndex, selection])), [selections]);
  const selectedIds = useMemo(() => new Set(selections.map((selection) => selection.playerId)), [selections]);
  const pickerSlot = pickerSlotIndex === null ? null : slots.find((slot) => slot.index === pickerSlotIndex) ?? null;
  const filteredPlayers = players.filter((player) =>
    (positionFilter === "all" || player.position === positionFilter) &&
    (!pickerSlot || canPlace(player, pickerSlot)) &&
    `${player.name} ${player.teamName}`.toLowerCase().includes(search.toLowerCase())
  );
  const playerPageSize = isMobile ? 3 : 8;
  const totalPlayerPages = Math.max(1, Math.ceil(filteredPlayers.length / playerPageSize));
  const safePlayerPage = Math.min(playerPage, totalPlayerPages - 1);
  const visiblePlayers = filteredPlayers.slice(safePlayerPage * playerPageSize, (safePlayerPage + 1) * playerPageSize);

  function canPlace(player: BestPlayer, slot: Slot) {
    if (slot.role === "gk") return player.position === "gk";
    if (player.position === "gk") return false;
    return !window.respectPosition || slot.role === null || player.position === slot.role;
  }

  function placePlayer(playerId: string, slotIndex: number) {
    const player = playerById.get(playerId);
    const slot = slots.find((candidate) => candidate.index === slotIndex);
    if (!player || !slot || !canPlace(player, slot)) {
      toast.error("Esse jogador não pode ocupar esta faixa do campo.");
      return;
    }
    const role = slot.role ?? player.position;
    setSelections((current) => [
      ...current.filter((selection) => selection.playerId !== playerId && selection.slotIndex !== slotIndex),
      { playerId, slotIndex, selectedRole: role },
    ]);
  }

  function handlePlayerClick(player: BestPlayer) {
    const target = slots.find((slot) => !selectedBySlot.has(slot.index) && canPlace(player, slot));
    if (!target) return toast.error("Não há uma vaga compatível disponível.");
    placePlayer(player.id, target.index);
  }

  function openPlayerPicker(filter: PositionFilter, slotIndex: number | null = null) {
    setPositionFilter(filter);
    setPickerSlotIndex(slotIndex);
    setSearch("");
    setPlayerPage(0);
    if (isMobile) {
      setPickerOpen(true);
      return;
    }
    requestAnimationFrame(() => playerPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function chooseFromPicker(player: BestPlayer) {
    if (pickerSlotIndex !== null) placePlayer(player.id, pickerSlotIndex);
    else handlePlayerClick(player);
    setPickerOpen(false);
    setPickerSlotIndex(null);
  }

  function handleFormation(next: BestPlayerFormation) {
    setFormation(next);
    setSelections([]);
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActivePlayerId(id.replace(/^(player|bench):/, ""));
  }

  function handleDragEnd(event: DragEndEvent) {
    const playerId = String(event.active.id).replace(/^(player|bench):/, "");
    const target = event.over ? String(event.over.id) : "";
    if (target.startsWith("slot:")) placePlayer(playerId, Number(target.slice(5)));
    setActivePlayerId(null);
  }

  async function handleSave() {
    if (selections.length !== 11) return toast.error("Complete as 11 posições antes de salvar.");
    setSaving(true);
    try {
      const { data, error } = await createClient().functions.invoke("save-best-player-ballot", {
        body: {
          group_id: groupId,
          window_id: window.id,
          formation,
          selections: selections.map((selection) => ({
            player_id: selection.playerId,
            slot_index: selection.slotIndex,
            selected_role: selection.selectedRole,
          })),
          apply_to_all_groups: applyAll && window.kind === "daily",
        },
      });
      if (error) throw error;
      const saved = (data as { saved?: unknown[] } | null)?.saved?.length ?? 1;
      toast.success(saved > 1 ? `Time salvo em ${saved} grupos.` : "Time salvo.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o time.");
    } finally {
      setSaving(false);
    }
  }

  const rows: Array<{ role: BestPlayerPosition | "free"; slots: Slot[] }> = formation === "free-11"
    ? [
        { role: "free", slots: slots.filter((slot) => slot.index > 0).slice(5) },
        { role: "free", slots: slots.filter((slot) => slot.index > 0).slice(0, 5) },
        { role: "gk", slots: slots.filter((slot) => slot.role === "gk") },
      ]
    : (["fw", "mf", "df", "gk"] as BestPlayerPosition[]).map((role) => ({ role, slots: slots.filter((slot) => slot.role === role) }));

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActivePlayerId(null)}>
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {formations.map((item) => <Button key={item} size="sm" variant={formation === item ? "default" : "outline"} onClick={() => handleFormation(item)}>{item}</Button>)}
          </div>
          <div className="relative min-h-[560px] overflow-hidden rounded-2xl border-4 border-white/60 bg-[linear-gradient(90deg,rgba(255,255,255,.08)_50%,transparent_50%),linear-gradient(#138a55,#0d7548)] bg-[length:80px_100%] p-4 shadow-inner">
            <div className="pointer-events-none absolute inset-4 rounded-xl border-2 border-white/60" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" />
            <div className="relative z-10 flex min-h-[520px] flex-col justify-around gap-3">
              {rows.map((row, rowIndex) => (
                <div key={`${row.role}-${rowIndex}`} className="flex flex-wrap items-center justify-around gap-2">
                  {row.slots.map((slot) => {
                    const selected = selectedBySlot.get(slot.index);
                    return <FieldSlot key={slot.index} slot={slot} player={selected ? playerById.get(selected.playerId) : undefined} onRemove={() => setSelections((current) => current.filter((item) => item.slotIndex !== slot.index))} onPick={() => openPlayerPicker(slot.role ?? "all", slot.index)} />;
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><CheckIcon className="size-4 text-emerald-600" />{selections.length}/11 escolhidos</div>
            {window.kind === "daily" ? (
              <Label className="flex items-center gap-2"><Checkbox checked={applyAll} onCheckedChange={(checked) => setApplyAll(checked === true)} />Usar o mesmo time em todos os grupos</Label>
            ) : null}
            <Button onClick={handleSave} disabled={saving || selections.length !== 11}><SaveIcon />{saving ? "Salvando..." : "Salvar time"}</Button>
          </div>
        </div>

        {(!isMobile || !pickerOpen) ? <section ref={playerPanelRef} className="space-y-3 rounded-2xl border bg-card/90 p-3 sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <PositionTabs value={positionFilter} onChange={(filter) => { setPositionFilter(filter); setPickerSlotIndex(null); setSearch(""); setPlayerPage(0); }} />
            <div className="relative w-full xl:max-w-sm"><SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPlayerPage(0); }} placeholder="Buscar jogador" className="pl-8" /></div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{filteredPlayers.length} jogadores que atuaram</span><span>{safePlayerPage + 1}/{totalPlayerPages}</span></div>
          <div className="flex items-stretch gap-2">
            <Button type="button" variant="outline" size="icon" className="h-auto min-h-28 shrink-0 rounded-xl" disabled={safePlayerPage === 0} onClick={() => setPlayerPage((page) => Math.max(0, page - 1))} aria-label="Jogadores anteriores">
              <ChevronLeftIcon className="size-5" />
            </Button>
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 md:grid-cols-4 xl:grid-cols-8">
              {visiblePlayers.map((player) => <PlayerChip key={player.id} player={player} disabled={selectedIds.has(player.id)} onClick={() => handlePlayerClick(player)} />)}
              {filteredPlayers.length === 0 ? <div className="col-span-full grid min-h-28 place-items-center gap-2 text-center text-muted-foreground"><UsersIcon /><span>Nenhum jogador que atuou foi encontrado.</span></div> : null}
            </div>
            <Button type="button" variant="outline" size="icon" className="h-auto min-h-28 shrink-0 rounded-xl" disabled={safePlayerPage >= totalPlayerPages - 1} onClick={() => setPlayerPage((page) => Math.min(totalPlayerPages - 1, page + 1))} aria-label="Próximos jogadores">
              <ChevronRightIcon className="size-5" />
            </Button>
          </div>
        </section> : null}
      </div>
      <Dialog open={pickerOpen} onOpenChange={(open) => { setPickerOpen(open); if (!open) setPickerSlotIndex(null); }}>
        <DialogContent className="top-auto bottom-0 max-h-[88svh] max-w-none translate-y-0 overflow-hidden rounded-b-none rounded-t-3xl border-0 p-0 data-open:slide-in-from-bottom sm:top-1/2 sm:bottom-auto sm:max-w-lg sm:-translate-y-1/2 sm:rounded-2xl">
          <DialogHeader className="bg-gradient-to-br from-emerald-700 to-emerald-950 px-5 pb-5 pt-6 text-white">
            <DialogTitle className="text-xl font-extrabold">
              {pickerSlot?.role ? `Escolha um ${positionLabels[pickerSlot.role].toLowerCase()}` : "Escolha um jogador"}
            </DialogTitle>
            <DialogDescription className="text-emerald-100">
              Toque no jogador para colocá-lo no campo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-hidden px-4 pb-5">
            {pickerSlot ? (
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                Mostrando apenas jogadores compatíveis com esta posição.
              </div>
            ) : <PositionTabs value={positionFilter} onChange={setPositionFilter} />}
            <div className="relative"><SearchIcon className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar jogador ou seleção" className="h-10 pl-9" autoFocus /></div>
            <div className="max-h-[52svh] space-y-2 overflow-y-auto overscroll-contain pr-1">
              {filteredPlayers.map((player) => <PlayerChip key={player.id} player={player} disabled={selectedIds.has(player.id)} onClick={() => chooseFromPicker(player)} />)}
              {filteredPlayers.length === 0 ? <div className="grid place-items-center gap-2 py-10 text-center text-muted-foreground"><UsersIcon /><span>Nenhum jogador disponível nessa posição.</span></div> : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <DragOverlay>{activePlayerId && playerById.get(activePlayerId) ? <div className="rounded-lg border bg-background p-3 font-semibold shadow-xl">{playerById.get(activePlayerId)!.name}</div> : null}</DragOverlay>
    </DndContext>
  );
}
