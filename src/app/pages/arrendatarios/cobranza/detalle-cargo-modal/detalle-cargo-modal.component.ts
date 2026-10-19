import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { contractDimAnim, contractModalAnim } from 'src/app/pipe/module-open.animation';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import {
  Cargo,
  CargoAplicacion,
  CobranzaService,
  montoNum,
} from 'src/app/services/moduleService/cobranza.service';
import {
  alertaError,
  alertaExito,
  claseEstado,
  etiquetaClase,
  etiquetaConcepto,
  etiquetaEstado,
  fmtFecha,
  fmtMoneda,
  fmtPeriodoCargo,
  pedirMotivo,
} from '../cobranza-ui';
import { formatearFechaHoraUtc } from '../../../inmuebles/inmuebles-list.mapper';

/** Detalle de cargo: conceptos con desglose de IVA e historial de aplicaciones (anuladas en gris). */
@Component({
  selector: 'app-detalle-cargo-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './detalle-cargo-modal.component.html',
  styleUrls: ['../cobranza.scss'],
  animations: [contractDimAnim, contractModalAnim],
})
export class DetalleCargoModalComponent implements OnInit {
  @Input({ required: true }) idCargo!: number;
  @Output() cerrar = new EventEmitter<void>();
  @Output() cambio = new EventEmitter<void>();
  @Output() verPago = new EventEmitter<number>();

  cargando = true;
  procesando = false;
  cargo: Cargo | null = null;

  readonly fmtMoneda = fmtMoneda;
  readonly fmtFecha = fmtFecha;
  readonly fmtFechaHora = formatearFechaHoraUtc;
  readonly fmtPeriodoCargo = fmtPeriodoCargo;
  readonly claseEstado = claseEstado;
  readonly etiquetaEstado = etiquetaEstado;
  readonly etiquetaClase = etiquetaClase;
  readonly etiquetaConcepto = etiquetaConcepto;

  /** Clic fuera del modal: cierra salvo que haya una operación en curso. */
  cerrarSiLibre(): void {
    if (!this.procesando) this.cerrar.emit();
  }

  constructor(private cobranza: CobranzaService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get cancelado(): boolean {
    return this.cargo?.estadoPago === 'CANCELADO';
  }

  get tieneSaldo(): boolean {
    return !this.cancelado && montoNum(this.cargo?.saldo) > 0;
  }

  /** Sólo se cancela un cargo sin pagos aplicados (si no, la API responde 409). */
  get puedeCancelar(): boolean {
    return !this.cancelado && montoNum(this.cargo?.pagado) === 0;
  }

  get hayDesgloseEstimado(): boolean {
    return (this.cargo?.conceptos ?? []).some((c) => c.desgloseEstimado);
  }

  etiquetaConceptoAplicacion(a: CargoAplicacion): string {
    const c = this.cargo?.conceptos.find((k) => k.id === a.idCargoConcepto);
    return c ? etiquetaConcepto(c) : `Concepto #${a.idCargoConcepto}`;
  }

  private cargar(): void {
    this.cargando = true;
    this.cobranza
      .obtenerCargo(this.idCargo)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (c) => (this.cargo = c),
        error: (err) => {
          alertaError('No se pudo cargar el cargo', err, 'Intenta de nuevo.');
          this.cerrar.emit();
        },
      });
  }

  async cancelarCargo(): Promise<void> {
    if (!this.cargo) return;
    const motivo = await pedirMotivo(
      '¡Cancelar Cargo!',
      `Se cancelará el cargo de <strong>${fmtMoneda(this.cargo.total)}</strong> (${fmtPeriodoCargo(this.cargo)}).`,
      'Sí, cancelar cargo',
    );
    if (!motivo) return;
    this.procesando = true;
    this.cobranza
      .cancelarCargo(this.idCargo, motivo)
      .pipe(finalize(() => (this.procesando = false)))
      .subscribe({
        next: () => {
          alertaExito('El cargo fue cancelado correctamente.');
          this.cambio.emit();
          this.cargar();
        },
        error: (err) => alertaError('No se pudo cancelar el cargo', err, 'Intenta de nuevo.'),
      });
  }
}
