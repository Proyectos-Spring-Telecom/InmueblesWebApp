/**
 * Normaliza las respuestas de /contratos/generados.
 * Listado: { data: [{ id, idUsuario, nombreUsuario, clave, nombre, fhRegistro, fhUpdate }] }
 */

export type ContratoGeneradoRow = {
  id: number;
  nombre: string;
  clave: string;
  nombreUsuario: string;
  fhRegistro: Date | null;
  fhUpdate: Date | null;
};

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

/**
 * El API manda la hora de Ciudad de México marcada como `Z` (mismo criterio que `formatearFechaHoraUtc`):
 * `2026-10-13T16:48:59.000Z` → 13/10/2026 04:48 p. m. (no 10:48 a. m. por el corrimiento UTC−6).
 * Se arma un Date local con la hora tal cual para que el grid pueda ordenar y filtrar por fecha.
 */
function fecha(v: unknown): Date | null {
  if (!v) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(v).trim());
  if (iso) {
    const [, y, mo, d, hh = '0', mi = '0', ss = '0'] = iso;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mi), Number(ss));
  }
  const parsed = new Date(String(v));
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function extraerListaGenerados(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
}

export function mapearContratoGenerado(item: any): ContratoGeneradoRow {
  return {
    id: Number(item?.id) || 0,
    nombre: str(item?.nombre) || '—',
    clave: str(item?.clave) || '—',
    nombreUsuario: str(item?.nombreUsuario) || '—',
    fhRegistro: fecha(item?.fhRegistro),
    fhUpdate: fecha(item?.fhUpdate),
  };
}

/**
 * GET /contratos/generados/{id}: la plantilla guardada puede venir en el propio registro
 * (con "secciones") o anidada (plantilla/datos/contenido), como objeto o como texto JSON.
 * Regresa solo { clave, nombre, secciones }: el mismo JSON que se envía en los POST.
 */
export function extraerPlantillaGenerada(response: any): { clave: string; nombre: string; secciones: any[] } | null {
  const registro = response?.data && !Array.isArray(response.data) ? response.data : response;
  let fuente: any = null;

  if (Array.isArray(registro?.secciones)) {
    fuente = registro;
  } else {
    let anidada = registro?.plantilla ?? registro?.datos ?? registro?.contenido ?? registro?.json ?? null;
    if (typeof anidada === 'string') {
      try {
        anidada = JSON.parse(anidada);
      } catch {
        anidada = null;
      }
    }
    if (Array.isArray(anidada?.secciones)) fuente = anidada;
  }

  if (!fuente || !fuente.secciones.length) return null;
  return {
    clave: str(fuente.clave) || str(registro?.clave),
    nombre: str(fuente.nombre) || str(registro?.nombre),
    secciones: fuente.secciones,
  };
}
