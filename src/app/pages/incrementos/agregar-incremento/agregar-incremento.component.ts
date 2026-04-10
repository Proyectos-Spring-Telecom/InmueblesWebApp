import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { IncrementosService } from 'src/app/services/moduleService/incrementos.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-agregar-incremento',
  templateUrl: './agregar-incremento.component.html',
  styleUrl: './agregar-incremento.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarIncrementoComponent implements OnInit {
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public incrementoForm: FormGroup;
  public idIncremento: number;
  public title = 'Agregar Incremento';

  constructor(
    private fb: FormBuilder,
    private incrementosService: IncrementosService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.activatedRouted.params.subscribe((params) => {
      this.idIncremento = params['idIncremento'];
      if (this.idIncremento) {
        this.title = 'Actualizar Incremento';
        this.obtenerIncremento();
      }
    });
  }

  obtenerIncremento() {
    this.incrementosService.obtenerIncremento(this.idIncremento).subscribe((res: any) => {
      const data = res?.data ?? res ?? {};
      this.incrementoForm.patchValue(
        {
          nombre: data?.nombre ?? '',
          porcentaje: data?.porcentaje ?? 0,
        },
        { emitEvent: false },
      );
      this.incrementoForm.markAsPristine();
    });
  }

  initForm() {
    this.incrementoForm = this.fb.group({
      nombre: ['', Validators.required],
      porcentaje: [0, [Validators.required, Validators.min(0)]],
    });
  }

  submit() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idIncremento) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  private etiquetas: Record<string, string> = {
    nombre: 'Nombre',
    porcentaje: 'Porcentaje',
  };

  private mostrarErroresValidacion(esActualizar: boolean) {
    this.submitButton = esActualizar ? 'Actualizar' : 'Guardar';
    this.loading = false;
    const camposFaltantes: string[] = [];
    Object.keys(this.incrementoForm.controls).forEach((key) => {
      const control = this.incrementoForm.get(key);
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

  agregar() {
    if (this.incrementoForm.invalid) {
      this.mostrarErroresValidacion(false);
      return;
    }
    const payload = {
      nombre: this.incrementoForm.value.nombre,
      porcentaje: Number(this.incrementoForm.value.porcentaje),
    };
    this.incrementosService.agregarIncremento(payload).subscribe(
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: `Se agregó un nuevo incremento de manera exitosa.`,
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
          text: `Ocurrió un error al agregar el incremento.`,
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
    if (this.incrementoForm.invalid) {
      this.mostrarErroresValidacion(true);
      return;
    }
    const payload = {
      nombre: this.incrementoForm.value.nombre,
      porcentaje: Number(this.incrementoForm.value.porcentaje),
    };
    this.incrementosService.actualizarIncremento(this.idIncremento, payload).subscribe(
      () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: `Los datos del incremento se actualizaron correctamente.`,
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
          text: `Ocurrió un error al actualizar el incremento.`,
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
    this.route.navigateByUrl('/incrementos');
  }
}
