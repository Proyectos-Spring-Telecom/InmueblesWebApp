import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Estado calculado de un cargo (no se captura). */
export type EstadoPagoCargo = 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'CANCELADO';
/** Filtro de estado en `GET /cargos` (`CON_SALDO` = pendientes + parciales). */
export type EstadoFiltroCargo = EstadoPagoCargo | 'CON_SALDO';
export type ClaseCargo = 'RENTA' | 'SERVICIO' | 'OTRO';
export type TipoConcepto = 'RENTA' | 'MANTENIMIENTO' | 'SERVICIO';
export type EstatusPago = 'CONFIRMADO' | 'POR_CONFIRMAR' | 'CANCELADO' | string;
export type OrigenPago = 'CAPTURA' | 'MIGRACION' | 'LEGACY' | 'HISTORICO' | string;

/** Los montos llegan como texto con 2 decimales (`"6000.00"`). */
export interface CargoConcepto {
  id: number;
  tipo: TipoConcepto;
  descripcion: string | null;
  idTipoServicio: number | null;
  tipoServicio: string | null;
  idServicioArrendatario: number | null;
  total: string;
  subtotal: string;
  iva: string;
  tasaIva: number;
  desgloseEstimado: boolean;
  pagado: string;
  saldo: string;
}

export interface PagoResumen {
  id: number;
  fechaPago: string;
  monto: string;
  metodoPago: string | null;
  formaPagoSat: string | null;
  referencia: string | null;
  estatus: EstatusPago;
}

export interface CargoAplicacion {
  id: number;
  idCargoConcepto: number;
  monto: string;
  vigente: boolean;
  fhRegistro: string;
  fhAnulacion: string | null;
  pago: PagoResumen;
}

export interface Cargo {
  id: number;
  clase: ClaseCargo;
  idArrendatario: number;
  arrendatario: string;
  idContrato: number | null;
  idInmueble: number | null;
  inmueble: string | null;
  mes: string;
  fechaFin: string | null;
  descripcion: string | null;
  total: string;
  pagado: string;
  saldo: string;
  estadoPago: EstadoPagoCargo;
  origen: string | null;
  fhRegistro: string;
  conceptos: CargoConcepto[];
  aplicaciones?: CargoAplicacion[];
}

export interface PagoAplicacion {
  id: number;
  monto: string;
  vigente: boolean;
  fhRegistro: string;
  fhAnulacion: string | null;
  concepto: { id: number; tipo: TipoConcepto; descripcion: string | null };
  cargo: { id: number; clase: ClaseCargo; mes: string; descripcion: string | null };
}

export interface Pago {
  id: number;
  idArrendatario: number;
  arrendatario: string;
  fechaPago: string;
  monto: string;
  aplicado: string;
  disponible: string;
  idMetodoPago: number | null;
  metodoPago: string | null;
  formaPagoSat: string | null;
  referencia: string | null;
  concepto: string | null;
  comprobanteUrl: string | null;
  origen: OrigenPago;
  estatus: EstatusPago;
  fhRegistro: string;
  motivoCancelacion: string | null;
  fhCancelacion: string | null;
  aplicaciones?: PagoAplicacion[];
}

export interface EstadoCuenta {
  arrendatario: { id: number; nombre: string; rfc: string | null; activo: boolean };
  resumen: {
    saldoTotal: string;
    saldoVencido: string;
    saldoDelPeriodoActual: string;
    cargosConSaldo: number;
    saldoAFavor: string;
  };
  cargos: Cargo[];
  pagos: Pago[];
}

export interface CargosFiltros {
  idArrendatario?: number | null;
  idContrato?: number | null;
  clase?: ClaseCargo | null;
  estado?: EstadoFiltroCargo | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  page?: number;
  limit?: number;
}

export interface PagosFiltros {
  idArrendatario?: number | null;
  /** 1 confirmado, 2 por confirmar, 0 cancelado. */
  estatus?: 0 | 1 | 2 | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  conDisponible?: boolean;
  page?: number;
  limit?: number;
}

export interface AplicacionPayload {
  idCargoConcepto: number;
  monto: number;
}

export interface RegistrarPagoPayload {
  idArrendatario: number;
  /** `YYYY-MM-DD`, puede ser retroactiva. */
  fechaPago: string;
  monto: number;
  idMetodoPago: number;
  referencia?: string;
  concepto?: string;
  formaPagoSat?: string;
  /** Sin aplicaciones, todo el monto queda como saldo a favor. */
  aplicaciones?: AplicacionPayload[];
}

export interface RegistrarCargoPayload {
  idArrendatario: number;
  idContrato?: number | null;
  clase: Exclude<ClaseCargo, 'RENTA'>;
  /** `YYYY-MM-DD`. */
  fecha: string;
  descripcion?: string;
  conceptos: {
    idTipoServicio?: number | null;
    idServicioArrendatario?: number | null;
    descripcion?: string;
    total: number;
    subtotal?: number;
    iva?: number;
  }[];
}

export interface ListadoPaginado<T> {
  data: T[];
  paginated?: { total: number; page: number; lastPage: number };
}

/**
 * Cobranza: cargos (lo que se debe), pagos (lo que entra) y sus aplicaciones.
 * Swagger: secciones "Cobranza: cargos", "Cobranza: pagos" y "Cobranza: estado de cuenta".
 */
@Injectable({ providedIn: 'root' })
export class CobranzaService {
  private readonly api = environment.API_SECURITY;

  constructor(private http: HttpClient) {}

  // ── Estado de cuenta ──────────────────────────────────────────────

  obtenerEstadoCuenta(
    idArrendatario: number,
    fechaInicio?: string | null,
    fechaFin?: string | null,
  ): Observable<EstadoCuenta> {
    let params = new HttpParams();
    if (fechaInicio) params = params.set('fechaInicio', fechaInicio);
    if (fechaFin) params = params.set('fechaFin', fechaFin);
    return this.http
      .get<unknown>(`${this.api}/arrendatarios/${idArrendatario}/estado-cuenta`, { params })
      .pipe(map((r) => desenvolver<EstadoCuenta>(r)));
  }

  // ── Cargos ────────────────────────────────────────────────────────

  obtenerCargos(filtros: CargosFiltros): Observable<ListadoPaginado<Cargo>> {
    return this.http
      .get<unknown>(`${this.api}/cargos`, { params: aParams(filtros) })
      .pipe(map((r) => listado<Cargo>(r)));
  }

  obtenerCargo(id: number): Observable<Cargo> {
    return this.http.get<unknown>(`${this.api}/cargos/${id}`).pipe(map((r) => desenvolver<Cargo>(r)));
  }

  registrarCargo(payload: RegistrarCargoPayload): Observable<Cargo> {
    return this.http.post<unknown>(`${this.api}/cargos`, payload).pipe(map((r) => desenvolver<Cargo>(r)));
  }

  /** Sólo si el cargo no tiene pagos aplicados; si los tiene responde 409. */
  cancelarCargo(id: number, motivo: string): Observable<unknown> {
    return this.http.patch(`${this.api}/cargos/${id}/cancelar`, { motivo });
  }

  // ── Pagos ─────────────────────────────────────────────────────────

  /** JSON, o multipart si se adjunta comprobante (PNG, JPG o PDF; máx. 10 MB). */
  registrarPago(payload: RegistrarPagoPayload, comprobante?: File | null): Observable<Pago> {
    let body: RegistrarPagoPayload | FormData = payload;
    if (comprobante) {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v == null || v === '') return;
        fd.append(k, k === 'aplicaciones' ? JSON.stringify(v) : String(v));
      });
      fd.append('comprobante', comprobante);
      body = fd;
    }
    return this.http.post<unknown>(`${this.api}/pagos`, body).pipe(map((r) => desenvolver<Pago>(r)));
  }

  obtenerPagos(filtros: PagosFiltros): Observable<ListadoPaginado<Pago>> {
    return this.http
      .get<unknown>(`${this.api}/pagos`, { params: aParams(filtros) })
      .pipe(map((r) => listado<Pago>(r)));
  }

  obtenerPago(id: number): Observable<Pago> {
    return this.http.get<unknown>(`${this.api}/pagos/${id}`).pipe(map((r) => desenvolver<Pago>(r)));
  }

  /** Aplica el disponible (saldo a favor) de un pago a uno o varios conceptos. */
  aplicarPago(idPago: number, aplicaciones: AplicacionPayload[]): Observable<Pago> {
    return this.http
      .post<unknown>(`${this.api}/pagos/${idPago}/aplicaciones`, { aplicaciones })
      .pipe(map((r) => desenvolver<Pago>(r)));
  }

  /** Anula una aplicación; el monto regresa al disponible del pago. */
  anularAplicacion(idPago: number, idAplicacion: number): Observable<unknown> {
    return this.http.delete(`${this.api}/pagos/${idPago}/aplicaciones/${idAplicacion}`);
  }

  /** Cancela el pago, anula sus aplicaciones y los cargos recuperan su saldo. */
  cancelarPago(idPago: number, motivo: string): Observable<unknown> {
    return this.http.patch(`${this.api}/pagos/${idPago}/cancelar`, { motivo });
  }
}

function aParams(filtros: object): HttpParams {
  let params = new HttpParams();
  Object.entries(filtros).forEach(([k, v]) => {
    if (v == null || v === '') return;
    params = params.set(k, String(v));
  });
  return params;
}

/** Algunas respuestas vienen como `{ status, message, data }`. */
function desenvolver<T>(resp: unknown): T {
  if (resp != null && typeof resp === 'object' && 'data' in resp && !Array.isArray(resp)) {
    const r = resp as { data: unknown; status?: unknown };
    if (r.status !== undefined || (r.data != null && typeof r.data === 'object' && !Array.isArray(r.data))) {
      return r.data as T;
    }
  }
  return resp as T;
}

function listado<T>(resp: unknown): ListadoPaginado<T> {
  if (Array.isArray(resp)) return { data: resp as T[] };
  const r = (resp ?? {}) as { data?: unknown; paginated?: ListadoPaginado<T>['paginated'] };
  if (Array.isArray(r.data)) return { data: r.data as T[], paginated: r.paginated };
  const anidado = r.data as { data?: unknown; paginated?: ListadoPaginado<T>['paginated'] } | undefined;
  if (anidado && Array.isArray(anidado.data)) return { data: anidado.data as T[], paginated: anidado.paginated };
  return { data: [] };
}

/** Montos de la API (`"6000.00"`) a número. */
export function montoNum(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/** Redondeo a centavos para comparar y sumar montos. */
export function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}
