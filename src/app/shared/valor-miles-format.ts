/** Miles con coma al escribir; admite un punto decimal. */
export function formatMilesAlEscribir(raw: string): string {
  let s = String(raw ?? '').replace(/,/g, '');
  s = s.replace(/[^\d.]/g, '');
  const firstDot = s.indexOf('.');
  const hasDot = firstDot >= 0;
  let intRaw = hasDot ? s.slice(0, firstDot) : s;
  const decRaw = hasDot ? s.slice(firstDot + 1).replace(/\./g, '') : '';

  intRaw = intRaw.replace(/^0+(?=\d)/, '');
  if (!hasDot) {
    if (intRaw === '') return '';
    return intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  const intForComma = intRaw === '' ? '0' : intRaw;
  const intComma = intForComma.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (decRaw.length > 0) return `${intComma}.${decRaw}`;
  return `${intComma}.`;
}

export function countDigitosAntesCursor(value: string, cursor: number): number {
  let n = 0;
  const end = Math.min(cursor, value.length);
  for (let i = 0; i < end; i++) {
    if (value[i] >= '0' && value[i] <= '9') n++;
  }
  return n;
}

export function cursorPosicionTrasFormatoMiles(formatted: string, digitsBefore: number): number {
  if (digitsBefore <= 0) return 0;
  let digitCount = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] >= '0' && formatted[i] <= '9') {
      digitCount++;
      if (digitCount >= digitsBefore) return i + 1;
    }
  }
  return formatted.length;
}

export function formatMilesDesdeNumero(n: number): string {
  if (!Number.isFinite(n)) return '';
  const str = String(n);
  const parts = str.split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
}

/**
 * Vista/grid: miles con coma; sin ceros decimales finales superfluos.
 * Acepta número o string API (ej. "127000.0000" → "127,000").
 */
export function formatValorMilesParaLista(value: unknown): string {
  const s = String(value ?? '').replace(/,/g, '').trim();
  if (!s) return '';
  const normalized = s.replace(/[^\d.]/g, '');
  if (!normalized) return '';
  const dot = normalized.indexOf('.');
  let intRaw = dot >= 0 ? normalized.slice(0, dot) : normalized;
  let decRaw = dot >= 0 ? normalized.slice(dot + 1).replace(/0+$/, '') : '';
  intRaw = intRaw.replace(/^0+(?=\d)/, '');
  if (intRaw === '') intRaw = '0';
  const intFmt = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decRaw.length > 0) return `${intFmt}.${decRaw}`;
  return intFmt;
}

/** Valor numérico para validaciones (interpretando comas de miles). */
export function parseValorNumerico(value: unknown): number {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

/** Cuerpo API: quita comas de miles del texto mostrado en el input. */
export function valorSinComasParaApi(display: unknown): string {
  return String(display ?? '').replace(/,/g, '').trim();
}

/**
 * Extrae solo dígitos y un punto decimal (máx. 2 decimales).
 * Ej.: `"$5,325.50"` → `"5325.50"` (mismo valor numérico, solo vista).
 */
export function extraerMontoRawDesdeDisplay(display: string): string {
  let out = '';
  let dot = false;
  for (const ch of display) {
    if (ch >= '0' && ch <= '9') {
      if (dot) {
        const dec = out.split('.')[1] ?? '';
        if (dec.length >= 2) continue;
      }
      out += ch;
    } else if ((ch === '.' || ch === ',') && !dot) {
      out += '.';
      dot = true;
    }
  }
  return out;
}

/** Solo presentación: `$` + comas de miles; no cambia el valor de `raw`. */
export function formatearMonedaDesdeLimpia(raw: string): string {
  if (!raw) return '';

  const dot = raw.indexOf('.');
  if (dot === -1) {
    const intComma = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `$${intComma}`;
  }

  const intRaw = raw.slice(0, dot);
  const decRaw = raw.slice(dot + 1);
  const intComma = (intRaw === '' ? '0' : intRaw).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decRaw.length > 0) return `$${intComma}.${decRaw}`;
  return `$${intComma}.`;
}

/** Cuenta dígitos y el punto antes del cursor (para no moverlo al formatear). */
export function contarMontoSimbolosAntesCursor(display: string, cursor: number): number {
  let n = 0;
  const end = Math.min(cursor, display.length);
  for (let i = 0; i < end; i++) {
    const ch = display[i];
    if ((ch >= '0' && ch <= '9') || ch === '.') n++;
  }
  return n;
}

export function cursorMontoTrasFormato(display: string, simbolosAntes: number): number {
  if (simbolosAntes <= 0) return display.startsWith('$') ? 1 : 0;
  let n = 0;
  for (let i = 0; i < display.length; i++) {
    const ch = display[i];
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      n++;
      if (n >= simbolosAntes) return i + 1;
    }
  }
  return display.length;
}

/**
 * Moneda MXN al escribir: `$3,500.65` (coma miles, hasta 2 decimales).
 * No altera el valor numérico enviado al API (usar `parseMonedaNumerico`).
 */
export function formatMonedaAlEscribir(raw: string): string {
  return formatearMonedaDesdeLimpia(extraerMontoRawDesdeDisplay(raw));
}

/** Parsea texto con `$` y comas a número para POST (ej. monto del pago). */
export function parseMonedaNumerico(value: unknown): number {
  const s = String(value ?? '')
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .trim();
  if (!s) return NaN;
  const parts = s.split('.');
  const intPart = parts[0] ?? '';
  const decPart = (parts[1] ?? '').slice(0, 2);
  const num = Number(decPart ? `${intPart}.${decPart}` : intPart);
  return Number.isFinite(num) ? num : NaN;
}

/** Vista final del input (p. ej. al salir del campo): siempre 2 decimales. */
export function formatMonedaDesdeNumero(n: number): string {
  if (!Number.isFinite(n)) return '';
  const fmt = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `$${fmt}`;
}
