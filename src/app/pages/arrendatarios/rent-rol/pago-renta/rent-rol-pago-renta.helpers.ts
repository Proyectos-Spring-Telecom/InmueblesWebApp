/**
 * Helpers para mostrar en Rent Rol las rentas registradas en Pagos del mes
 * (`GET /renta-actual/paginated`) que aún no se pagan.
 *
 * Solo lectura/transformación de datos: no modifica estado.
 */

/** Datos mínimos de una renta de Pagos del mes para filtrarla por mes y estatus. */
export interface RentaActualResumenVm {
  id: number;
  idArrendatario: number;
  idContrato: number;
  /** `YYYY-MM` del mes que cubre el pago. */
  mesClave: string;
  /** `YYYY-MM` final cuando es periodo; igual a `mesClave` si es un solo mes. */
  mesFinClave: string;
  pagada: boolean;
}

const LIMITE_PAGINA_RENTA_ACTUAL = 100;
const MAX_PAGINAS_RENTA_ACTUAL = 50;

const obj = (v: unknown): Record<string, unknown> | null =>
  v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const entero = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};

/**
 * `YYYY-MM` a partir de una fecha del API.
 * El API guarda hora local de CDMX con sufijo `Z`, así que se leen las partes tal cual.
 */
function claveMesDesdeApi(raw: unknown): string {
  const m = String(raw ?? '').trim().match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : '';
}

function lastPageDesdeApi(resp: unknown): number {
  const r = obj(resp);
  const meta = obj(r?.['paginated']) ?? obj(r?.['meta']) ?? obj(r?.['pagination']);
  return entero(meta?.['lastPage'] ?? meta?.['totalPages']) ?? 1;
}

export function mapRentaActualAPendiente(item: unknown): RentaActualResumenVm | null {
  const row = obj(item);
  if (!row) return null;
  const id = entero(row['id'] ?? row['idRentaActual']);
  const idArrendatario = entero(row['idArrendatario']);
  const idContrato = entero(row['idContrato']);
  const mesClave = claveMesDesdeApi(row['mes'] ?? row['fechaInicio']);
  if (id == null || idArrendatario == null || idContrato == null || !mesClave) return null;

  const finClave = claveMesDesdeApi(row['fechaFin']);
  const pagada = row['pagada'] === true || row['pagada'] === 1 || row['pagada'] === '1';
  return {
    id,
    idArrendatario,
    idContrato,
    mesClave,
    mesFinClave: finClave && finClave > mesClave ? finClave : mesClave,
    pagada,
  };
}

/** ¿El registro cubre el mes indicado (`YYYY-MM`)? Un mes o un periodo desde/hasta. */
export function cubreMes(r: Pick<RentaActualResumenVm, 'mesClave' | 'mesFinClave'>, clave: string): boolean {
  if (!clave) return false;
  return r.mesClave <= clave && clave <= r.mesFinClave;
}

/** Trae todas las rentas de Pagos del mes (el endpoint no filtra por mes). */
export async function cargarTodasRentasActuales(
  obtenerPagina: (page: number, limit: number) => Promise<unknown>,
  extraerFilas: (resp: unknown) => unknown[],
): Promise<unknown[]> {
  const acumulado: unknown[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const resp = await obtenerPagina(page, LIMITE_PAGINA_RENTA_ACTUAL);
    lastPage = lastPageDesdeApi(resp);
    acumulado.push(...extraerFilas(resp));
    page += 1;
  } while (page <= lastPage && page <= MAX_PAGINAS_RENTA_ACTUAL);
  return acumulado;
}
