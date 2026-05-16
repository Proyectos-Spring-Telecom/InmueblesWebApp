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
