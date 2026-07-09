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
  const bag = res as Record<string, unknown>;
  const pag = bag['paginated'];
  if (pag != null && typeof pag === 'object' && !Array.isArray(pag)) {
    const total = Number((pag as Record<string, unknown>)['total']);
    if (Number.isFinite(total) && total >= 0) return Math.floor(total);
  }
  const totalPlano = Number(bag['total'] ?? bag['Total']);
  if (Number.isFinite(totalPlano) && totalPlano >= 0) return Math.floor(totalPlano);
  return extraerFilasEntradasSalidasApi(res).length;
}

/** Si la primera página viene incompleta, no hay más registros aunque `paginated.total` diga otra cosa. */
export function totalRegistrosEntradasSalidasEfectivo(
  filasPagina: EntradaSalidaGridFila[],
  totalRegistros: number,
  limit: number,
): number {
  if (filasPagina.length > 0 && filasPagina.length < limit) {
    return filasPagina.length;
  }
  return totalRegistros;
}

/** Totales globales de entradas/salidas expuestos por el GET paginado (si existen). */
export interface EntradasSalidasTotalesVista {
  entradas: number | null;
  salidas: number | null;
  montoTotal: number | null;
}

function parseEnteroNoNegativo(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = Number(String(val).replace(/[$,\s]/g, '').trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function parseMonto(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = Number(String(val).replace(/[$,\s]/g, '').trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function leerCampoTotales(
  obj: Record<string, unknown>,
  keys: string[],
  parser: (val: unknown) => number | null,
): number | null {
  for (const key of keys) {
    const parsed = parser(obj[key]);
    if (parsed != null) return parsed;
  }
  return null;
}

function leerTotalesParcialesDesdeObj(
  obj: Record<string, unknown>,
): EntradasSalidasTotalesVista {
  return {
    entradas: leerCampoTotales(
      obj,
      [
        'entradas',
        'Entradas',
        'totalEntradas',
        'TotalEntradas',
        'countEntradas',
        'cantidadEntradas',
        'CantidadEntradas',
        'numEntradas',
        'NumEntradas',
        'noEntradas',
        'NoEntradas',
      ],
      parseEnteroNoNegativo,
    ),
    salidas: leerCampoTotales(
      obj,
      [
        'salidas',
        'Salidas',
        'totalSalidas',
        'TotalSalidas',
        'countSalidas',
        'cantidadSalidas',
        'CantidadSalidas',
        'numSalidas',
        'NumSalidas',
        'noSalidas',
        'NoSalidas',
      ],
      parseEnteroNoNegativo,
    ),
    montoTotal: leerCampoTotales(
      obj,
      [
        'montoTotal',
        'MontoTotal',
        'totalMonto',
        'TotalMonto',
        'sumTotal',
        'SumTotal',
        'totalGeneral',
        'TotalGeneral',
        'importeTotal',
        'ImporteTotal',
        'sumatoriaTotal',
        'SumatoriaTotal',
      ],
      parseMonto,
    ),
  };
}

function combinarTotales(
  base: EntradasSalidasTotalesVista,
  extra: EntradasSalidasTotalesVista,
): EntradasSalidasTotalesVista {
  return {
    entradas: base.entradas ?? extra.entradas,
    salidas: base.salidas ?? extra.salidas,
    montoTotal: base.montoTotal ?? extra.montoTotal,
  };
}

function totalesTienenAlguno(t: EntradasSalidasTotalesVista): boolean {
  return t.entradas != null || t.salidas != null || t.montoTotal != null;
}

/** Solo totales explícitos del servicio (`totales`, `resumen`, `paginated`, etc.). */
export function extraerTotalesEntradasSalidasApi(
  res: unknown,
): EntradasSalidasTotalesVista | null {
  if (res == null || typeof res !== 'object' || Array.isArray(res)) return null;
  const bag = res as Record<string, unknown>;
  let acumulado: EntradasSalidasTotalesVista = {
    entradas: null,
    salidas: null,
    montoTotal: null,
  };

  for (const key of [
    'totales',
    'Totales',
    'resumen',
    'Resumen',
    'summary',
    'Summary',
    'paginated',
    'Paginated',
  ]) {
    const nested = bag[key];
    if (nested != null && typeof nested === 'object' && !Array.isArray(nested)) {
      acumulado = combinarTotales(
        acumulado,
        leerTotalesParcialesDesdeObj(nested as Record<string, unknown>),
      );
    }
  }

  acumulado = combinarTotales(acumulado, leerTotalesParcialesDesdeObj(bag));
  return totalesTienenAlguno(acumulado) ? acumulado : null;
}

export function totalesEntradasSalidasCompletos(
  totales: EntradasSalidasTotalesVista,
): boolean {
  return (
    totales.entradas != null &&
    totales.salidas != null &&
    totales.montoTotal != null
  );
}

/** Totales calculados sobre las filas visibles de una hoja del grid. */
export interface EntradasSalidasTotalesPagina {
  entradas: number;
  salidas: number;
  montoTotal: number;
}

export function calcularTotalesEntradasSalidasDesdeFilas(
  filas: EntradaSalidaGridFila[],
): EntradasSalidasTotalesPagina {
  let entradas = 0;
  let salidas = 0;
  let montoTotal = 0;
  for (const row of filas) {
    if (row.fechaEntrada != null) entradas += 1;
    if (row.fechaSalida != null) salidas += 1;
    if (row.total != null && Number.isFinite(row.total)) montoTotal += row.total;
  }
  return { entradas, salidas, montoTotal };
}
