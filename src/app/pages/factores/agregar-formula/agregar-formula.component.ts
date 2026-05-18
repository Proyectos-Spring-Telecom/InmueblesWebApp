import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
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
}

@Component({
  selector: 'app-agregar-formula',
  templateUrl: './agregar-formula.component.html',
  styleUrl: './agregar-formula.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarFormulaComponent implements OnInit {
  public submitButton: string = 'Guardar';
  public loading = false;
  public formulaForm: FormGroup;
  public idFormula: number | null = null;
  public title = 'Agregar Fórmula';
  /** Opciones del select: variables activas de Factores. */
  public factoresParaSelectFormula: FactorOpcionFormula[] = [];
  public cargandoVariablesFactores = false;
  /** Select standalone: tras elegir se inserta y se vuelve a ''. */
  public factorSeleccionadoParaFormula = '';

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

  private cargarCatalogoFactoresParaFormula(): void {
    this.cargandoVariablesFactores = true;
    this.factoresService.obtenerFactoresData(1, 300).subscribe({
      next: (resp: any) => {
        this.cargandoVariablesFactores = false;
        const rows: any[] = Array.isArray(resp?.data) ? resp.data : [];
        const map = new Map<string, string>();
        for (const item of rows) {
          const est = Number(item?.estatus ?? item?.Estatus ?? 1);
          if (est === 0) continue;
          const variable = String(
            item?.variable ?? item?.Variable ?? item?.nombre ?? item?.Nombre ?? '',
          ).trim();
          if (!variable || map.has(variable)) continue;
          const desc = String(item?.descripcion ?? item?.Descripcion ?? '').trim();
          map.set(variable, desc.slice(0, 80));
        }
        this.factoresParaSelectFormula = [...map.entries()]
          .sort(([a], [b]) => a.localeCompare(b, 'es'))
          .map(([variable, desc]) => ({
            variable,
            etiqueta: desc ? `${variable} — ${desc}` : variable,
          }));
      },
      error: () => {
        this.cargandoVariablesFactores = false;
        this.factoresParaSelectFormula = [];
      },
    });
  }

  onFactorSelectParaFormula(variable: string): void {
    if (!variable) return;
    this.insertarVariableEnFormula(variable);
    queueMicrotask(() => {
      this.factorSeleccionadoParaFormula = '';
    });
  }

  insertarVariableEnFormula(variable: string): void {
    const ctrl = this.formulaForm.get('formula');
    if (!ctrl || !variable) return;
    const cur = String(ctrl.value ?? '').trimEnd();
    const next = cur.length ? `${cur} ${variable}` : variable;
    ctrl.setValue(next);
    ctrl.markAsDirty();
  }

  private initForm() {
    this.formulaForm = this.fb.group({
      nombre: ['', Validators.required],
      formula: ['', Validators.required],
    });
  }

  private obtenerFormula() {
    if (this.idFormula == null) return;

    this.formulasService.obtenerFormula(this.idFormula).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res ?? {};
        this.formulaForm.patchValue(
          {
            nombre: data?.nombre ?? '',
            formula: data?.formula ?? '',
          },
          { emitEvent: false },
        );
        this.formulaForm.markAsPristine();
      },
      error: () => {
        Swal.fire({
          title: '¡Ops!',
          text: `No se pudo cargar la fórmula.`,
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
        this.regresar();
      },
    });
  }

  private buildPayload(): FormulaPayload {
    const v = this.formulaForm.value;
    return {
      nombre: (v.nombre ?? '').trim(),
      formula: (v.formula ?? '').trim(),
    };
  }

  submit() {
    if (this.formulaForm.invalid) {
      this.formulaForm.markAllAsTouched();
      Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: '¡Revise el formulario!',
        text: 'Complete los campos requeridos.',
        icon: 'error',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    this.submitButton = 'Cargando...';
    this.loading = true;
    const payload = this.buildPayload();

    if (this.idFormula != null) {
      this.formulasService.actualizarFormula(this.idFormula, payload).subscribe({
        next: () => {
          this.submitButton = 'Actualizar';
          this.loading = false;
          Swal.fire({
            title: '¡Operación exitosa!',
            text: 'La fórmula se actualizó correctamente.',
            icon: 'success',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
            background: '#141a21',
            color: '#ffffff',
          });
          this.regresar();
        },
        error: () => {
          this.submitButton = 'Actualizar';
          this.loading = false;
          Swal.fire({
            title: '¡Ops!',
            text: 'Ocurrió un error al actualizar la fórmula.',
            icon: 'error',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
            background: '#141a21',
            color: '#ffffff',
          });
        },
      });
      return;
    }

    this.formulasService.agregarFormula(payload).subscribe({
      next: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación exitosa!',
          text: 'Se agregó una nueva fórmula correctamente.',
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
        this.regresar();
      },
      error: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Ops!',
          text: 'Ocurrió un error al agregar la fórmula.',
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
      },
    });
  }

  regresar() {
    this.route.navigateByUrl('/factores');
  }
}
