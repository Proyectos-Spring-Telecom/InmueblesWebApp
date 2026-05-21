export interface EntradaSalidaGridFila {
  id?: number;
  boleto: string;
  fechaE: Date | null;
  fechaP: Date | null;
  total: number | null;
}

function parseFecha(val: unknown): Date | null {
  if (val == null || val === '') return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val;
  const s = String(val).trim();
  if (!s) return null;
  const iso = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseTotal(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function valorTexto(item: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = item[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function extraerFilasEntradasSalidasApi(res: unknown): EntradaSalidaGridFila[] {
  if (res == null) return [];
  const r = res as Record<string, unknown> | unknown[];
  let rows: unknown = Array.isArray(r) ? r : null;
  if (!rows && typeof res === 'object') {
    const bag = res as Record<string, unknown>;
    rows =
      bag['data'] ??
      bag['items'] ??
      bag['rows'] ??
      bag['content'] ??
      null;
    if (rows != null && typeof rows === 'object' && !Array.isArray(rows)) {
      const inner = rows as Record<string, unknown>;
      rows = inner['items'] ?? inner['rows'] ?? inner['content'] ?? inner['data'];
    }
  }
  if (!Array.isArray(rows)) return [];

  const out: EntradaSalidaGridFila[] = [];
  for (const item of rows) {
    if (item == null || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const boleto = valorTexto(row, ['boleto', 'Boleto']);
    if (!boleto) continue;
    const idRaw = Number(row['id']);
    out.push({
      id: Number.isFinite(idRaw) && idRaw > 0 ? Math.floor(idRaw) : undefined,
      boleto,
      fechaE: parseFecha(
        row['fechaE'] ??
          row['FechaE'] ??
          row['fechaEntrada'] ??
          row['FechaEntrada'],
      ),
      fechaP: parseFecha(
        row['fechaP'] ??
          row['FechaP'] ??
          row['fechaPago'] ??
          row['FechaPago'],
      ),
      total: parseTotal(row['total'] ?? row['Total']),
    });
  }
  return out;
}
