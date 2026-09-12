import { mapClientesApiToGridRows } from '../clientes/clientes-list.mapper';
import { mapInmueblesApiToGridRows } from '../inmuebles/inmuebles-list.mapper';
import {
  extraerFilasPaginadasApi,
  resolverIdArrendatarioApi,
} from './arrendatarios-list.mapper';

export interface InmuebleFiltroOpcion {
  id: number;
  nombre: string;
}

export interface ArrendadorFiltroOpcion {
  id: number;
  nombre: string;
}

/** Normaliza respuesta de catálogo de inmuebles al dropdown del filtro. */
export function mapInmueblesAFiltroOpciones(resp: unknown): InmuebleFiltroOpcion[] {
  const r = resp as { data?: unknown[] } | unknown[] | null;
  const rows = Array.isArray(r) ? r : ((r as { data?: unknown[] } | null)?.data ?? []);
  return mapInmueblesApiToGridRows(Array.isArray(rows) ? rows : [])
    .filter((row: { id: number }) => Number.isFinite(row.id) && row.id > 0)
    .map((row: { id: number; inmueble?: string }) => ({
      id: row.id,
      nombre: String(row.inmueble || `Inmueble #${row.id}`).trim() || `Inmueble #${row.id}`,
    }));
}

/** Normaliza respuesta de clientes/arrendadores al dropdown del filtro. */
export function mapArrendadoresAFiltroOpciones(resp: unknown): ArrendadorFiltroOpcion[] {
  const r = resp as { data?: unknown[] } | unknown[] | null;
  const rows = Array.isArray(r) ? r : ((r as { data?: unknown[] } | null)?.data ?? []);
  return mapClientesApiToGridRows(Array.isArray(rows) ? rows : [])
    .filter((c) => Number.isFinite(c.id) && c.id > 0)
    .map((c) => ({
      id: c.id,
      nombre:
        String(c.NombreCompleto || c.nombre || 'Arrendador').trim() || 'Arrendador',
    }));
}

/** IDs de arrendatario desde `GET /arrendatarios/inmueble/{id}` (u otra lista). */
export function idsArrendatarioDesdeRespuestaApi(resp: unknown): Set<number> {
  let rows = extraerFilasPaginadasApi(resp);
  if (rows.length === 0 && resp != null && typeof resp === 'object' && !Array.isArray(resp)) {
    const r = resp as Record<string, unknown>;
    if (Array.isArray(r['arrendatarios'])) {
      rows = (r['arrendatarios'] as unknown[]).filter(
        (x): x is Record<string, unknown> =>
          x != null && typeof x === 'object' && !Array.isArray(x),
      );
    }
  }
  const ids = new Set<number>();
  for (const row of rows) {
    const id = resolverIdArrendatarioApi(row);
    if (id != null && id > 0) ids.add(id);
  }
  return ids;
}

export function etiquetaInmuebleFiltroUi(
  idSeleccionado: number | null,
  lista: InmuebleFiltroOpcion[],
  cargando: boolean,
): string {
  if (cargando) return 'Cargando inmuebles…';
  if (idSeleccionado == null) return 'Todos los inmuebles';
  return lista.find((i) => i.id === idSeleccionado)?.nombre ?? 'Todos los inmuebles';
}

export function etiquetaArrendadorFiltroUi(
  idSeleccionado: number | null,
  lista: ArrendadorFiltroOpcion[],
  cargando: boolean,
): string {
  if (cargando) return 'Cargando arrendadores…';
  if (idSeleccionado == null) return 'Todos los arrendadores';
  return lista.find((a) => a.id === idSeleccionado)?.nombre ?? 'Todos los arrendadores';
}

export function claveCacheFiltroPagosMes(
  idArrendador: number | null,
  idInmueble: number | null,
): string {
  return `${idArrendador ?? 'x'}:${idInmueble ?? 'x'}`;
}
