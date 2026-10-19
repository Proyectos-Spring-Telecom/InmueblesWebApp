import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CampoSelectComponent } from 'src/app/shared/campos-dx/campo-select.component';
import { contractDimAnim, contractModalAnim } from 'src/app/pipe/module-open.animation';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import {
  centavos,
  CobranzaService,
  montoNum,
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
  fmtFecha,
  fmtMoneda,
  sumaAplicaciones,
  validarAplicaciones,
} from '../cobranza-ui';

/** Aplicar saldo a favor: elegir un pago con disponible y repartirlo entre conceptos con saldo. */
@Component({
  selector: 'app-aplicar-saldo-modal',
  standalone: true,
  imports: [CommonModule, CampoSelectComponent, FormsModule, MatIconModule, MatProgressSpinnerModule, AplicacionesEditorComponent],
  templateUrl: './aplicar-saldo-modal.component.html',
  styleUrls: ['../cobranza.scss'],
  animations: [contractDimAnim, contractModalAnim],
})
export class AplicarSaldoModalComponent implements OnInit {
  @Input({ required: true }) idArrendatario!: number;
  @Input() nombreArrendatario = '';
  /** Pago a aplicar; si no se indica, el usuario lo elige de los que tienen disponible. */
  @Input() idPagoPreseleccionado: number | null = null;
  @Output() cerrar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<void>();

  cargando = true;
  guardando = false;
  pagos: Pago[] = [];
  conceptos: ConceptoAplicable[] = [];
  idPago: number | null = null;
  montos: Record<number, number | null> = {};

  readonly fmtMoneda = fmtMoneda;
  readonly fmtFecha = fmtFecha;
  /** Texto de cada pago en el select: fecha · monto · disponible · referencia. */
  readonly etiquetaPagoSelect = (p: Pago | null): string =>
    p
      ? `${fmtFecha(p.fechaPago)} · ${fmtMoneda(p.monto)} · disponible ${fmtMoneda(p.disponible)}` +
        (p.referencia ? ` · ${p.referencia}` : '')
      : '';

  /** Clic fuera del modal: cierra salvo que haya una operación en curso. */
  cerrarSiLibre(): void {
    if (!this.guardando) this.cerrar.emit();
  }

  constructor(private cobranza: CobranzaService) {}

  ngOnInit(): void {
    forkJoin({
      pagos: this.cobranza.obtenerPagos({ idArrendatario: this.idArrendatario, conDisponible: true, estatus: 1, page: 1, limit: 200 }),
      cargos: this.cobranza.obtenerCargos({ idArrendatario: this.idArrendatario, estado: 'CON_SALDO', page: 1, limit: 500 }),
    })
      .pipe(
        catchError((err) => {
          alertaError('No se pudo cargar la información', err, 'Intenta de nuevo.');
          return of({ pagos: { data: [] as Pago[] }, cargos: { data: [] } });
        }),
        finalize(() => (this.cargando = false)),
      )
      .subscribe(({ pagos, cargos }) => {
        this.pagos = pagos.data.filter((p) => montoNum(p.disponible) > 0);
        this.conceptos = conceptosAplicables(cargos.data);
        const pre = this.pagos.find((p) => p.id === this.idPagoPreseleccionado);
        this.idPago = pre?.id ?? (this.pagos.length === 1 ? this.pagos[0].id : null);
      });
  }

  get pagoSeleccionado(): Pago | undefined {
    return this.pagos.find((p) => p.id === this.idPago);
  }

  get disponible(): number {
    return montoNum(this.pagoSeleccionado?.disponible);
  }

  get porAplicar(): number {
    return sumaAplicaciones(this.montos);
  }

  get restante(): number {
    return centavos(this.disponible - this.porAplicar);
  }

  guardar(): void {
    const errores: string[] = [];
    if (!this.pagoSeleccionado) errores.push('Selecciona el pago con saldo a favor.');
    if (this.porAplicar <= 0) errores.push('Captura al menos un monto a aplicar.');
    errores.push(...validarAplicaciones(this.conceptos, this.montos, this.disponible, 'el disponible del pago'));
    if (errores.length) {
      alertaValidacion(errores);
      return;
    }
    this.guardando = true;
    this.cobranza
      .aplicarPago(Number(this.idPago), aplicacionesPayload(this.montos))
      .pipe(finalize(() => (this.guardando = false)))
      .subscribe({
        next: () => {
          alertaExito('El saldo a favor se aplicó correctamente.');
          this.guardado.emit();
        },
        error: (err) => alertaError('No se pudo aplicar el saldo', err, 'Intenta de nuevo.'),
      });
  }
}
