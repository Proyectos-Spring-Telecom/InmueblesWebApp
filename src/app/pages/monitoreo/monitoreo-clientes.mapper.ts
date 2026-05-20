import { urlLogotipoCliente } from '../clientes/clientes-list.mapper';
import {
  etiquetaEstatusInmueble,
  etiquetaEstatusRegistro,
  idArrendadorDesdeApi,
  InmuebleApiItem,
  nombreArrendador,
  separarArchivosInmueble,
} from '../inmuebles/inmuebles-list.mapper';

/** Filas de GET `/inmuebles/arrendador/{id}` o `/inmuebles/paginated` (`data`). */
export function extraerInmueblesListadoApi(resp: unknown): InmuebleApiItem[] {
  return extraerFilasListadoApi(resp) as InmuebleApiItem[];
}

/** @deprecated Usar {@link extraerInmueblesListadoApi}. */
export function extraerInmueblesPaginatedApi(resp: unknown): InmuebleApiItem[] {
  return extraerInmueblesListadoApi(resp);
}

export function extraerFilasListadoApi(resp: unknown): Record<string, unknown>[] {
  if (Array.isArray(resp)) {
    return resp.filter(
      (x): x is Record<string, unknown> =>
        x != null && typeof x === 'object' && !Array.isArray(x),
    );
  }
  if (resp != null && typeof resp === 'object') {
    const data = (resp as Record<string, unknown>)['data'];
    if (Array.isArray(data)) {
      return data.filter(
        (x): x is Record<string, unknown> =>
          x != null && typeof x === 'object' && !Array.isArray(x),
      );
    }
  }
  return [];
}

export function nombreClienteMonitoreo(item: Record<string, unknown>): string {
  const tipo = Number(item['tipoPersona']);
  const nombre = String(item['nombre'] ?? '').trim();
  if (tipo === 2 && nombre) {
    return nombre;
  }
  const compuesto = [nombre, item['apellidoPaterno'], item['apellidoMaterno']]
    .map((v) => (v != null ? String(v).trim() : ''))
    .filter(Boolean)
    .join(' ');
  return compuesto || nombre || 'Arrendador';
}

export function direccionClienteMonitoreo(item: Record<string, unknown>): string {
  const partes = [
    item['calle'] ? `Calle ${item['calle']}` : '',
    item['numeroExterior'] ? `#${item['numeroExterior']}` : '',
    item['numeroInterior'] ? `Int. ${item['numeroInterior']}` : '',
    item['colonia'] || '',
    item['municipio'] || '',
    item['estado'] || '',
    item['cp'] ? `CP ${item['cp']}` : '',
  ]
    .map((v) => String(v).trim())
    .filter(Boolean);
  const texto = partes.join(', ');
  if (texto) return texto;
  const legacy = String(item['direccion'] ?? '').trim();
  return legacy || 'Sin dirección';
}

export function vigenciaAniosMonitoreo(item: InmuebleApiItem): string {
  const raw = item.vigenciaAnios ?? item.tiempoRentaAnios ?? item.tiempoRenta;
  if (raw == null || raw === '') return '';
  return String(raw).trim();
}

export function mapInmuebleMonitoreoInstalacion(
  item: InmuebleApiItem,
  nombreCliente: string,
): Record<string, unknown> {
  const id = Number(item.id);
  const idFinal = Number.isFinite(id) ? id : 0;
  const arrObj = item.arrendador as Record<string, unknown> | undefined;
  const nombreArr = nombreArrendador(arrObj) || nombreCliente;
  const { documentos } = separarArchivosInmueble(item.archivos, item.imagenes);
  const imagenFachada = String(documentos.fachada?.url ?? '').trim();
  const estatusInmuebleNum =
    item.estatusInmueble != null ? Number(item.estatusInmueble) : null;
  const estatusInmuebleTipoLabel = etiquetaEstatusInmueble(
    Number.isFinite(estatusInmuebleNum as number)
      ? (estatusInmuebleNum as number)
      : null,
  );
  const estatusRegistro =
    item.estatus != null ? Number(item.estatus) : null;
  const estatusRegistroLabel = etiquetaEstatusRegistro(estatusRegistro);
  const vigencia = vigenciaAniosMonitoreo(item);
  const zonas = Array.isArray(item.zonas) ? item.zonas : [];
  const servicios = Array.isArray(item.servicios) ? item.servicios : [];

  return {
    id: idFinal,
    idInstalacion: idFinal,
    nombreDepartamento: String(item.inmueble ?? 'Inmueble').trim(),
    nombreInstalacion: String(item.inmueble ?? 'Inmueble').trim(),
    direccion: String(item.direccionFiscal ?? '').trim(),
    arrendador: nombreArr,
    imagenFachada,
    estatus:
      estatusRegistro != null && Number.isFinite(estatusRegistro)
        ? estatusRegistro
        : undefined,
    estatusLabel: estatusRegistroLabel,
    estatusInmueble: estatusInmuebleNum,
    estatusInmuebleTipoLabel,
    fechaInicio: fechaCortaMonitoreo(item.fechaInicio),
    fechaFin: fechaCortaMonitoreo(item.fechaFin),
    vigenciaAnios: vigencia,
    tiempoRentaAnios: vigencia,
    nombreRepresentante: String(item.nombreRepresentante ?? '').trim(),
    telefonoRepresentante: String(item.telefonoRepresentante ?? '').trim(),
    correoRepresentante: String(item.correoRepresentante ?? '').trim(),
    numZonas: zonas.length,
    numServicios: servicios.length,
    lat: item.lat != null ? Number(item.lat) : undefined,
    lng: item.lng != null ? Number(item.lng) : undefined,
    locales: Array.isArray((item as Record<string, unknown>)['locales'])
      ? ((item as Record<string, unknown>)['locales'] as unknown[])
      : [],
    mapaInmueble:
      (item as Record<string, unknown>)['mapaInmueble'] ?? null,
    zonas: item.zonas,
    servicios: item.servicios,
    detalle: item,
  };
}

function fechaCortaMonitoreo(raw?: string): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function mapClienteMonitoreoCentral(
  item: Record<string, unknown>,
  instalaciones: Record<string, unknown>[],
): Record<string, unknown> {
  const id = Number(item['id']);
  const idFinal = Number.isFinite(id) ? id : 0;
  const nombreCliente = nombreClienteMonitoreo(item);
  const direccion = direccionClienteMonitoreo(item);
  const logotipo = urlLogotipoCliente(item);

  let lat: number | undefined;
  let lng: number | undefined;
  for (const ins of instalaciones) {
    const la = Number(ins['lat']);
    const ln = Number(ins['lng']);
    if (Number.isFinite(la) && Number.isFinite(ln)) {
      lat = la;
      lng = ln;
      break;
    }
  }

  const estatusRaw = item['estatus'] ?? item['estatusCliente'] ?? 1;
  const estatus = Number(estatusRaw);

  return {
    id: idFinal,
    idCliente: idFinal,
    nombreCliente,
    nombreEncargado: String(item['nombreEncargado'] ?? '').trim(),
    direccion,
    logotipo,
    imagenUrl: logotipo,
    lat,
    lng,
    estatus: Number.isFinite(estatus) ? estatus : 1,
    instalaciones,
    detalle: item,
  };
}

export function agruparInmueblesPorArrendador(
  inmuebles: InmuebleApiItem[],
  nombresPorId: Map<number, string>,
): Map<number, Record<string, unknown>[]> {
  const map = new Map<number, Record<string, unknown>[]>();

  for (const item of inmuebles) {
    const idArr = idArrendadorDesdeApi(item);
    if (idArr == null) continue;
    const nombre =
      nombresPorId.get(idArr) ?? nombreArrendador(item.arrendador) ?? 'Arrendador';
    const fila = mapInmuebleMonitoreoInstalacion(item, nombre);
    const list = map.get(idArr) ?? [];
    list.push(fila);
    map.set(idArr, list);
  }

  return map;
}
