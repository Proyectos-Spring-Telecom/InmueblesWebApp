/** Fila del grid de consulta paginada `/bitacora/paginated`. */
export interface BitacoraGridRow {
  id: number;
  fecha: string;
  usuario: string;
  modulo: string;
  /** Etiqueta en español para mostrar (CREAR, ACTUALIZAR, …). */
  accion: string;
  /** Valor crudo de la API (CREATE, UPDATE, …) para filtrar/buscar. */
  accionRaw: string;
  /** Clase CSS tipo Swagger: post / get / put / delete / patch. */
  accionClass: string;
  descripcion: string;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v != null && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function texto(...vals: unknown[]): string {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '—';
}

function concatenarNombreUsuario(row: Record<string, unknown>): string {
  const partes = [
    row['nombreUsuario'],
    row['apellidoPaternoUsuario'],
    row['apellidoMaternoUsuario'],
  ]
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter((p) => p.length > 0);

  if (partes.length) return partes.join(' ');

  return texto(
    row['UserNameUsuario'],
    row['userNameUsuario'],
    row['usuario'],
  );
}

function nombreModulo(row: Record<string, unknown>): string {
  if (typeof row['modulo'] === 'string' && row['modulo'].trim()) {
    return row['modulo'].trim();
  }
  return texto(row['nombreModulo'], row['descripcionModulo']);
}

function formatearFecha(raw: unknown): string {
  if (raw == null || String(raw).trim() === '') return '—';
  const s = String(raw).trim();
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }
  return s;
}

/** Traducción + clase Swagger para `accion` de bitácora. */
export function resolverAccionBitacora(raw: unknown): {
  label: string;
  cssClass: string;
  raw: string;
} {
  const rawStr = raw == null ? '' : String(raw).trim();
  const key = rawStr.toUpperCase();

  switch (key) {
    case 'CREATE':
    case 'POST':
    case 'INSERT':
    case 'ADD':
      return { label: 'CREAR', cssClass: 'bitacora-accion--post', raw: rawStr };
    case 'GET':
    case 'READ':
    case 'SELECT':
    case 'LIST':
    case 'CONSULT':
    case 'CONSULTAR':
      return { label: 'CONSULTAR', cssClass: 'bitacora-accion--get', raw: rawStr };
    case 'UPDATE':
    case 'PUT':
    case 'EDIT':
    case 'MODIFY':
      return { label: 'ACTUALIZAR', cssClass: 'bitacora-accion--put', raw: rawStr };
    case 'PATCH':
      return { label: 'PARCHE', cssClass: 'bitacora-accion--patch', raw: rawStr };
    case 'DELETE':
    case 'REMOVE':
    case 'DESTROY':
      return { label: 'ELIMINAR', cssClass: 'bitacora-accion--delete', raw: rawStr };
    case 'EVALUATE':
    case 'EVAL':
    case 'CALC':
    case 'CALCULATE':
      return { label: 'EVALUAR', cssClass: 'bitacora-accion--evaluate', raw: rawStr };
    default:
      return {
        label: rawStr ? rawStr.toUpperCase() : '—',
        cssClass: 'bitacora-accion--default',
        raw: rawStr,
      };
  }
}

/** Normaliza un elemento de `data[]` de `/bitacora/paginated` hacia la forma del grid. */
export function mapBitacoraPaginatedItemToRow(item: unknown): BitacoraGridRow | null {
  const row = asRecord(item);
  if (!row) return null;

  const id = Number(row['id'] ?? row['idBitacora']);
  if (!Number.isFinite(id)) return null;

  const accionInfo = resolverAccionBitacora(row['accion'] ?? row['movimiento'] ?? row['tipo']);

  return {
    id,
    fecha: formatearFecha(row['fechaCreacion'] ?? row['FechaCreacion'] ?? row['fhRegistro']),
    usuario: concatenarNombreUsuario(row),
    modulo: nombreModulo(row),
    accion: accionInfo.label,
    accionRaw: accionInfo.raw,
    accionClass: accionInfo.cssClass,
    descripcion: texto(
      row['descripcion'],
      row['detalle'],
      row['comentario'],
      row['observacion'],
      row['mensaje'],
    ),
  };
}
