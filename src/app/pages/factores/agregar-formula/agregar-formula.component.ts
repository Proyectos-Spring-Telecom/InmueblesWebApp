import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { environment } from 'src/environments/environment';
import {
  FormulaPayload,
  FormulasService,
} from 'src/app/services/moduleService/formulas.service';
import { parseValorNumerico } from 'src/app/shared/valor-miles-format';

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
    private http: HttpClient,
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

  private roundValorFactor(valor: number): number {
    return parseFloat(valor.toFixed(3));
  }

  private formatValorFactor(valor: number): string {
    return this.roundValorFactor(valor).toFixed(3);
  }

  private cargarCatalogoFactoresParaFormula(): void {
    this.cargandoVariablesFactores = true;
    this.http.get<{ data?: unknown[] }>(`${environment.API_SECURITY}/factores/listado`).subscribe({
      next: (resp) => {
        this.cargandoVariablesFactores = false;
        const rows = (Array.isArray(resp?.data) ? resp.data : [])
          .map((item) => item as Record<string, unknown>)
          .sort(
            (a, b) =>
              Number(a['id'] ?? a['Id'] ?? 0) - Number(b['id'] ?? b['Id'] ?? 0),
          );

        const vistos = new Set<string>();
        const factores: FactorOpcionFormula[] = [];

        for (const row of rows) {
          const est = Number(row['estatus'] ?? row['Estatus'] ?? 1);
          if (est === 0) continue;
          const variable = String(
            row['variable'] ?? row['Variable'] ?? row['nombre'] ?? row['Nombre'] ?? '',
          ).trim();
          if (!variable || vistos.has(variable)) continue;
          vistos.add(variable);

          const desc = String(row['descripcion'] ?? row['Descripcion'] ?? '').trim();
          const rawVal = row['valor'] ?? row['Valor'] ?? null;
          const parsed = parseValorNumerico(rawVal);
          const valor = Number.isFinite(parsed) ? this.roundValorFactor(parsed) : null;

          factores.push({
            variable,
            etiqueta: desc ? `${variable} — ${desc}` : variable,
            valor,
          });
        }

        this.factoresParaSelectFormula = factores;
        this.calcularPreview();
      },
      error: () => {
        this.cargandoVariablesFactores = false;
        this.factoresParaSelectFormula = [];
      },
    });
  }

  private variablesEnExpresion(expr: string): string[] {
    const encontradas: string[] = [];
    const ordenadas = [...this.factoresParaSelectFormula].sort(
      (a, b) => b.variable.length - a.variable.length,
    );

    for (const factor of ordenadas) {
      const variable = factor.variable;
      if (!variable || !expr.includes(variable)) continue;
      if (!encontradas.includes(variable)) {
        encontradas.push(variable);
      }
    }

    return encontradas;
  }

  private tokensDesconocidosEnExpresion(expr: string, conocidas: string[]): string[] {
    let limpia = expr;
    const ordenadas = [...conocidas].sort((a, b) => b.length - a.length);
    for (const variable of ordenadas) {
      limpia = limpia.split(variable).join(' ');
    }
    limpia = limpia.replace(/[0-9.+\-*/()\s]/g, ' ').trim();
    return [...new Set(limpia.split(/\s+/).filter(Boolean))];
  }

  // ─── Constructor de expresión por botones ─────────────────────────────────

  insertarVariable(variable: string): void {
    this.agregarToken(variable);
  }

  variableUsadaEnFormula(variable: string): boolean {
    const expr = String(this.formulaForm?.get('formula')?.value ?? '');
    return variable !== '' && expr.includes(variable);
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
    const current = String(ctrl.value ?? '').trimEnd();
    if (!current) return;

    const variablesOrdenadas = [...this.factoresParaSelectFormula]
      .map((f) => f.variable)
      .sort((a, b) => b.length - a.length);
    for (const variable of variablesOrdenadas) {
      if (variable && current.endsWith(variable)) {
        ctrl.setValue(current.slice(0, current.length - variable.length).trimEnd());
        ctrl.markAsDirty();
        return;
      }
    }

    const match = current.match(/^(.*?)(\s*[+\-*/()]|\s*[0-9.]+)\s*$/);
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

    const variables = this.variablesEnExpresion(expr);
    const desconocidas = this.tokensDesconocidosEnExpresion(expr, variables);

    const faltantes: string[] = [...desconocidas];
    const sinValor: string[] = [];

    for (const v of variables) {
      const factor = this.factoresParaSelectFormula.find((f) => f.variable === v);
      if (!factor) faltantes.push(v);
      else if (factor.valor == null || !Number.isFinite(factor.valor)) sinValor.push(v);
    }

    if (faltantes.length) {
      this.previewState = {
        ok: false,
        mensaje: `Variable${faltantes.length > 1 ? 's' : ''} no encontrada${faltantes.length > 1 ? 's' : ''} en Factores: ${[...new Set(faltantes)].join(', ')}`,
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

    // Sustituir — reemplazar cada variable por su valor numérico (más largas primero)
    let sustituida = expr;
    const variablesOrdenadas = [...variables].sort((a, b) => b.length - a.length);
    for (const v of variablesOrdenadas) {
      const factor = this.factoresParaSelectFormula.find((f) => f.variable === v)!;
      sustituida = sustituida.split(v).join(this.formatValorFactor(factor.valor!));
    }

    try {
      const resultado = evaluarExpresionSegura(sustituida);
      this.previewState = {
        ok: true,
        expresionSustituida: sustituida.trim(),
        resultado: this.roundValorFactor(resultado),
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
    if (tipo === 'PORCENTAJE') return this.formatValorFactor(resultado);
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