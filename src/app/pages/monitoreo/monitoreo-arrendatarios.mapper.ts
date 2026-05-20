import {
  etiquetaEstatusArrendatarioRegistro,
  etiquetaTipoPersonaArrendatario,
} from '../arrendatarios/arrendatarios-list.mapper';
import { extraerFilasListadoApi } from './monitoreo-clientes.mapper';
import {
  fechaParaInputDate,
  formatearFecha,
  formatearMoneda,
} from '../inmuebles/inmuebles-list.mapper';

/** Filas de GET `/arrendatarios/inmueble/{idInmueble}`. */
export function extraerArrendatariosInmuebleApi(resp: unknown): Record<string, unknown>[] {
  if (resp != null && typeof resp === 'object' && !Array.isArray(resp)) {
    const r = resp as Record<string, unknown>;
    const locales = r['locales'];
    if (Array.isArray(locales)) {
      return locales.filter(
        (x): x is Record<string, unknown> =>
          x != null && typeof x === 'object' && !Array.isArray(x),
      );
    }
  }
  return extraerFilasListadoApi(resp);
}

function primerContrato(item: Record<string, unknown>): Record<string, unknown> | null {
  const contratos = item['contratos'];
  if (!Array.isArray(contratos) || !contratos.length) return null;
  const c0 = contratos[0];
  return c0 != null && typeof c0 === 'object' && !Array.isArray(c0)
    ? (c0 as Record<string, unknown>)
    : null;
}

function urlFachadaArrendatario(item: Record<string, unknown>): string {
  const archivos = item['archivos'];
  if (!Array.isArray(archivos)) return '';
  for (const raw of archivos) {
    if (raw == null || typeof raw !== 'object') continue;
    const a = raw as Record<string, unknown>;
    const nombre = String(a['nombre'] ?? '')
      .trim()
      .toLowerCase();
    const url = String(a['url'] ?? '').trim();
    if (url && (nombre === 'fachada' || nombre.startsWith('fachada'))) {
      return url;
    }
  }
  return '';
}

function vigenciaTextoArrendatario(
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

/** Convierte arrendatarios del inmueble en filas para la lista de locales en monitoreo. */
export function mapArrendatariosInmuebleToLocalesMonitoreo(
  filas: Record<string, unknown>[],
): Record<string, unknown>[] {
  return filas.map((item, index) => mapArrendatarioInmuebleToLocalMonitoreo(item, index));
}

export function mapArrendatarioInmuebleToLocalMonitoreo(
  item: Record<string, unknown>,
  index: number,
): Record<string, unknown> {
  const contrato = primerContrato(item);
  const idArr = Number(item['id'] ?? item['idArrendatario']);
  const idFinal = Number.isFinite(idArr) && idArr > 0 ? idArr : index + 1;

  const nombreArrendatario = String(item['arrendatario'] ?? '').trim() || 'Arrendatario';
  const estatusNum =
    item['estatus'] != null ? Number(item['estatus']) : null;
  const estatusLabel = etiquetaEstatusArrendatarioRegistro(estatusNum);

  const fechaInicio = fechaParaInputDate(String(item['fechaInicio'] ?? ''));
  const fechaFin = fechaParaInputDate(String(item['fechaFin'] ?? ''));
  const tiempoRenta = String(item['tiempoRenta'] ?? '').trim();

  const rentaFmt = formatearMoneda(item['renta']);
  const rentaTotalFmt = formatearMoneda(contrato?.['rentaTotal']);
  const metrosRaw = contrato?.['metrosRentados'] ?? item['metrosRentados'];
  const metros = Number(metrosRaw);
  const metrosRentadosTexto =
    Number.isFinite(metros) && metros > 0
      ? `${metros % 1 === 0 ? metros : metros.toFixed(2)} m²`
      : '';

  const representanteLegal = String(item['representanteLegal'] ?? '').trim();
  const telefonoRepresentante = String(item['telefonoRepresentante'] ?? '').trim();
  const correoRepresentante = String(item['correoRepresentante'] ?? '').trim();

  const lat = Number(item['lat']);
  const lng = Number(item['lng']);

  return {
    id: idFinal,
    idLocal: idFinal,
    idArrendatario: idFinal,
    nombre: nombreArrendatario,
    nombreLocal: nombreArrendatario,
    arrendatario: nombreArrendatario,
    imagenFachada: urlFachadaArrendatario(item),
    estatus: estatusNum,
    estatusLabel,
    estado: estatusNum === 0 ? 'inactivo' : 'ocupado',
    tipoPersonaLabel: etiquetaTipoPersonaArrendatario(item['tipoPersona']),
    rentaFmt: rentaFmt !== '—' ? rentaFmt : '',
    rentaTotalFmt: rentaTotalFmt !== '—' ? rentaTotalFmt : '',
    mensualidadMxn: Number(item['renta']),
    vigenciaTexto: vigenciaTextoArrendatario(fechaInicio, fechaFin, tiempoRenta),
    fechaInicio,
    fechaFin,
    tiempoRenta,
    representanteLegal,
    telefonoRepresentante,
    correoRepresentante,
    metrosRentadosTexto,
    monedaContrato: String(contrato?.['moneda'] ?? '').trim(),
    representanteNombre: representanteLegal,
    ocupanteNombre: nombreArrendatario,
    nombreEmpresa: nombreArrendatario,
    vigenciaHasta: fechaFin || undefined,
    fechaFinContrato: fechaFin || undefined,
    superficieM2: Number.isFinite(metros) ? metros : undefined,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    detalleArrendatario: item,
  };
}
