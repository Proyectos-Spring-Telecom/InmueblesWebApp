import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { contractDimAnim, contractModalAnim } from 'src/app/pipe/module-open.animation';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import {
  CobranzaService,
  montoNum,
  Pago,
  PagoAplicacion,
} from 'src/app/services/moduleService/cobranza.service';
import {
  alertaError,
  alertaExito,
  claseEstado,
  confirmar,
  escaparHtml,
  etiquetaClase,
  etiquetaConcepto,
  etiquetaEstado,
  fmtFecha,
  fmtMes,
  fmtMoneda,
  pedirMotivo,
} from '../cobranza-ui';
import { formatearFechaHoraUtc } from '../../../inmuebles/inmuebles-list.mapper';

const ETIQUETA_ORIGEN: Record<string, string> = {
  CAPTURA: 'Captura en la aplicación',
  MIGRACION: 'Migración (renta pagada antes del cambio)',
  LEGACY: 'Pago de servicio migrado',
  HISTORICO: 'Histórico de rentas',
};

/** Detalle de pago: datos, aplicaciones (anuladas en gris), anular aplicación y cancelar pago. */
@Component({
  selector: 'app-detalle-pago-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './detalle-pago-modal.component.html',
  styleUrls: ['../cobranza.scss'],
  animations: [contractDimAnim, contractModalAnim],
})
export class DetallePagoModalComponent implements OnInit {
  @Input({ required: true }) idPago!: number;
  @Output() cerrar = new EventEmitter<void>();
  /** Se emite tras anular una aplicación o cancelar el pago (para refrescar saldos). */
  @Output() cambio = new EventEmitter<void>();

  cargando = true;
  procesando = false;
  pago: Pago | null = null;

  readonly fmtMoneda = fmtMoneda;
  readonly fmtFecha = fmtFecha;
  readonly fmtMes = fmtMes;
  readonly fmtFechaHora = formatearFechaHoraUtc;
  readonly claseEstado = claseEstado;
  readonly etiquetaEstado = etiquetaEstado;
  readonly etiquetaClase = etiquetaClase;

  /** Clic fuera del modal: cierra salvo que haya una operación en curso. */
  cerrarSiLibre(): void {
    if (!this.procesando) this.cerrar.emit();
  }

  constructor(private cobranza: CobranzaService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get cancelado(): boolean {
    return String(this.pago?.estatus ?? '').toUpperCase() === 'CANCELADO';
  }

  get tieneDisponible(): boolean {
    return !this.cancelado && montoNum(this.pago?.disponible) > 0;
  }

  get aplicacionesVigentes(): PagoAplicacion[] {
    return (this.pago?.aplicaciones ?? []).filter((a) => a.vigente);
  }

  etiquetaOrigen(origen: unknown): string {
    return ETIQUETA_ORIGEN[String(origen ?? '').toUpperCase()] ?? String(origen ?? '—');
  }

  etiquetaAplicacion(a: PagoAplicacion): string {
    const concepto = a.concepto
      ? etiquetaConcepto({ tipo: a.concepto.tipo, tipoServicio: null, descripcion: a.concepto.descripcion })
      : '—';
    const desc = a.cargo?.descripcion ? ` · ${a.cargo.descripcion}` : '';
    return `${concepto}${desc}`;
  }

  private cargar(): void {
    this.cargando = true;
    this.cobranza
      .obtenerPago(this.idPago)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (p) => (this.pago = p),
        error: (err) => {
          alertaError('No se pudo cargar el pago', err, 'Intenta de nuevo.');
          this.cerrar.emit();
        },
      });
  }

  async anularAplicacion(a: PagoAplicacion): Promise<void> {
    const ok = await confirmar(
      '¡Anular Aplicación!',
      `Se quitarán <strong>${fmtMoneda(a.monto)}</strong> de ${escaparHtml(this.etiquetaAplicacion(a))} ` +
        `(${fmtMes(a.cargo?.mes)}).<br>El monto regresa al disponible del pago y el cargo recupera su saldo.`,
      'Sí, anular',
    );
    if (!ok) return;
    this.procesando = true;
    this.cobranza
      .anularAplicacion(this.idPago, a.id)
      .pipe(finalize(() => (this.procesando = false)))
      .subscribe({
        next: () => {
          alertaExito('La aplicación fue anulada correctamente.');
          this.cambio.emit();
          this.cargar();
        },
        error: (err) => alertaError('No se pudo anular la aplicación', err, 'Intenta de nuevo.'),
      });
  }

  async cancelarPago(): Promise<void> {
    if (!this.pago) return;
    const reabiertos = this.aplicacionesVigentes
      .map((a) => `<li>${escaparHtml(this.etiquetaAplicacion(a))} · ${fmtMes(a.cargo?.mes)} · ${fmtMoneda(a.monto)}</li>`)
      .join('');
    const html =
      `Se cancelará el pago de <strong>${fmtMoneda(this.pago.monto)}</strong> del ${fmtFecha(this.pago.fechaPago)}. ` +
      'El pago no se borra: queda como CANCELADO.' +
      (reabiertos
        ? `<div style="text-align:left;margin-top:.6rem">Estos cargos recuperan su saldo:<ul>${reabiertos}</ul></div>`
        : '');
    const motivo = await pedirMotivo('¡Cancelar Pago!', html, 'Sí, cancelar pago');
    if (!motivo) return;
    this.procesando = true;
    this.cobranza
      .cancelarPago(this.idPago, motivo)
      .pipe(finalize(() => (this.procesando = false)))
      .subscribe({
        next: () => {
          alertaExito('El pago fue cancelado correctamente.');
          this.cambio.emit();
          this.cargar();
        },
        error: (err) => alertaError('No se pudo cancelar el pago', err, 'Intenta de nuevo.'),
      });
  }
}
