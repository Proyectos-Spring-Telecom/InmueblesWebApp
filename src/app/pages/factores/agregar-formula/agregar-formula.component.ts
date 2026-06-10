import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { FactoresService } from 'src/app/services/moduleService/factores.service';
import {
  FormulaPayload,
  FormulasService,
} from 'src/app/services/moduleService/formulas.service';

interface FactorOpcionFormula {
  variable: string;
  etiqueta: string;
  valor: number | null;
}

interface PreviewResultado {
  expresionSustituida: string;
  resultado: number;
  ok: true;
}

interface PreviewError {
  mensaje: string;
  ok: false;
}

type PreviewState = PreviewResultado | PreviewError | null;

// ─── Validators ───────────────────────────────────────────────────────────────

function parentesisBalanceadosValidator(control: AbstractControl): ValidationErrors | null {
  const value: string = control.value ?? '';
  if (!value.trim()) return null;
  let count = 0;
  for (const char of value) {
    if (char === '(') count++;
    else if (char === ')') count--;
    if (count < 0) return { parentesisDesbalanceados: true };
  }
  return count === 0 ? null : { parentesisDesbalanceados: true };
}

// ─── Parser seguro ────────────────────────────────────────────────────────────

function evaluarExpresionSegura(expresion: string): number {
  let pos = 0;
  const s = expresion.replace(/\s+/g, '');

  function parseExpresion(): number {
    let resultado = parseTerm();
    while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
      const op = s[pos++];
      const t  = parseTerm();
      resultado = op === '+' ? resultado + t : resultado - t;
    }
    return resultado;
  }

  function parseTerm(): number {
    let resultado = parseFactor();
    while (pos < s.length && (s[pos] === '*' || s[pos] === '/')) {
      const op = s[pos++];
      const f  = parseFactor();
      if (op === '/' && f === 0) throw new Error('División entre cero');
      resultado = op === '*' ? resultado * f : resultado / f;
    }
    return resultado;
  }

  function parseFactor(): number {
    if (s[pos] === '(') {
      pos++;
      const resultado = parseExpresion();
      if (s[pos] !== ')') throw new Error('Paréntesis desbalanceados');
      pos++;
      return resultado;
    }
    if (s[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    const start = pos;
    while (pos < s.length && /[0-9.]/.test(s[pos])) pos++;
    if (pos === start) throw new Error('Token inesperado en posición ' + pos);
    return parseFloat(s.slice(start, pos));
  }

  const resultado = parseExpresion();
  if (pos !== s.length) throw new Error('Expresión inválida');
  return resultado;
}

// ─── Componente ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-agregar-formula',
  templateUrl: './agregar-formula.component.html',
  styleUrl: './agregar-formula.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarFormulaComponent implements OnInit {

  public submitButton = 'Guardar';
  public loading      = false;
  public formulaForm: FormGroup;
  public idFormula: number | null = null;
  public title = 'Agregar Fórmula';
  public factoresParaSelectFormula: FactorOpcionFormula[] = [];
  public cargandoVariablesFactores = false;
  public previewState: PreviewState = null;

  constructor(
    private fb: FormBuilder,
    private formulasService: FormulasService,
    private factoresService: FactoresService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.cargarCatalogoFactoresParaFormula();
    this.activatedRouted.params.subscribe((params) => {
      const raw = params['idFormula'];
      const idn = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN;
      this.idFormula = Number.isFinite(idn) && idn > 0 ? Math.floor(idn) : null;
      if (this.idFormula != null) {
        this.title = 'Actualizar Fórmula';
        this.obtenerFormula();
      } else {
        this.title = 'Agregar Fórmula';
      }
    });
  }

  private initForm(): void {
    this.formulaForm = this.fb.group({
      nombre:        ['', Validators.required],
      formula:       ['', [Validators.required, parentesisBalanceadosValidator]],
      descripcion:   [''],
      tipoResultado: ['PORCENTAJE', Validators.required],
    });

    this.formulaForm.get('formula')?.valueChanges.subscribe(() => {
      this.calcularPreview();
    });

    this.formulaForm.get('tipoResultado')?.valueChanges.subscribe(() => {
      this.calcularPreview();
    });
  }

  private cargarCatalogoFactoresParaFormula(): void {
    this.cargandoVariablesFactores = true;
    this.factoresService.obtenerFactoresData(1, 300).subscribe({
      next: (resp: any) => {
        this.cargandoVariablesFactores = false;
        const rows: any[] = Array.isArray(resp?.data) ? resp.data : [];
        const map = new Map<string, { desc: string; valor: number | null }>();

        for (const item of rows) {
          const est = Number(item?.estatus ?? item?.Estatus ?? 1);
          if (est === 0) continue;
          const variable = String(
            item?.variable ?? item?.Variable ?? item?.nombre ?? item?.Nombre ?? '',
          ).trim();
          if (!variable || map.has(variable)) continue;
          const desc   = String(item?.descripcion ?? item?.Descripcion ?? '').trim();
          const rawVal = item?.valor ?? item?.Valor ?? null;
          const valor  = rawVal !== null ? parseFloat(String(rawVal).replace(/,/g, '')) : null;
          map.set(variable, { desc: desc.slice(0, 80), valor: Number.isFinite(valor!) ? valor : null });
        }

        this.factoresParaSelectFormula = [
          ...[...map.entries()]
            .sort(([a], [b]) => a.localeCompare(b, 'es'))
            .map(([variable, { desc, valor }]) => ({
              variable,
              etiqueta: desc ? `${variable} — ${desc}` : variable,
              valor,
            })),
          ...Array.from({ length: 20 }, (_, i) => {
            const n = i + 1;
            const variable = `VAR_DEMO_${String(n).padStart(2, '0')}`;
            return {
              variable,
              etiqueta: `${variable} — Factor ficticio ${n}`,
              valor: Number((n * 1.25).toFixed(2)),
            };
          }),
        ];

        this.calcularPreview();
      },
      error: () => {
        this.cargandoVariablesFactores = false;
        this.factoresParaSelectFormula = [];
      },
    });
  }

  // ─── Constructor de expresión por botones ─────────────────────────────────

  insertarVariable(variable: string): void {
    this.agregarToken(variable);
  }

  variableUsadaEnFormula(variable: string): boolean {
    const expr = String(this.formulaForm?.get('formula')?.value ?? '');
    if (!expr.trim()) return false;
    const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^A-Z0-9_])${escaped}([^A-Z0-9_]|$)`).test(expr);
  }

  agregarToken(token: string): void {
    const ctrl = this.formulaForm.get('formula');
    if (!ctrl) return;

    const esOp = ['+', '-', '*', '/'].includes(token);
    const base = String(ctrl.value ?? '').trimEnd();
    let nuevo: string;

    if (!base) {
      nuevo = esOp ? `${token} ` : token;
    } else if (esOp) {
      nuevo = `${base} ${token} `;
    } else if (token === '(') {
      const ultimo = base[base.length - 1] ?? '';
      nuevo = ultimo === '(' ? `${base}${token}` : `${base} ${token}`;
    } else if (token === ')') {
      nuevo = `${base}${token}`;
    } else {
      const ultimo = base[base.length - 1] ?? '';
      nuevo = ultimo === '(' ? `${base}${token}` : `${base} ${token}`;
    }

    ctrl.setValue(nuevo);
    ctrl.markAsDirty();
  }

  borrarUltimo(): void {
    const ctrl = this.formulaForm.get('formula');
    if (!ctrl) return;
    const current = String(ctrl.value ?? '');
    // Borrar el último token completo (variable, operador o número)
    const trimmed = current.trimEnd();
    const match   = trimmed.match(/^(.*?)(\s*[A-Z0-9_.]+|\s*[+\-*/()])\s*$/s);
    if (match) {
      ctrl.setValue(match[1].trimEnd());
    } else {
      ctrl.setValue('');
    }
    ctrl.markAsDirty();
  }

  limpiarFormula(): void {
    this.formulaForm.get('formula')?.setValue('');
    this.formulaForm.get('formula')?.markAsDirty();
    this.previewState = null;
  }

  // ─── Preview ──────────────────────────────────────────────────────────────

  private calcularPreview(): void {
    const expr = (this.formulaForm.get('formula')?.value ?? '').trim();

    if (!expr) {
      this.previewState = null;
      return;
    }

    const variables: string[] = [...new Set<string>(expr.match(/[A-Z_][A-Z0-9_]*/g) ?? [])];

    const faltantes: string[] = [];
    const sinValor:  string[] = [];

    for (const v of variables) {
      const factor = this.factoresParaSelectFormula.find((f) => f.variable === v);
      if (!factor)            faltantes.push(v);
      else if (!factor.valor && factor.valor !== 0) sinValor.push(v);
    }

    if (faltantes.length) {
      this.previewState = {
        ok: false,
        mensaje: `Variable${faltantes.length > 1 ? 's' : ''} no encontrada${faltantes.length > 1 ? 's' : ''} en Factores: ${faltantes.join(', ')}`,
      };
      return;
    }

    if (sinValor.length) {
      this.previewState = {
        ok: false,
        mensaje: `Variable${sinValor.length > 1 ? 's' : ''} sin valor numérico: ${sinValor.join(', ')}`,
      };
      return;
    }

    // Sustituir — reemplazar cada variable por su valor numérico
    let sustituida = expr;
    for (const v of variables) {
      const factor = this.factoresParaSelectFormula.find((f) => f.variable === v)!;
      // Reemplazar todas las ocurrencias exactas de la variable
      let result = '';
      let i = 0;
      while (i < sustituida.length) {
        if (
          sustituida.startsWith(v, i) &&
          !/[A-Z0-9_]/.test(sustituida[i - 1] ?? '') &&
          !/[A-Z0-9_]/.test(sustituida[i + v.length] ?? '')
        ) {
          result += String(factor.valor);
          i += v.length;
        } else {
          result += sustituida[i];
          i++;
        }
      }
      sustituida = result;
    }

    try {
      const resultado = evaluarExpresionSegura(sustituida);
      this.previewState = {
        ok: true,
        expresionSustituida: sustituida.trim(),
        resultado: parseFloat(resultado.toFixed(4)),
      };
    } catch (e: any) {
      this.previewState = {
        ok: false,
        mensaje: e?.message ?? 'Error al evaluar la expresión',
      };
    }
  }

  get previewResultadoFormateado(): string {
    if (!this.previewState?.ok) return '';
    const resultado = (this.previewState as PreviewResultado).resultado;
    const tipo      = this.formulaForm.get('tipoResultado')?.value;
    if (tipo === 'PORCENTAJE') return `${resultado.toFixed(4)}`;
    return resultado.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
  }

  get formulaErrorMsg(): string | null {
    const ctrl = this.formulaForm.get('formula');
    if (!ctrl || !ctrl.touched) return null;
    if (ctrl.hasError('required'))                return 'La expresión matemática es requerida.';
    if (ctrl.hasError('parentesisDesbalanceados')) return 'Los paréntesis no están balanceados.';
    return null;
  }

  private obtenerFormula(): void {
    if (this.idFormula == null) return;
    this.formulasService.obtenerFormula(this.idFormula).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res ?? {};
        setTimeout(() => {
          this.formulaForm.patchValue(
            {
              nombre:        data?.nombre        ?? data?.Nombre        ?? '',
              formula:       data?.formula       ?? data?.Formula       ?? '',
              descripcion:   data?.descripcion   ?? data?.Descripcion   ?? '',
              tipoResultado: data?.tipoResultado ?? data?.TipoResultado ?? 'MONTO',
            },
            { emitEvent: false },
          );
          this.formulaForm.markAsPristine();
          this.calcularPreview();
        });
      },
      error: () => {
        Swal.fire({
          title: '¡Ops!', text: 'No se pudo cargar la fórmula.',
          icon: 'error', confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar', background: '#141a21', color: '#ffffff',
        });
        this.regresar();
      },
    });
  }

  private buildPayload(): FormulaPayload {
    const v = this.formulaForm.value;
    return {
      nombre:        (v.nombre      ?? '').trim(),
      formula:       (v.formula     ?? '').trim(),
      descripcion:   (v.descripcion ?? '').trim() || undefined,
      tipoResultado: v.tipoResultado ?? 'MONTO',
    };
  }

  submit(): void {
    this.formulaForm.markAllAsTouched();
    if (this.formulaForm.invalid) {
      Swal.fire({
        background: '#141a21', color: '#ffffff',
        title: '¡Revise el formulario!',
        text: this.formulaForm.get('formula')?.hasError('parentesisDesbalanceados')
          ? 'Los paréntesis de la expresión no están balanceados.'
          : 'Complete los campos requeridos.',
        icon: 'error', confirmButtonText: 'Entendido',
      });
      return;
    }

    this.submitButton = 'Cargando...';
    this.loading      = true;
    const payload     = this.buildPayload();

    if (this.idFormula != null) {
      this.formulasService.actualizarFormula(this.idFormula, payload).subscribe({
        next: () => {
          this.submitButton = 'Actualizar'; this.loading = false;
          Swal.fire({ title: '¡Operación exitosa!', text: 'La fórmula se actualizó correctamente.',
            icon: 'success', confirmButtonColor: '#3085d6', confirmButtonText: 'Confirmar',
            background: '#141a21', color: '#ffffff' });
          this.regresar();
        },
        error: () => {
          this.submitButton = 'Actualizar'; this.loading = false;
          Swal.fire({ title: '¡Ops!', text: 'Ocurrió un error al actualizar la fórmula.',
            icon: 'error', confirmButtonColor: '#3085d6', confirmButtonText: 'Confirmar',
            background: '#141a21', color: '#ffffff' });
        },
      });
      return;
    }

    this.formulasService.agregarFormula(payload).subscribe({
      next: () => {
        this.submitButton = 'Guardar'; this.loading = false;
        Swal.fire({ title: '¡Operación exitosa!', text: 'Se agregó una nueva fórmula correctamente.',
          icon: 'success', confirmButtonColor: '#3085d6', confirmButtonText: 'Confirmar',
          background: '#141a21', color: '#ffffff' });
        this.regresar();
      },
      error: () => {
        this.submitButton = 'Guardar'; this.loading = false;
        Swal.fire({ title: '¡Ops!', text: 'Ocurrió un error al agregar la fórmula.',
          icon: 'error', confirmButtonColor: '#3085d6', confirmButtonText: 'Confirmar',
          background: '#141a21', color: '#ffffff' });
      },
    });
  }

  regresar(): void {
    this.route.navigateByUrl('/factores');
  }
}