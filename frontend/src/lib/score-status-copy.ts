export type ScoreStatus = "pending" | "correct" | "partial" | "wrong" | "inverse_penalty";

type MatchPhase = "live" | "scheduled" | "finished" | "locked" | "halftime" | string | null | undefined;

export function isFinishedPhase(phase: MatchPhase) {
  return phase === "finished";
}

export function scoreStatusLabel(status: ScoreStatus, phase?: MatchPhase) {
  const isFinished = isFinishedPhase(phase);

  if (!isFinished) {
    if (status === "correct" || status === "partial") return "Acertando";
    if (status === "wrong" || status === "inverse_penalty") return "Errando";
  }

  const labels: Record<ScoreStatus, string> = {
    pending: "Aguardando",
    correct: "Acertou",
    partial: "Parcial",
    wrong: "Errou",
    inverse_penalty: "Errou",
  };

  return labels[status];
}

export function scoreStatusShortLabel(status: ScoreStatus, phase?: MatchPhase) {
  const isFinished = isFinishedPhase(phase);

  if (!isFinished) {
    if (status === "correct" || status === "partial") return "acertando";
    if (status === "wrong" || status === "inverse_penalty") return "errando";
  }

  const labels: Record<ScoreStatus, string> = {
    pending: "aguardando",
    correct: "acertou",
    partial: "parcial",
    wrong: "errou",
    inverse_penalty: "errou",
  };

  return labels[status];
}
