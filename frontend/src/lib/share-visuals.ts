const flagCodeMap: Record<string, string> = {
  ARG: "AR",
  BRA: "BR",
  CAN: "CA",
  MEX: "MX",
  USA: "US",
  FRA: "FR",
  GER: "DE",
  DEU: "DE",
  ENG: "GB",
  ESP: "ES",
  POR: "PT",
  ITA: "IT",
  NED: "NL",
  HOL: "NL",
  BEL: "BE",
  CRO: "HR",
  URU: "UY",
  COL: "CO",
  CHI: "CL",
  ECU: "EC",
  PER: "PE",
  PAR: "PY",
  BOL: "BO",
  VEN: "VE",
  JPN: "JP",
  KOR: "KR",
  IRN: "IR",
  AUS: "AU",
  QAT: "QA",
  KSA: "SA",
  MAR: "MA",
  TUN: "TN",
  EGY: "EG",
  NGA: "NG",
  SEN: "SN",
  GHA: "GH",
  CMR: "CM",
  CIV: "CI",
  CZE: "CZ",
  CZECHIA: "CZ",
  RSA: "ZA",
  SUI: "CH",
  BIH: "BA",
};

const flagNameMap: Record<string, string> = {
  ARGENTINA: "AR",
  BRASIL: "BR",
  BRAZIL: "BR",
  CANADA: "CA",
  MEXICO: "MX",
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  EUA: "US",
  USA: "US",
  FRANCE: "FR",
  FRANCA: "FR",
  ALEMANHA: "DE",
  GERMANY: "DE",
  ENGLAND: "GB",
  INGLATERRA: "GB",
  SPAIN: "ES",
  ESPANHA: "ES",
  PORTUGAL: "PT",
  ITALY: "IT",
  ITALIA: "IT",
  NETHERLANDS: "NL",
  HOLANDA: "NL",
  BELGIUM: "BE",
  BELGICA: "BE",
  CROATIA: "HR",
  CROACIA: "HR",
  URUGUAY: "UY",
  COLOMBIA: "CO",
  CHILE: "CL",
  ECUADOR: "EC",
  JAPAN: "JP",
  JAPAO: "JP",
  "SOUTH KOREA": "KR",
  "KOREA REPUBLIC": "KR",
  IRAN: "IR",
  AUSTRALIA: "AU",
  QATAR: "QA",
  MOROCCO: "MA",
  MARROCOS: "MA",
  TUNISIA: "TN",
  EGYPT: "EG",
  EGITO: "EG",
  NIGERIA: "NG",
  SENEGAL: "SN",
  GHANA: "GH",
  CAMEROON: "CM",
  CAMAROES: "CM",
  CZECHIA: "CZ",
  TCHEQUIA: "CZ",
  "CZECH REPUBLIC": "CZ",
  "REPUBLICA TCHECA": "CZ",
  "SOUTH AFRICA": "ZA",
  "AFRICA DO SUL": "ZA",
  SWITZERLAND: "CH",
  SUICA: "CH",
  "BOSNIA AND HERZEGOVINA": "BA",
  "BOSNIA-HERZEGOVINA": "BA",
  BOSNIAHERZEGOVINA: "BA",
  BOSNIA: "BA",
};

function normalizeFlagValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z ]/g, "")
    .trim()
    .toUpperCase();
}

function codeToEmoji(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  const offset = 127397;
  return Array.from(code).map((char) => String.fromCodePoint(char.charCodeAt(0) + offset)).join("");
}

function flagCountryCode(value?: string | null) {
  if (!value) return null;
  const normalized = normalizeFlagValue(value);
  return (
    flagNameMap[normalized] ??
    flagCodeMap[normalized] ??
    (normalized.length === 2 ? normalized : null)
  );
}

export function flagImageUrl(value?: string | null, size: 40 | 80 | 160 = 80) {
  const code = flagCountryCode(value);
  return code ? `https://flagcdn.com/w${size}/${code.toLowerCase()}.png` : null;
}

export function flagEmoji(value?: string | null) {
  const code = flagCountryCode(value);
  return code ? codeToEmoji(code) : "🏳️";
}

export function withFlag(label: string, hint?: string | null) {
  return `${flagEmoji(hint ?? label)} ${label}`;
}

export function loadCanvasImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function drawTrophyWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const trophy = await loadCanvasImage("/world-cup-trophy.png");
  if (!trophy) return;

  const size = Math.min(width * 1.05, height * 0.64);
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.drawImage(trophy, (width - size) / 2, height * 0.16, size, size);
  ctx.restore();
}

export function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const sw = width / scale;
  const sh = height / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height);
}

export function drawFlagBadge(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  fallback: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 10);
  ctx.fill();

  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 10);
    ctx.clip();
    drawCoverImage(ctx, img, x, y, width, height);
    ctx.restore();
  } else {
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 22px Arial, sans-serif";
    ctx.fillText(fallback.slice(0, 3).toUpperCase(), x + width / 2, y + height / 2);
  }

  ctx.strokeStyle = "rgba(15,23,42,0.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 10);
  ctx.stroke();
  ctx.restore();
}
