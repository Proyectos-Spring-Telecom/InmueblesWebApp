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
import { DxSelectBoxModule } from 'devextreme-angular';
import { DROPDOWN_CAMPO_DX } from './campos-dx.config';

const SIN_ITEMS: any[] = [];

function mismosItems(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Select con DevExtreme que se comporta como `<select>` con `[ngValue]` hacia el formulario:
 * - El valor es exactamente `item[valueExpr]` (o el item completo si `valueExpr = 'this'`), igual que `[ngValue]`.
 * - Sólo notifica al formulario cuando el usuario elige una opción (no al asignar valores por código).
 * - Emite `(cambio)` después de actualizar el formulario, igual que el evento nativo.
 *
 * `items` debe ser un arreglo estable (propiedad del componente, no un literal creado en el template).
 * Una opción con valor `null` (p. ej. «Todos») se muestra mediante `placeholder`.
 */
@Component({
  selector: 'app-campo-select',
  standalone: true,
  imports: [DxSelectBoxModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CampoSelectComponent), multi: true }],
  host: { class: 'campo-dx campo-dx--select' },
  template: `
    <dx-select-box
      class="perm-dx"
      stylingMode="filled"
      labelMode="hidden"
      [items]="lista"
      [valueExpr]="valueExpr"
      [displayExpr]="displayExpr"
      [placeholder]="placeholder || label"
      [value]="valor"
      [searchEnabled]="buscar"
      searchMode="contains"
      [showClearButton]="limpiable && !soloLectura"
      [disabled]="deshabilitado"
      [readOnly]="soloLectura"
      [noDataText]="sinDatosTexto"
      [inputAttr]="{ id: inputId || null, 'aria-label': ariaLabel || label || null }"
      [dropDownOptions]="dropDownOptions"
      [hint]="hint || undefined"
      (valueChange)="alCambiarDx($event)"
      (onFocusOut)="onTouched()"
    ></dx-select-box>
  `,
})
export class CampoSelectComponent implements ControlValueAccessor {
  /** Opciones (lo que generaba el `*ngFor` de `<option>`). */
  @Input() set items(v: readonly unknown[] | null | undefined) {
    const nueva = (v ?? SIN_ITEMS) as any[];
    // Métodos del template que devuelven un arreglo nuevo en cada ciclo: si el contenido es el mismo,
    // se conserva la referencia para que DevExtreme no redibuje (ni cierre) la lista.
    if (mismosItems(this.lista, nueva)) return;
    this.lista = nueva;
  }
  lista: any[] = SIN_ITEMS;
  /** Campo del item que es el valor (`[ngValue]`). `'this'` = el item completo. */
  @Input() valueExpr: string | ((item: any) => unknown) = 'id';
  /** Campo o función que da el texto visible de cada opción (lo que había dentro de `<option>`). */
  @Input() displayExpr: string | ((item: any) => string) = 'nombre';
  @Input() label = '';
  @Input() placeholder = 'Selecciona…';
  @Input() inputId = '';
  @Input() ariaLabel = '';
  @Input() hint = '';
  @Input() buscar = true;
  /** Muestra la X para volver a `null` (equivale a elegir la opción vacía / «Selecciona…» del select nativo). */
  @Input() limpiable = false;
  @Input() sinDatosTexto = 'Sin opciones';
  @Input() set disabled(v: boolean | '' | null | undefined) {
    this.deshabilitadoInput = v === '' || !!v;
  }
  @Input() set readonly(v: boolean | '' | null | undefined) {
    this.soloLectura = v === '' || !!v;
  }
  /** Equivale al `(change)` nativo: se emite tras actualizar el formulario (no se llama `change` para no chocar con el evento DOM). */
  @Output() cambio = new EventEmitter<unknown>();

  readonly dropDownOptions = DROPDOWN_CAMPO_DX;
  valor: unknown = null;
  soloLectura = false;
  private deshabilitadoInput = false;
  private deshabilitadoForm = false;
  private onChange: (v: unknown) => void = () => {};
  onTouched: () => void = () => {};

  constructor(private cdr: ChangeDetectorRef) {}

  get deshabilitado(): boolean {
    return this.deshabilitadoInput || this.deshabilitadoForm;
  }

  writeValue(v: unknown): void {
    this.valor = v === undefined ? null : v;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: unknown) => void): void {
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
    const nuevo = v === undefined ? null : v;
    if (nuevo === this.valor) return; // eco de un valor asignado por código
    this.valor = nuevo;
    this.onChange(nuevo);
    this.cambio.emit(nuevo);
  }
}
