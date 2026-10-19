import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CampoFechaComponent } from 'src/app/shared/campos-dx/campo-fecha.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, finalize, lastValueFrom, of } from 'rxjs';
import { ModuleHeroComponent } from 'src/app/shared/module-hero/module-hero.component';
import {
  Cargo,
  CobranzaService,
  EstadoCuenta,
  montoNum,
  Pago,
} from 'src/app/services/moduleService/cobranza.service';
import { esRegistroNoEncontrado } from 'src/app/shared/http-errores';
import {
  alertaError,
  escaparHtml,
  fmtMes,
  alertaExito,
  pedirMotivo,
  claseEstado,
  etiquetaClase,
  etiquetaConcepto,
  etiquetaEstado,
  fmtFecha,
  fmtMoneda,
  fmtPeriodoCargo,
} from '../cobranza-ui';
import { RegistrarPagoModalComponent } from '../registrar-pago-modal/registrar-pago-modal.component';
import { AplicarSaldoModalComponent } from '../aplicar-saldo-modal/aplicar-saldo-modal.component';
import { DetallePagoModalComponent } from '../detalle-pago-modal/detalle-pago-modal.component';
import { DetalleCargoModalComponent } from '../detalle-cargo-modal/detalle-cargo-modal.component';
import { RegistrarCargoModalComponent } from '../registrar-cargo-modal/registrar-cargo-modal.component';

type Modal =
  | { tipo: 'registrarPago'; idCargo: number | null }
  | { tipo: 'aplicarSaldo'; idPago: number | null }
  | { tipo: 'detallePago'; idPago: number }
  | { tipo: 'detalleCargo'; idCargo: number }
  | { tipo: 'registrarCargo' };

/**
 * Estado de cuenta del arrendatario: saldos, cargos (con conceptos) y pagos (aplicado / disponible).
 * `GET /arrendatarios/:id/estado-cuenta`.
 */
@Component({
  selector: 'app-estado-cuenta',
  standalone: true,
  imports: [
    CommonModule,
    CampoFechaComponent,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ModuleHeroComponent,
    RegistrarPagoModalComponent,
    AplicarSaldoModalComponent,
    DetallePagoModalComponent,
    DetalleCargoModalComponent,
    RegistrarCargoModalComponent,
  ],
  templateUrl: './estado-cuenta.component.html',
  styleUrls: ['../cobranza.scss', './estado-cuenta.component.scss'],
  animations: [routeAnimation],
})
export class EstadoCuentaComponent implements OnInit {
  idArrendatario = 0;
  cargando = false;
  estado: EstadoCuenta | null = null;
  fechaInicio = '';
  fechaFin = '';
  modal: Modal | null = null;
  /** Mostrar también los cargos pagados / cancelados del rango. */
  verCargosSaldados = true;
  vista: 'cargos' | 'pagos' = 'cargos';
  procesando = false;
  busqueda = '';

  readonly fmtMoneda = fmtMoneda;
  readonly fmtFecha = fmtFecha;
  readonly fmtPeriodoCargo = fmtPeriodoCargo;
  readonly claseEstado = claseEstado;
  readonly etiquetaEstado = etiquetaEstado;
  readonly etiquetaClase = etiquetaClase;
  readonly etiquetaConcepto = etiquetaConcepto;
  readonly montoNum = montoNum;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cobranza: CobranzaService,
  ) {}

  ngOnInit(): void {
    this.idArrendatario = Number(this.route.snapshot.paramMap.get('idArrendatario'));
    if (!Number.isFinite(this.idArrendatario) || this.idArrendatario <= 0) {
      void this.router.navigateByUrl('/arrendatarios');
      return;
    }
    this.cargar();
  }

  get nombre(): string {
    return this.estado?.arrendatario?.nombre ?? `Arrendatario #${this.idArrendatario}`;
  }

  get cargosVisibles(): Cargo[] {
    const cargos = [...(this.estado?.cargos ?? [])].sort((a, b) => String(b.mes).localeCompare(String(a.mes)));
    return cargos
      .filter((c) => this.verCargosSaldados || (montoNum(c.saldo) > 0 && c.estadoPago !== 'CANCELADO'))
      .filter((c) =>
        this.coincide([
          fmtPeriodoCargo(c),
          this.resumenConceptos(c),
          etiquetaClase(c.clase),
          etiquetaEstado(c.estadoPago),
          c.inmueble,
          c.descripcion,
          c.total,
          c.saldo,
        ]),
      );
  }

  get pagosVisibles(): Pago[] {
    return [...(this.estado?.pagos ?? [])]
      .sort((a, b) => String(b.fechaPago).localeCompare(String(a.fechaPago)))
      .filter((p) =>
        this.coincide([fmtFecha(p.fechaPago), p.monto, p.metodoPago, p.referencia, etiquetaEstado(p.estatus)]),
      );
  }

  private coincide(valores: unknown[]): boolean {
    const q = this.busqueda.trim().toLowerCase();
    if (!q) return true;
    return valores.some((v) => String(v ?? '').toLowerCase().includes(q));
  }

  get haySaldoAFavor(): boolean {
    return montoNum(this.estado?.resumen?.saldoAFavor) > 0;
  }

  /** Cargos que cuentan para el avance (sin cancelados). */
  private get cargosVigentes(): Cargo[] {
    return (this.estado?.cargos ?? []).filter((c) => c.estadoPago !== 'CANCELADO');
  }

  get totalCargado(): number {
    return this.cargosVigentes.reduce((s, c) => s + montoNum(c.total), 0);
  }

  get totalCobrado(): number {
    return this.cargosVigentes.reduce((s, c) => s + montoNum(c.pagado), 0);
  }

  get porcentajeCobrado(): number {
    const total = this.totalCargado;
    if (total <= 0) return 0;
    return Math.min(100, Math.round((this.totalCobrado / total) * 100));
  }

  get pagosVigentes(): number {
    return (this.estado?.pagos ?? []).filter((p) => p.estatus !== 'CANCELADO').length;
  }

  get totalPagos(): number {
    return (this.estado?.pagos ?? [])
      .filter((p) => p.estatus !== 'CANCELADO')
      .reduce((s, p) => s + montoNum(p.monto), 0);
  }

  iniciales(nombre: string | null | undefined): string {
    const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean);
    return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?';
  }

  porcentajeCargo(cargo: Cargo): number {
    const total = montoNum(cargo.total);
    if (total <= 0) return 0;
    return Math.min(100, Math.round((montoNum(cargo.pagado) / total) * 100));
  }

  claseFilaCargo(cargo: Cargo): string {
    switch (String(cargo.estadoPago ?? '').toUpperCase()) {
      case 'PAGADO':
        return 'ec-fila ec-fila--pagado';
      case 'PARCIAL':
        return 'ec-fila ec-fila--parcial';
      case 'CANCELADO':
        return 'ec-fila ec-fila--cancelado ec-fila-cancelada';
      default:
        return 'ec-fila ec-fila--pendiente';
    }
  }

  iconoMetodo(metodo: string | null | undefined): string {
    const m = String(metodo ?? '').toLowerCase();
    if (m.includes('efectivo')) return 'fa-money';
    if (m.includes('tarjeta')) return 'fa-credit-card';
    if (m.includes('cheque')) return 'fa-file-text-o';
    if (m.includes('transfer') || m.includes('spei') || m.includes('dep')) return 'fa-university';
    return 'fa-circle-o';
  }

  puedePagarCargo(cargo: Cargo): boolean {
    return cargo.estadoPago !== 'CANCELADO' && montoNum(cargo.saldo) > 0;
  }

  /** Sólo se cancela un cargo sin pagos aplicados (si no, la API responde 409). */
  puedeCancelarCargo(cargo: Cargo): boolean {
    return cargo.estadoPago !== 'CANCELADO' && montoNum(cargo.pagado) === 0;
  }

  async cancelarCargo(cargo: Cargo): Promise<void> {
    const motivo = await pedirMotivo(
      '¡Cancelar Cargo!',
      `Se cancelará el cargo de <strong>${fmtMoneda(cargo.total)}</strong> (${fmtPeriodoCargo(cargo)}).<br>` +
        'Úsalo solo si se creó por error. Deja de contar como deuda y queda como CANCELADO (no se borra).',
      'Sí, cancelar cargo',
    );
    if (!motivo) return;
    this.procesando = true;
    this.cobranza
      .cancelarCargo(cargo.id, motivo)
      .pipe(finalize(() => (this.procesando = false)))
      .subscribe({
        next: () => {
          alertaExito('El cargo fue cancelado correctamente.');
          this.cargar();
        },
        error: (err) => alertaError('No se pudo cancelar el cargo', err, 'Intenta de nuevo.'),
      });
  }

  async cancelarPago(pago: Pago): Promise<void> {
    // Se consulta el detalle para mostrar qué cargos recuperan su saldo (lo pide la guía de la API).
    this.procesando = true;
    const detalle = await lastValueFrom(this.cobranza.obtenerPago(pago.id).pipe(catchError(() => of(null))));
    this.procesando = false;
    const reabiertos = (detalle?.aplicaciones ?? [])
      .filter((a) => a.vigente)
      .map((a) => {
        const concepto = a.concepto
          ? etiquetaConcepto({ tipo: a.concepto.tipo, tipoServicio: null, descripcion: a.concepto.descripcion })
          : 'Cargo';
        return `<li>${escaparHtml(concepto)} · ${fmtMes(a.cargo?.mes)} · ${fmtMoneda(a.monto)}</li>`;
      })
      .join('');
    const motivo = await pedirMotivo(
      '¡Cancelar Pago!',
      `Se cancelará el pago de <strong>${fmtMoneda(pago.monto)}</strong> del ${fmtFecha(pago.fechaPago)}. ` +
        'El pago no se borra: queda como CANCELADO.' +
        (reabiertos
          ? `<div style="text-align:left;margin-top:.6rem">Estos cargos vuelven a deber:<ul>${reabiertos}</ul></div>`
          : '<br>No estaba aplicado a ningún cargo.'),
      'Sí, cancelar pago',
    );
    if (!motivo) return;
    this.procesando = true;
    this.cobranza
      .cancelarPago(pago.id, motivo)
      .pipe(finalize(() => (this.procesando = false)))
      .subscribe({
        next: () => {
          alertaExito('El pago fue cancelado correctamente.');
          this.cargar();
        },
        error: (err) => alertaError('No se pudo cancelar el pago', err, 'Intenta de nuevo.'),
      });
  }

  resumenConceptos(cargo: Cargo): string {
    return (cargo.conceptos ?? []).map((c) => etiquetaConcepto(c)).join(' + ') || '—';
  }

  tieneIvaEstimado(cargo: Cargo): boolean {
    return (cargo.conceptos ?? []).some((c) => c.desgloseEstimado);
  }

  cargar(): void {
    if (this.fechaInicio && this.fechaFin && this.fechaInicio > this.fechaFin) {
      alertaError('Rango inválido', null, 'La fecha inicial no puede ser mayor a la final.');
      return;
    }
    this.cargando = true;
    this.cobranza
      .obtenerEstadoCuenta(this.idArrendatario, this.fechaInicio || null, this.fechaFin || null)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (e) => (this.estado = e),
        error: (err) => {
          alertaError('No se pudo cargar el estado de cuenta', err, 'Intenta de nuevo.');
          if (esRegistroNoEncontrado(err)) void this.router.navigateByUrl('/arrendatarios');
        },
      });
  }

  limpiarFiltros(): void {
    this.fechaInicio = '';
    this.fechaFin = '';
    this.cargar();
  }

  regresar(): void {
    void this.router.navigateByUrl('/arrendatarios');
  }

  abrir(modal: Modal): void {
    this.modal = modal;
  }

  cerrarModal(): void {
    this.modal = null;
  }

  /** Cierra el modal y refresca saldos. */
  alGuardar(): void {
    this.modal = null;
    this.cargar();
  }

  // Accesores tipados para el template.
  get modalRegistrarPago() {
    return this.modal?.tipo === 'registrarPago' ? this.modal : null;
  }
  get modalAplicarSaldo() {
    return this.modal?.tipo === 'aplicarSaldo' ? this.modal : null;
  }
  get modalDetallePago() {
    return this.modal?.tipo === 'detallePago' ? this.modal : null;
  }
  get modalDetalleCargo() {
    return this.modal?.tipo === 'detalleCargo' ? this.modal : null;
  }
}
