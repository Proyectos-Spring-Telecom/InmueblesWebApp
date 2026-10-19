import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';
import { contractDimAnim, contractModalAnim } from 'src/app/pipe/module-open.animation';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { CatMetodosPagoService } from 'src/app/services/moduleService/cat-metodos-pago.service';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import { RentaActualService } from 'src/app/services/moduleService/renta-actual.service';
import { nombreArrendatarioDesdeApi } from '../../arrendatarios-list.mapper';
import {
  centavos,
  CobranzaService,
  Pago,
} from 'src/app/services/moduleService/cobranza.service';
import { AplicacionesEditorComponent } from '../aplicaciones-editor/aplicaciones-editor.component';
import {
  alertaError,
  alertaExito,
  alertaValidacion,
  aplicacionesPayload,
  ConceptoAplicable,
  conceptosAplicables,
  fmtMoneda,
  hoyIso,
  sumaAplicaciones,
  validarAplicaciones,
} from '../cobranza-ui';

export interface MetodoPagoOpcion {
  id: number;
  nombre: string;
}

const TIPOS_COMPROBANTE = ['image/png', 'image/jpeg', 'application/pdf'];
const MAX_COMPROBANTE_BYTES = 10 * 1024 * 1024;

/** Mapea el listado de `/cat-metodos-pago/paginated` a opciones activas. */
export function extraerMetodosPago(resp: unknown): MetodoPagoOpcion[] {
  const r = resp as { data?: unknown } | unknown[] | null;
  const filas = Array.isArray(r) ? r : Array.isArray((r as { data?: unknown })?.data) ? ((r as { data: unknown[] }).data) : [];
  return filas
    .map((x) => x as { id?: unknown; nombre?: unknown; estatus?: unknown })
    .filter((x) => Number(x.id) > 0 && (x.estatus == null || Number(x.estatus) === 1))
    .map((x) => ({ id: Number(x.id), nombre: String(x.nombre ?? `Método ${x.id}`) }));
}

/** Opciones del select de arrendatarios (GET /arrendatarios/listado). */
function mapArrendatarios(resp: unknown): { id: number; nombre: string }[] {
  const r = resp as { data?: unknown } | unknown[] | null;
  const filas = Array.isArray(r) ? r : Array.isArray((r as { data?: unknown })?.data) ? (r as { data: unknown[] }).data : [];
  return filas
    .map((x) => x as Record<string, unknown>)
    .map((x) => ({ id: Number(x['id']), nombre: nombreArrendatarioDesdeApi(x) || 'Arrendatario #' + x['id'] }))
    .filter((x) => x.id > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * Registrar pago: monto, fecha real, método, referencia y comprobante, repartido entre conceptos con saldo.
 * Lo que no se aplica queda como saldo a favor.
 */
@Component({
  selector: 'app-registrar-pago-modal',
  standalone: true,
  imports: [CommonModule, CampoFechaComponent, CampoSelectComponent, FormsModule, MatIconModule, MatProgressSpinnerModule, AplicacionesEditorComponent],
  templateUrl: './registrar-pago-modal.component.html',
  styleUrls: ['../cobranza.scss'],
  animations: [contractDimAnim, contractModalAnim],
})
export class RegistrarPagoModalComponent implements OnInit {
  /** Si no se indica, el usuario elige el arrendatario en el modal (abierto desde la barra). */
  @Input() idArrendatario: number | null = null;
  @Input() nombreArrendatario = '';
  /** Si se indica, muestra primero los conceptos de ese cargo (sin llenar montos). */
  @Input() idCargoPreseleccionado: number | null = null;
  @Output() cerrar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<Pago>();

  cargando = true;
  guardando = false;
  cargandoConceptos = false;
  metodos: MetodoPagoOpcion[] = [];
  conceptos: ConceptoAplicable[] = [];
  /** Sólo cuando el modal se abre sin arrendatario. */
  elegirArrendatario = false;
  arrendatarios: { id: number; nombre: string }[] = [];

  monto: number | null = null;
  fechaPago = hoyIso();
  idMetodoPago: number | null = null;
  referencia = '';
  comprobante: File | null = null;
  montos: Record<number, number | null> = {};

  readonly fmtMoneda = fmtMoneda;

  /** Clic fuera del modal: cierra salvo que haya una operación en curso. */
  cerrarSiLibre(): void {
    if (!this.guardando) this.cerrar.emit();
  }

  /** El usuario decide si la renta queda marcada como pagada (por defecto no). */
  marcarPagada = false;
  readonly opcionesPagada = [
    { id: false, nombre: 'No, queda con su saldo pendiente' },
    { id: true, nombre: 'Sí, marcar como pagada' },
  ];

  constructor(
    private rentaActual: RentaActualService,
    private cobranza: CobranzaService,
    private metodosService: CatMetodosPagoService,
    private arrendatariosService: ArrendatariosService,
  ) {}

  ngOnInit(): void {
    this.elegirArrendatario = this.idArrendatario == null;
    forkJoin({
      metodos: this.metodosService.obtenerMetodosPagoPaginados(1, 100).pipe(catchError(() => of(null))),
      arrendatarios: this.elegirArrendatario
        ? this.arrendatariosService.obtenerArrendatariosListado().pipe(catchError(() => of(null)))
        : of(null),
    })
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe(({ metodos, arrendatarios }) => {
        this.metodos = extraerMetodosPago(metodos);
        if (this.elegirArrendatario) this.arrendatarios = mapArrendatarios(arrendatarios);
        else this.cargarConceptos();
      });
  }

  get tituloArrendatario(): string {
    if (this.nombreArrendatario) return this.nombreArrendatario;
    const elegido = this.arrendatarios.find((a) => a.id === this.idArrendatario);
    return elegido?.nombre ?? (this.idArrendatario ? 'Arrendatario #' + this.idArrendatario : 'Elige el arrendatario');
  }

  onArrendatarioChange(): void {
    this.montos = {};
    this.monto = null;
    this.conceptos = [];
    if (this.idArrendatario) this.cargarConceptos();
  }

  private cargarConceptos(): void {
    if (!this.idArrendatario) return;
    this.cargandoConceptos = true;
    this.cobranza
      .obtenerCargos({ idArrendatario: this.idArrendatario, estado: 'CON_SALDO', page: 1, limit: 500 })
      .pipe(
        catchError((err) => {
          alertaError('No se pudieron cargar los cargos', err, 'Intenta de nuevo.');
          return of({ data: [] });
        }),
        finalize(() => (this.cargandoConceptos = false)),
      )
      .subscribe((cargos) => {
        this.conceptos = conceptosAplicables(cargos.data);
        if (this.idCargoPreseleccionado != null) this.prellenarCargo(this.idCargoPreseleccionado);
      });
  }

  /** Pone primero los conceptos del cargo elegido. No llena montos: el usuario decide cuánto pagó (o usa "Saldar"). */
  private prellenarCargo(idCargo: number): void {
    const delCargo = this.conceptos.filter((c) => c.idCargo === idCargo);
    if (!delCargo.length) return;
    this.conceptos = [...delCargo, ...this.conceptos.filter((c) => c.idCargo !== idCargo)];
  }

  get porAplicar(): number {
    return sumaAplicaciones(this.montos);
  }

  get quedaraAFavor(): number {
    return centavos((Number(this.monto) || 0) - this.porAplicar);
  }

  onComprobante(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file && !TIPOS_COMPROBANTE.includes(file.type)) {
      alertaValidacion(['El comprobante debe ser PNG, JPG o PDF.']);
      input.value = '';
      return;
    }
    if (file && file.size > MAX_COMPROBANTE_BYTES) {
      alertaValidacion(['El comprobante no debe pesar más de 10 MB.']);
      input.value = '';
      return;
    }
    this.comprobante = file;
  }

  guardar(): void {
    const monto = centavos(Number(this.monto) || 0);
    const errores: string[] = [];
    if (!this.idArrendatario) errores.push('Selecciona el arrendatario.');
    if (monto <= 0) errores.push('Captura un monto mayor a 0.');
    if (!this.fechaPago) errores.push('Captura la fecha de pago.');
    if (!this.idMetodoPago) errores.push('Selecciona el método de pago.');
    errores.push(...validarAplicaciones(this.conceptos, this.montos, monto, 'el monto del pago'));
    const quiereMarcar = this.hayRentas && this.marcarPagada;
    const rentasElegidas = quiereMarcar ? this.rentasConMonto() : [];
    const rentasAMarcar = this.rentasQueQuedanConSaldo(rentasElegidas);
    if (quiereMarcar && !rentasElegidas.length) {
      errores.push('Elegiste marcar la renta como pagada, pero no escribiste monto en «Aplicar» de la renta. Escribe el monto o cambia la opción a «No».');
    }
    if (errores.length) {
      alertaValidacion(errores);
      return;
    }

    this.guardando = true;
    this.cobranza
      .registrarPago(
        {
          idArrendatario: Number(this.idArrendatario),
          fechaPago: this.fechaPago,
          monto,
          idMetodoPago: Number(this.idMetodoPago),
          referencia: this.referencia.trim() || undefined,
          aplicaciones: aplicacionesPayload(this.montos),
        },
        this.comprobante,
      )
      .pipe(finalize(() => (this.guardando = false)))
      .subscribe({
        next: (pago) => {
          const aFavor = centavos(Number(pago?.disponible ?? this.quedaraAFavor));
          const favorHtml =
            aFavor > 0 ? ` Quedaron <strong>${fmtMoneda(aFavor)}</strong> como saldo a favor.` : '';
          if (!rentasAMarcar.length) {
            const yaPagada = rentasElegidas.length ? ' La renta quedó pagada.' : '';
            alertaExito(`El pago se registró correctamente.${yaPagada}${favorHtml}`);
            this.guardado.emit(pago);
            return;
          }
          // Solo si el usuario eligió "Sí": se marca la renta como pagada después de registrar el pago.
          this.guardando = true;
          forkJoin(rentasAMarcar.map((id) => this.rentaActual.marcarComoPagada(id)))
            .pipe(finalize(() => (this.guardando = false)))
            .subscribe({
              next: () => {
                alertaExito(
                  `El pago se registró y la renta quedó marcada como pagada.${favorHtml}`,
                );
                this.guardado.emit(pago);
              },
              error: (err) => {
                alertaError('El pago se registró, pero no se pudo marcar la renta como pagada', err, 'Puedes marcarla desde Acciones → Marcar como pagada.');
                this.guardado.emit(pago);
              },
            });
        },
        error: (err) => alertaError('No se pudo registrar el pago', err, 'Intenta de nuevo.'),
      });
  }

  /** El monto aplicado liquida por completo las rentas a las que se aplica (no hace falta marcarlas). */
  get liquidaRentas(): boolean {
    const ids = this.rentasConMonto();
    return ids.length > 0 && this.rentasQueQuedanConSaldo(ids).length === 0;
  }

  /** Solo las rentas se pueden marcar como pagadas (los servicios no). */
  get hayRentas(): boolean {
    return this.conceptos.some((c) => (c.clase ?? 'RENTA') === 'RENTA');
  }

  /** Cargos de renta a los que se les está aplicando monto en este pago. */
  private rentasConMonto(): number[] {
    const ids = this.conceptos
      .filter((c) => (c.clase ?? 'RENTA') === 'RENTA' && (Number(this.montos[c.idCargoConcepto]) || 0) > 0)
      .map((c) => c.idCargo);
    return [...new Set(ids)];
  }

  /** Rentas que aún deberán algo tras este pago (las que quedan en 0 ya quedan pagadas solas). */
  private rentasQueQuedanConSaldo(ids: number[]): number[] {
    return ids.filter((id) => {
      const delCargo = this.conceptos.filter((c) => c.idCargo === id);
      const saldo = delCargo.reduce((t, c) => t + c.saldo, 0);
      const aplicado = delCargo.reduce((t, c) => t + (Number(this.montos[c.idCargoConcepto]) || 0), 0);
      return centavos(saldo - aplicado) > 0;
    });
  }
}
