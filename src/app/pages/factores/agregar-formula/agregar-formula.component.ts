import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { FORMULAS_PRESUPUESTO_DEMO } from '../formulas-presupuesto-demo.data';

@Component({
  selector: 'app-agregar-formula',
  templateUrl: './agregar-formula.component.html',
  styleUrl: './agregar-formula.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarFormulaComponent implements OnInit {
  public submitButton: string = 'Guardar';
  public formulaForm: FormGroup;
  public idFormula: number;
  public title = 'Agregar Fórmula';

  constructor(
    private fb: FormBuilder,
    private activatedRouted: ActivatedRoute,
    private route: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.activatedRouted.params.subscribe((params) => {
      this.idFormula = Number(params['idFormula']);
      if (this.idFormula) {
        this.title = 'Actualizar Fórmula';
        this.obtenerFormulaDemo();
      }
    });
  }

  private initForm() {
    this.formulaForm = this.fb.group({
      nombre: ['', Validators.required],
      formula: ['', Validators.required],
    });
  }

  private obtenerFormulaDemo() {
    const formula = FORMULAS_PRESUPUESTO_DEMO.find((item) => item.id === this.idFormula);
    if (!formula) return;
    this.formulaForm.patchValue(
      {
        nombre: formula.nombre,
        formula: formula.formula,
      },
      { emitEvent: false },
    );
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
    Swal.fire({
      title: '¡Operación Exitosa!',
      text: this.idFormula
        ? 'La fórmula se actualizó correctamente.'
        : 'Se agregó una nueva fórmula correctamente.',
      icon: 'success',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Confirmar',
      background: '#141a21',
      color: '#ffffff',
    });
    this.regresar();
  }

  regresar() {
    this.route.navigateByUrl('/factores');
  }
}
