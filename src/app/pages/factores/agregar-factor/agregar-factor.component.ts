import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { FactorPayload, FactoresService } from 'src/app/services/moduleService/factores.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-agregar-factor',
  templateUrl: './agregar-factor.component.html',
  styleUrl: './agregar-factor.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarFactorComponent implements OnInit {
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public factorForm: FormGroup;
  public idFactor: number;
  public title = 'Agregar Factor';

  constructor(
    private fb: FormBuilder,
    private factoresService: FactoresService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.activatedRouted.params.subscribe((params) => {
      this.idFactor = params['idFactor'];
      if (this.idFactor) {
        this.title = 'Actualizar Factor';
        this.obtenerFactor();
      }
    });
  }

  obtenerFactor() {
    this.factoresService.obtenerFactor(this.idFactor).subscribe((res: any) => {
      const data = res?.data ?? res ?? {};
      this.factorForm.patchValue(
        {
          variable: data?.variable ?? data?.nombre ?? '',
          valor: data?.valor ?? '',
          descripcion: data?.descripcion ?? '',
        },
        { emitEvent: false },
      );
      this.factorForm.markAsPristine();
    });
  }

  initForm() {
    this.factorForm = this.fb.group({
      variable: ['', Validators.required],
      valor: ['', Validators.required],
      descripcion: ['', [Validators.maxLength(2000)]],
    });
  }

  submit() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idFactor) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  private etiquetas: Record<string, string> = {
    variable: 'Variable',
    valor: 'Valor',
    descripcion: 'Descripción',
  };

  private mostrarErroresValidacion(esActualizar: boolean) {
    this.submitButton = esActualizar ? 'Actualizar' : 'Guardar';
    this.loading = false;
    const camposFaltantes: string[] = [];
    Object.keys(this.factorForm.controls).forEach((key) => {
      const control = this.factorForm.get(key);
      if (control?.invalid) {
        camposFaltantes.push(this.etiquetas[key] || key);
      }
    });
    const lista = camposFaltantes
      .map(
        (campo, index) => `
            <div style="padding: 8px 12px; border-left: 4px solid #d9534f;
                        background: #caa8a8; text-align: center; margin-bottom: 8px;
                        border-radius: 4px;">
              <strong style="color: #b02a37;">${index + 1}. ${campo}</strong>
            </div>
          `,
      )
      .join('');
    Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: '¡Revise el formulario!',
      html: `
              <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
                Corrija los campos indicados antes de continuar.
              </p>
              <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
            `,
      icon: 'error',
      confirmButtonText: 'Entendido',
      customClass: {
        popup: 'swal2-padding swal2-border',
      },
    });
  }

  private buildPayload(): FactorPayload {
    const v = this.factorForm.value;
    return {
      nombre: (v.variable ?? '').trim(),
      valor: Number(v.valor) || 0,
      descripcion: (v.descripcion ?? '').trim() || null,
      categoria: null,
      zonaReferencia: null,
      unidad: null,
    };
  }

  agregar() {
    if (this.factorForm.invalid) {
      this.mostrarErroresValidacion(false);
      return;
    }
    const payload = this.buildPayload();
    this.factoresService.agregarFactor(payload).subscribe(
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: `Se agregó un nuevo factor de manera exitosa.`,
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
        this.regresar();
      },
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Ops!',
          text: `Ocurrió un error al agregar el factor.`,
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
      },
    );
  }

  actualizar() {
    if (this.factorForm.invalid) {
      this.mostrarErroresValidacion(true);
      return;
    }
    const payload = this.buildPayload();
    this.factoresService.actualizarFactor(this.idFactor, payload).subscribe(
      () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: `Los datos del factor se actualizaron correctamente.`,
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
        this.regresar();
      },
      () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          title: '¡Ops!',
          text: `Ocurrió un error al actualizar el factor.`,
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
      },
    );
  }

  regresar() {
    this.route.navigateByUrl('/factores');
  }
}
