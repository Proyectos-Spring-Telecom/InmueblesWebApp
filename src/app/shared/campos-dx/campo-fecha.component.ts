import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  Input,
  Output,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DxDateBoxModule } from 'devextreme-angular';
import { DROPDOWN_CAMPO_DX } from './campos-dx.config';

/** `YYYY-MM-DD` al inicio del texto (también acepta ISO con hora: se toma sólo el día). */
const FECHA_ISO = /^(\d{4}-\d{2}-\d{2})/;

/**
 * Fecha con DevExtreme que se comporta EXACTAMENTE como `<input type="date">` hacia el formulario:
 * - Recibe y entrega texto: `''` (vacío) o `'YYYY-MM-DD'`. Nunca un objeto `Date`.
 * - Sólo notifica al formulario cuando el usuario cambia la fecha (no al asignar valores por código).
 * - Emite `(cambio)` después de actualizar el formulario, igual que el evento nativo.
 *
 * Uso: dentro de `.input-group.perm-ig`, en lugar del `<div class="form-floating">…</div>`.
 */
@Component({
  selector: 'app-campo-fecha',
  standalone: true,
  imports: [DxDateBoxModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CampoFechaComponent), multi: true }],
  host: { class: 'campo-dx campo-dx--fecha' },
  template: `
    <dx-date-box
      class="perm-dx"
      type="date"
      displayFormat="dd/MM/yyyy"
      dateSerializationFormat="yyyy-MM-dd"
      stylingMode="filled"
      labelMode="hidden"
      [placeholder]="placeholder || 'dd/mm/aaaa'"
      [value]="$any(valor || null)"
      [min]="min || undefined"
      [max]="max || undefined"
      [openOnFieldClick]="!soloLectura"
      [showClearButton]="limpiable && !soloLectura"
      [disabled]="deshabilitado"
      [readOnly]="soloLectura"
      [useMaskBehavior]="true"
      [inputAttr]="{ id: inputId || null, 'aria-label': ariaLabel || label || null }"
      [dropDownOptions]="dropDownOptions"
      (valueChange)="alCambiarDx($event)"
      (onFocusOut)="onTouched()"
    ></dx-date-box>
  `,
})
export class CampoFechaComponent implements ControlValueAccessor {
  /** Texto de la etiqueta flotante (el `<label>` que estaba dentro de `.form-floating`). */
  @Input() label = '';
  @Input() placeholder = '';
  /** `id` del `<input>` interno, para los `<label for>` existentes. */
  @Input() inputId = '';
  @Input() ariaLabel = '';
  /** Límites opcionales en `'YYYY-MM-DD'`. */
  @Input() min: string | null = null;
  @Input() max: string | null = null;
  @Input() limpiable = true;
  @Input() set disabled(v: boolean | '' | null | undefined) {
    this.deshabilitadoInput = v === '' || !!v;
  }
  @Input() set readonly(v: boolean | '' | null | undefined) {
    this.soloLectura = v === '' || !!v;
  }
  /** Equivale al `(change)` nativo: se emite tras actualizar el formulario (no se llama `change` para no chocar con el evento DOM). */
  @Output() cambio = new EventEmitter<string>();

  readonly dropDownOptions = DROPDOWN_CAMPO_DX;
  /** Valor tal cual lo maneja el formulario: `''` o `'YYYY-MM-DD'`. */
  valor = '';
  soloLectura = false;
  private deshabilitadoInput = false;
  private deshabilitadoForm = false;
  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  constructor(private cdr: ChangeDetectorRef) {}

  get deshabilitado(): boolean {
    return this.deshabilitadoInput || this.deshabilitadoForm;
  }

  writeValue(v: unknown): void {
    const m = FECHA_ISO.exec(String(v ?? '').trim());
    this.valor = m ? m[1] : '';
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.deshabilitadoForm = isDisabled;
    this.cdr.markForCheck();
  }

  alCambiarDx(v: unknown): void {
    const m = FECHA_ISO.exec(String(v ?? '').trim());
    const nuevo = m ? m[1] : '';
    if (nuevo === this.valor) return; // eco de un valor asignado por código
    this.valor = nuevo;
    this.onChange(nuevo);
    this.cambio.emit(nuevo);
  }
}
