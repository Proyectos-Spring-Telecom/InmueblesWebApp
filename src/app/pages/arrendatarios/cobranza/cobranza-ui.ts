import Swal from 'sweetalert2';
import { formatMonedaDesdeNumero } from 'src/app/shared/valor-miles-format';
import {
  Cargo,
  CargoConcepto,
  centavos,
  montoNum,
} from 'src/app/services/moduleService/cobranza.service';

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Monto de la API (`"6000.00"`) o número → `$6,000.00`. */
export function fmtMoneda(valor: unknown): string {
  return formatMonedaDesdeNumero(montoNum(valor));
}

/**
 * Fecha de la API (hora de México con sufijo `Z`) → `dd/mm/aaaa`, sin convertir de zona.
 */
export function fmtFecha(iso: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? '').trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

/** `2026-08-01T00:00:00.000Z` → `ago 2026`. */
export function fmtMes(iso: unknown): string {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? '').trim());
  if (!m) return '—';
  return `${MESES_CORTOS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** Periodo de un cargo: mes, o rango `mes → fechaFin`. */
export function fmtPeriodoCargo(cargo: Pick<Cargo, 'mes' | 'fechaFin'>): string {
  const inicio = fmtMes(cargo.mes);
  if (!cargo.fechaFin) return inicio;
  const fin = fmtMes(cargo.fechaFin);
  return fin !== inicio ? `${inicio} → ${fin}` : inicio;
}

/** Fecha de hoy `YYYY-MM-DD` (calendario local del navegador). */
export function hoyIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Parcial',
  PAGADO: 'Pagado',
  CANCELADO: 'Cancelado',
  CONFIRMADO: 'Confirmado',
  POR_CONFIRMAR: 'Por confirmar',
};

export function etiquetaEstado(estado: unknown): string {
  const k = String(estado ?? '').toUpperCase();
  return ETIQUETA_ESTADO[k] ?? (k ? k.charAt(0) + k.slice(1).toLowerCase() : '—');
}

/** Chip global `mono-pago-estatus`: PENDIENTE gris, PARCIAL ámbar, PAGADO verde, CANCELADO rojo. */
export function claseEstado(estado: unknown): string {
  switch (String(estado ?? '').toUpperCase()) {
    case 'PAGADO':
    case 'CONFIRMADO':
      return 'mono-pago-estatus mono-pago-estatus--pagado';
    case 'PARCIAL':
      return 'mono-pago-estatus mono-pago-estatus--parcial';
    case 'POR_CONFIRMAR':
      return 'mono-pago-estatus mono-pago-estatus--pendiente';
    case 'CANCELADO':
      return 'mono-pago-estatus mono-pago-estatus--cancelado';
    default:
      return 'mono-pago-estatus mono-pago-estatus--sin-pago';
  }
}

const ETIQUETA_TIPO_CONCEPTO: Record<string, string> = {
  RENTA: 'Renta',
  MANTENIMIENTO: 'Mantenimiento',
  SERVICIO: 'Servicio',
};

export function etiquetaConcepto(c: Pick<CargoConcepto, 'tipo' | 'tipoServicio' | 'descripcion'>): string {
  if (c.tipo === 'SERVICIO') return c.tipoServicio || c.descripcion || 'Servicio';
  return ETIQUETA_TIPO_CONCEPTO[c.tipo] ?? c.tipo;
}

const ETIQUETA_CLASE: Record<string, string> = { RENTA: 'Renta', SERVICIO: 'Servicio', OTRO: 'Otro' };

export function etiquetaClase(clase: unknown): string {
  return ETIQUETA_CLASE[String(clase ?? '').toUpperCase()] ?? String(clase ?? '—');
}

/** Línea a la que se puede aplicar dinero: un concepto con saldo de un cargo. */
export interface ConceptoAplicable {
  idCargo: number;
  /** Clase del cargo (RENTA / SERVICIO / OTRO). */
  clase?: string;
  idCargoConcepto: number;
  periodo: string;
  concepto: string;
  inmueble: string;
  saldo: number;
}

/** Aplana los cargos con saldo en conceptos aplicables, del más antiguo al más reciente. */
export function conceptosAplicables(cargos: Cargo[]): ConceptoAplicable[] {
  return [...cargos]
    .filter((c) => c.estadoPago !== 'CANCELADO')
    .sort((a, b) => String(a.mes).localeCompare(String(b.mes)))
    .flatMap((cargo) =>
      (cargo.conceptos ?? [])
        .filter((k) => montoNum(k.saldo) > 0)
        .map((k) => ({
          idCargo: cargo.id,
          clase: cargo.clase,
          idCargoConcepto: k.id,
          periodo: fmtPeriodoCargo(cargo),
          concepto: etiquetaConcepto(k) + (cargo.descripcion ? ` · ${cargo.descripcion}` : ''),
          inmueble: cargo.inmueble ?? '',
          saldo: montoNum(k.saldo),
        })),
    );
}

/** Suma de los montos capturados por concepto. */
export function sumaAplicaciones(montos: Record<number, number | null>): number {
  return centavos(
    Object.values(montos).reduce<number>((acc, v) => acc + (Number.isFinite(Number(v)) ? Number(v) : 0), 0),
  );
}

/** Errores locales de las aplicaciones (el servidor también los valida). */
export function validarAplicaciones(
  conceptos: ConceptoAplicable[],
  montos: Record<number, number | null>,
  limite: number,
  etiquetaLimite: string,
): string[] {
  const errores: string[] = [];
  for (const c of conceptos) {
    const v = Number(montos[c.idCargoConcepto] ?? 0);
    if (!Number.isFinite(v) || v < 0) errores.push(`Monto inválido en ${c.concepto} (${c.periodo}).`);
    else if (centavos(v) > centavos(c.saldo)) {
      errores.push(`${c.concepto} (${c.periodo}): ${fmtMoneda(v)} excede su saldo de ${fmtMoneda(c.saldo)}.`);
    }
  }
  const suma = sumaAplicaciones(montos);
  if (suma > centavos(limite)) {
    errores.push(`Las aplicaciones (${fmtMoneda(suma)}) exceden ${etiquetaLimite} (${fmtMoneda(limite)}).`);
  }
  return errores;
}

export function aplicacionesPayload(montos: Record<number, number | null>) {
  return Object.entries(montos)
    .map(([id, v]) => ({ idCargoConcepto: Number(id), monto: centavos(Number(v) || 0) }))
    .filter((a) => a.monto > 0);
}

/** Mensaje de un error HTTP (la API puede devolver un arreglo de validaciones). */
export function mensajeErrorCobranza(err: unknown, fallback: string): string {
  const e = err as { status?: number; error?: unknown } | null;
  if (e?.status === 404) return 'Registro no encontrado. Es posible que no exista o que no pertenezca a tu cliente.';
  let cuerpo: unknown = e?.error;
  // Endpoints con responseType 'text' entregan el error como string (a veces JSON).
  if (typeof cuerpo === 'string') {
    const texto = cuerpo.trim();
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      return texto && texto.length < 300 && !texto.startsWith('<') ? texto : fallback;
    }
  }
  const raw = (cuerpo as { message?: unknown } | null)?.message;
  if (Array.isArray(raw)) return raw.map(String).join('\n');
  // Nunca mostrar el mensaje técnico de Angular ("Http failure response for …").
  return typeof raw === 'string' && raw.trim() ? raw : fallback;
}

const SWAL_BASE = {
  background: '#141a21',
  color: '#ffffff',
  confirmButtonColor: '#3085d6',
};

export function alertaError(titulo: string, err: unknown, fallback: string): void {
  void Swal.fire({ ...SWAL_BASE, icon: 'error', title: titulo, text: mensajeErrorCobranza(err, fallback) });
}

export function alertaValidacion(errores: string[]): void {
  void Swal.fire({
    ...SWAL_BASE,
    icon: 'warning',
    title: 'Revisa la captura',
    html: errores.map((e) => `<div style="text-align:left">• ${escaparHtml(e)}</div>`).join(''),
  });
}

/** Éxito de servicio OK: título fijo + descripción en html. */
export function alertaExito(descripcionHtml: string): void {
  void Swal.fire({
    ...SWAL_BASE,
    icon: 'success',
    title: '¡Operación Exitosa!',
    html: descripcionHtml,
    timer: 2200,
    showConfirmButton: false,
  });
}

/** Confirmación con motivo obligatorio. Devuelve el motivo o `null` si se canceló. */
export async function pedirMotivo(titulo: string, html: string, confirmar: string): Promise<string | null> {
  const r = await Swal.fire({
    ...SWAL_BASE,
    icon: 'warning',
    title: titulo,
    html,
    input: 'textarea',
    inputPlaceholder: 'Motivo (obligatorio)',
    showCancelButton: true,
    confirmButtonText: confirmar,
    cancelButtonText: 'Regresar',
    confirmButtonColor: '#d33',
    inputValidator: (v) => (String(v ?? '').trim() ? null : 'El motivo es obligatorio.'),
  });
  return r.isConfirmed ? String(r.value).trim() : null;
}

export async function confirmar(titulo: string, html: string, boton: string): Promise<boolean> {
  const r = await Swal.fire({
    ...SWAL_BASE,
    icon: 'question',
    title: titulo,
    html,
    showCancelButton: true,
    confirmButtonText: boton,
    cancelButtonText: 'Regresar',
  });
  return r.isConfirmed;
}

export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}
