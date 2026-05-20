import {
  etiquetaEstatusLocal,
  fechaParaInputDate,
  formatearMoneda,
} from '../inmuebles/inmuebles-list.mapper';
import { extraerFilasListadoApi } from './monitoreo-clientes.mapper';

/** Filas de GET `/inmuebles/locales/{idInmueble}`. */
export function extraerLocalesInmuebleApi(resp: unknown): Record<string, unknown>[] {
  return extraerFilasListadoApi(resp);
}

/** URL de fachada del local (`fachadaUrl` en GET `/locales` y `/locales-libres`). */
export function urlFachadaLocalApi(
  local: Record<string, unknown> | null | undefined,
): string {
  if (!local) return '';
  const direct = String(
    local['fachadaUrl'] ?? local['urlFachada'] ?? local['imagenFachada'] ?? '',
  ).trim();
  if (direct) return direct;
  const fachada = local['fachada'];
  if (fachada != null && typeof fachada === 'object' && !Array.isArray(fachada)) {
    return String((fachada as Record<string, unknown>)['url'] ?? '').trim();
  }
  if (typeof fachada === 'string' && fachada.trim()) return fachada.trim();
  return urlFachadaDesdeArchivos(local);
}

/** URL del archivo cuyo `nombre` es exactamente «Fachada» (insensible a mayúsculas). */
export function urlFachadaDesdeArchivos(
  item: Record<string, unknown> | null | undefined,
): string {
  if (!item) return '';
  const archivos = item['archivos'];
  if (!Array.isArray(archivos)) return '';
  let fallback = '';
  for (const raw of archivos) {
    if (raw == null || typeof raw !== 'object') continue;
    const a = raw as Record<string, unknown>;
    const nombre = String(a['nombre'] ?? '').trim();
    const url = String(a['url'] ?? '').trim();
    if (!url) continue;
    if (nombre.toLowerCase() === 'fachada') {
      return url;
    }
    if (!fallback && nombre.toLowerCase().startsWith('fachada')) {
      fallback = url;
    }
  }
  return fallback;
}

function idLocalDesdeContrato(c: Record<string, unknown>): number | null {
  const localObj =
    c['local'] != null && typeof c['local'] === 'object' && !Array.isArray(c['local'])
      ? (c['local'] as Record<string, unknown>)
      : null;
  const idLocal = Number(c['idLocal'] ?? localObj?.['id']);
  return Number.isFinite(idLocal) && idLocal > 0 ? idLocal : null;
}

function fhContrato(c: Record<string, unknown>): string {
  return String(c['fhRegistro'] ?? '').trim();
}

/** Por cada `idLocal` el contrato más reciente del inmueble que tenga local asignado. */
function buildOcupacionPorIdLocal(
  arrendatarios: Record<string, unknown>[],
  idInmueble: number,
): Map<number, Record<string, unknown>> {
  const map = new Map<number, Record<string, unknown>>();

  for (const item of arrendatarios) {
    const contratos = item['contratos'];
    if (!Array.isArray(contratos)) continue;

    for (const raw of contratos) {
      if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const c = raw as Record<string, unknown>;
      const idInm = Number(c['idInmueble']);
      if (!Number.isFinite(idInm) || idInm !== idInmueble) continue;

      const idLocal = idLocalDesdeContrato(c);
      if (idLocal == null) continue;

      const prev = map.get(idLocal);
      const prevContrato = prev?.['contrato'] as Record<string, unknown> | undefined;
      if (prevContrato && fhContrato(c) < fhContrato(prevContrato)) {
        continue;
      }

      map.set(idLocal, {
        arrendatario: item,
        contrato: c,
        nombreArrendatario: String(item['arrendatario'] ?? '').trim(),
        imagenFachada: urlFachadaDesdeArchivos(item),
      });
    }
  }

  return map;
}

function contratoVigenteEnInmueble(
  item: Record<string, unknown>,
  idInmueble: number,
): Record<string, unknown> | null {
  const contratos = item['contratos'];
  if (!Array.isArray(contratos) || !contratos.length) return null;

  let mejor: Record<string, unknown> | null = null;
  let mejorFh = '';

  for (const raw of contratos) {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const c = raw as Record<string, unknown>;
    const idInm = Number(c['idInmueble']);
    if (!Number.isFinite(idInm) || idInm !== idInmueble) continue;
    const fh = fhContrato(c);
    if (!mejor || fh >= mejorFh) {
      mejor = c;
      mejorFh = fh;
    }
  }

  return mejor;
}

function vigenciaTextoContrato(
  inicio: string,
  fin: string,
  tiempoRenta: string,
): string {
  const partes: string[] = [];
  if (inicio && fin) {
    partes.push(`${inicio} | ${fin}`);
  } else if (inicio) {
    partes.push(inicio);
  } else if (fin) {
    partes.push(fin);
  }
  const tr = tiempoRenta.trim();
  if (tr) {
    partes.push(`${tr} ${tr === '1' ? 'año' : 'años'}`);
  }
  return partes.join(' · ');
}

function textoAreaM2(raw: unknown): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${n % 1 === 0 ? n : n.toFixed(2)} m²`;
}

function datosZonaDeLocal(local: Record<string, unknown>): {
  zonaPrincipal: string;
  idZona?: number;
  numeroZona?: number;
} {
  const zonaObj = local['zona'];
  const zonaRec =
    zonaObj != null && typeof zonaObj === 'object' && !Array.isArray(zonaObj)
      ? (zonaObj as Record<string, unknown>)
      : null;
  const zonaPrincipal = String(
    zonaRec?.['zonaPrincipal'] ?? local['zonaPrincipal'] ?? '',
  ).trim();
  const idZona = Number(local['idZona'] ?? zonaRec?.['id']);
  const numeroZona = Number(zonaRec?.['numeroZona']);
  return {
    zonaPrincipal,
    idZona: Number.isFinite(idZona) ? idZona : undefined,
    numeroZona: Number.isFinite(numeroZona) ? numeroZona : undefined,
  };
}

/** 0 = disponible, 1 = ocupado, 2 = resto (apartado, baja, etc.). */
function prioridadOrdenLista(local: Record<string, unknown>): number {
  if (local['ocupado'] === true) return 1;
  const est = Number(local['estatusLocal']);
  if (est === 1) return 0;
  if (est === 2) return 1;
  return 2;
}

function ordenListaUnicaLocales(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  const pa = prioridadOrdenLista(a);
  const pb = prioridadOrdenLista(b);
  if (pa !== pb) return pa - pb;

  const nz = Number(a['numeroZona']) - Number(b['numeroZona']);
  if (Number.isFinite(nz) && nz !== 0) return nz;
  const za = String(a['zonaPrincipal'] ?? '');
  const zb = String(b['zonaPrincipal'] ?? '');
  const cmpZ = za.localeCompare(zb, 'es');
  if (cmpZ !== 0) return cmpZ;
  return String(a['nombre'] ?? '').localeCompare(String(b['nombre'] ?? ''), 'es');
}

function mapFilaLocalLibre(
  local: Record<string, unknown>,
  index: number,
  enLocalesLibres: boolean,
): Record<string, unknown> {
  const idLocal = Number(local['id']);
  const idFinal = Number.isFinite(idLocal) && idLocal > 0 ? idLocal : index + 1;
  const estatusLocalNum =
    local['estatus'] != null ? Number(local['estatus']) : 1;
  const estatusLocalLabel = etiquetaEstatusLocal(estatusLocalNum);
  const { zonaPrincipal, idZona, numeroZona } = datosZonaDeLocal(local);
  const mensualidadFmt = formatearMoneda(local['mensualidad']);
  const giro = String(local['giro'] ?? '').trim();
  const areaM2Texto = textoAreaM2(local['areaM2']);

  return {
    id: idFinal,
    idLocal: idFinal,
    nombre: String(local['nombre'] ?? '').trim() || `Local ${idFinal}`,
    nombreLocal: String(local['nombre'] ?? '').trim() || `Local ${idFinal}`,
    giro,
    areaM2Texto,
    zonaPrincipal,
    idZona,
    numeroZona,
    estatusLocal: estatusLocalNum,
    estatusLocalLabel,
    estatusLabel: estatusLocalLabel,
    estatus: estatusLocalNum,
    ocupado: false,
    disponible: enLocalesLibres || estatusLocalNum === 1,
    estado: 'libre',
    mensualidad: local['mensualidad'],
    mensualidadFmt: mensualidadFmt !== '—' ? mensualidadFmt : '',
    mensualidadMxn: Number(local['mensualidad']),
    rentaFmt: mensualidadFmt !== '—' ? mensualidadFmt : '',
    metrosRentadosTexto: areaM2Texto,
    imagenFachada: urlFachadaLocalApi(local),
    detalleLocal: local,
  };
}

function mapFilaLocalOcupado(
  local: Record<string, unknown>,
  occ: Record<string, unknown>,
  index: number,
  idInmueble: number,
): Record<string, unknown> {
  const idLocal = Number(local['id']);
  const idFinal = Number.isFinite(idLocal) && idLocal > 0 ? idLocal : index + 1;
  const arrendatario = occ['arrendatario'] as Record<string, unknown>;
  const contrato = occ['contrato'] as Record<string, unknown>;
  const nombreArrendatario = String(
    occ['nombreArrendatario'] ?? arrendatario?.['arrendatario'] ?? '',
  ).trim();

  const estatusLocalNum =
    local['estatus'] != null ? Number(local['estatus']) : 2;
  const estatusLocalLabel = etiquetaEstatusLocal(estatusLocalNum);
  const { zonaPrincipal, idZona, numeroZona } = datosZonaDeLocal(local);
  const giro = String(local['giro'] ?? '').trim();

  const fechaInicio = fechaParaInputDate(String(arrendatario?.['fechaInicio'] ?? ''));
  const fechaFin = fechaParaInputDate(String(arrendatario?.['fechaFin'] ?? ''));
  const tiempoRenta = String(arrendatario?.['tiempoRenta'] ?? '').trim();
  const rentaFmt = (() => {
    const r = formatearMoneda(arrendatario?.['renta']);
    return r !== '—' ? r : '';
  })();
  const rentaTotalFmt = (() => {
    const r = formatearMoneda(contrato?.['rentaTotal']);
    return r !== '—' ? r : '';
  })();

  const lat = Number(arrendatario?.['lat']);
  const lng = Number(arrendatario?.['lng']);
  const idContrato = Number(contrato?.['id']);
  const idArrendatario = Number(
    arrendatario?.['id'] ?? arrendatario?.['idArrendatario'],
  );
  const imagenFachada =
    urlFachadaLocalApi(local) ||
    String(occ['imagenFachada'] ?? '').trim() ||
    urlFachadaDesdeArchivos(arrendatario);

  return {
    id: idFinal,
    idLocal: idFinal,
    nombre: String(local['nombre'] ?? '').trim() || `Local ${idFinal}`,
    nombreLocal: String(local['nombre'] ?? '').trim() || `Local ${idFinal}`,
    giro,
    zonaPrincipal,
    idZona,
    numeroZona,
    estatusLocal: estatusLocalNum,
    estatusLocalLabel,
    estatusLabel: estatusLocalLabel,
    estatus: estatusLocalNum,
    ocupado: true,
    disponible: false,
    estado: 'ocupado',
    arrendatario: nombreArrendatario,
    ocupanteNombre: nombreArrendatario,
    nombreEmpresa: nombreArrendatario,
    rentaFmt,
    rentaTotalFmt,
    vigenciaTexto: vigenciaTextoContrato(fechaInicio, fechaFin, tiempoRenta),
    representanteLegal: String(arrendatario?.['representanteLegal'] ?? '').trim(),
    telefonoRepresentante: String(arrendatario?.['telefonoRepresentante'] ?? '').trim(),
    correoRepresentante: String(arrendatario?.['correoRepresentante'] ?? '').trim(),
    metrosRentadosTexto: textoAreaM2(
      contrato?.['metrosRentados'] ?? local['areaM2'],
    ),
    monedaContrato: String(contrato?.['moneda'] ?? '').trim(),
    mensualidadMxn: Number(arrendatario?.['renta'] ?? local['mensualidad']),
    imagenFachada,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    idArrendatario:
      Number.isFinite(idArrendatario) && idArrendatario > 0
        ? idArrendatario
        : undefined,
    idContrato:
      Number.isFinite(idContrato) && idContrato > 0 ? idContrato : undefined,
    detalleLocal: local,
    detalleArrendatario: arrendatario,
    detalleContrato: contrato,
    idInmuebleContexto: idInmueble,
  };
}

function mapFilaOcupadoSinCatalogo(
  item: Record<string, unknown>,
  occ: Record<string, unknown>,
  idInmueble: number,
): Record<string, unknown> {
  const contrato = occ['contrato'] as Record<string, unknown>;
  const localObj =
    contrato?.['local'] != null &&
    typeof contrato['local'] === 'object' &&
    !Array.isArray(contrato['local'])
      ? (contrato['local'] as Record<string, unknown>)
      : { id: contrato?.['idLocal'], nombre: item['arrendatario'] };
  return mapFilaLocalOcupado(localObj, occ, 0, idInmueble);
}

/**
 * Una sola lista: cada local del catálogo una vez, enriquecido con libres y ocupados.
 * Orden: disponibles → ocupados → demás; datos de los 3 servicios.
 */
export function buildMonitoreoLocalesZonasListaUnica(
  localesCatalogo: Record<string, unknown>[],
  localesLibres: Record<string, unknown>[],
  arrendatarios: Record<string, unknown>[],
  idInmueble: number,
): Record<string, unknown>[] {
  const idsLibres = new Set(
    localesLibres
      .map((l) => Number(l['id']))
      .filter((id) => Number.isFinite(id) && id > 0),
  );
  const ocupacion = buildOcupacionPorIdLocal(arrendatarios, idInmueble);
  const filas: Record<string, unknown>[] = [];
  const idsEnLista = new Set<number>();

  for (let index = 0; index < localesCatalogo.length; index++) {
    const local = localesCatalogo[index];
    const idLocal = Number(local['id']);
    const idFinal = Number.isFinite(idLocal) && idLocal > 0 ? idLocal : index + 1;
    idsEnLista.add(idFinal);

    const occ = ocupacion.get(idFinal);
    if (occ) {
      filas.push(mapFilaLocalOcupado(local, occ, index, idInmueble));
    } else {
      filas.push(mapFilaLocalLibre(local, index, idsLibres.has(idFinal)));
    }
  }

  for (const [idLocal, occ] of ocupacion) {
    if (idsEnLista.has(idLocal)) continue;
    const arrendatario = occ['arrendatario'] as Record<string, unknown>;
    filas.push(mapFilaOcupadoSinCatalogo(arrendatario, occ, idInmueble));
  }

  return filas.sort(ordenListaUnicaLocales);
}

export function localMonitoreoTieneInformacion(
  local: Record<string, unknown>,
): boolean {
  return local['ocupado'] === true;
}
