import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { centavos } from 'src/app/services/moduleService/cobranza.service';
import { ConceptoAplicable, fmtMoneda, sumaAplicaciones } from '../cobranza-ui';

/**
 * Lista de conceptos con saldo y un campo "aplicar" por cada uno.
 * El usuario decide a qué mes y concepto va cada abono (no hay aplicación automática).
 */
@Component({
  selector: 'app-aplicaciones-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './aplicaciones-editor.component.html',
  styleUrls: ['../cobranza.scss'],
})
export class AplicacionesEditorComponent {
  @Input() conceptos: ConceptoAplicable[] = [];
  /** Monto máximo a repartir (monto del pago o disponible). */
  @Input() limite = 0;
  @Input() montos: Record<number, number | null> = {};
  @Output() montosChange = new EventEmitter<Record<number, number | null>>();

  readonly fmtMoneda = fmtMoneda;

  get restante(): number {
    return centavos(this.limite - sumaAplicaciones(this.montos));
  }

  montoDe(c: ConceptoAplicable): number {
    return centavos(Number(this.montos[c.idCargoConcepto] ?? 0) || 0);
  }

  /** Lo que quedará debiendo el concepto tras este abono (pago parcial). */
  pendienteDe(c: ConceptoAplicable): number {
    return Math.max(0, centavos(c.saldo - this.montoDe(c)));
  }

  excede(c: ConceptoAplicable): boolean {
    return this.montoDe(c) > centavos(c.saldo);
  }

  actualizar(id: number, valor: number | null): void {
    this.montosChange.emit({ ...this.montos, [id]: valor });
  }

  /** Aplica el saldo del concepto, sin pasar de lo que queda por repartir. */
  saldar(c: ConceptoAplicable): void {
    const actual = Number(this.montos[c.idCargoConcepto] ?? 0) || 0;
    const disponible = Math.max(0, centavos(this.restante + actual));
    this.actualizar(c.idCargoConcepto, centavos(Math.min(c.saldo, disponible)));
  }

  limpiar(): void {
    this.montosChange.emit({});
  }
}
