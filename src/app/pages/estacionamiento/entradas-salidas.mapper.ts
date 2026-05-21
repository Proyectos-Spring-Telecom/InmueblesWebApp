/** Fila del grid «Entradas y Salidas» (GET paginated / importar). */
export interface EntradaSalidaGridFila {
  id: number;
  boleto: string;
  fechaEntrada: Date | null;
  fechaSalida: Date | null;
  total: number | null;
  fhRegistro: Date | null;
}

function parseFecha(val: unknown): Date | null {
  if (val == null || val === '') return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val;
  const d = new Date(String(val).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseTotal(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = Number(String(val).replace(/[$,\s]/g, ''));
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
  const bag =
    typeof res === 'object' && !Array.isArray(res)
      ? (res as Record<string, unknown>)
      : null;
  let rows: unknown = Array.isArray(res) ? res : bag?.['data'];
  if (rows != null && typeof rows === 'object' && !Array.isArray(rows)) {
    const inner = rows as Record<string, unknown>;
    rows = inner['items'] ?? inner['rows'] ?? inner['content'] ?? inner['data'];
  }
  if (!Array.isArray(rows)) return [];

  const out: EntradaSalidaGridFila[] = [];
  for (const item of rows) {
    if (item == null || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const boleto = valorTexto(row, ['boleto', 'Boleto']);
    const idRaw = Number(row['id']);
    if (!Number.isFinite(idRaw) || idRaw <= 0) continue;
    if (!boleto) continue;
    out.push({
      id: Math.floor(idRaw),
      boleto,
      fechaEntrada: parseFecha(
        row['fechaEntrada'] ?? row['FechaEntrada'] ?? row['fechaE'] ?? row['FechaE'],
      ),
      fechaSalida: parseFecha(
        row['fechaSalida'] ??
          row['FechaSalida'] ??
          row['fechaP'] ??
          row['FechaP'] ??
          row['fechaPago'] ??
          row['FechaPago'],
      ),
      total: parseTotal(row['total'] ?? row['Total']),
      fhRegistro: parseFecha(row['fhRegistro'] ?? row['FhRegistro']),
    });
  }
  return out;
}

/** Total de registros desde `paginated.total` del GET paginado. */
export function extraerTotalEntradasSalidasPaginated(res: unknown): number {
  if (res == null || typeof res !== 'object' || Array.isArray(res)) return 0;
  const pag = (res as Record<string, unknown>)['paginated'];
  if (pag == null || typeof pag !== 'object' || Array.isArray(pag)) return 0;
  const total = Number((pag as Record<string, unknown>)['total']);
  return Number.isFinite(total) && total >= 0 ? Math.floor(total) : 0;
}
