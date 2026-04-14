import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import {
  IncrementoPayload,
  IncrementosService,
} from 'src/app/services/moduleService/incrementos.service';
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
  public title = 'Agregar INPC';

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
        this.title = 'Actualizar INPC';
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
          descripcion: data?.descripcion ?? '',
          tipoInmueble: data?.tipoInmueble ?? '',
          periodicidad: data?.periodicidad ?? '',
          mesAplicacion:
            data?.mesAplicacion != null && data?.mesAplicacion !== ''
              ? Number(data.mesAplicacion)
              : null,
          indiceReferencia: data?.indiceReferencia ?? '',
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
      descripcion: ['', [Validators.maxLength(2000)]],
      tipoInmueble: ['', Validators.required],
      periodicidad: ['', Validators.required],
      mesAplicacion: [null as number | null],
      indiceReferencia: ['', [Validators.maxLength(120)]],
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
    descripcion: 'Descripción',
    tipoInmueble: 'Tipo de inmueble',
    periodicidad: 'Periodicidad',
    mesAplicacion: 'Mes de aplicación',
    indiceReferencia: 'Índice o referencia',
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

  private validarMesOpcional(): boolean {
    const v = this.incrementoForm.get('mesAplicacion')?.value;
    if (v === null || v === undefined || v === '') {
      return true;
    }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 1 || n > 12) {
      Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: 'Mes de aplicación',
        text: 'Indique un mes entre 1 y 12, o deje el campo vacío.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Entendido',
      });
      return false;
    }
    return true;
  }

  private buildPayload(): IncrementoPayload {
    const v = this.incrementoForm.value;
    const mesRaw = v.mesAplicacion;
    let mes: number | null = null;
    if (mesRaw !== null && mesRaw !== undefined && mesRaw !== '') {
      const n = Number(mesRaw);
      mes = Number.isFinite(n) ? n : null;
    }
    return {
      nombre: (v.nombre ?? '').trim(),
      porcentaje: Number(v.porcentaje),
      descripcion: (v.descripcion ?? '').trim() || null,
      tipoInmueble: (v.tipoInmueble ?? '').trim() || null,
      periodicidad: (v.periodicidad ?? '').trim() || null,
      mesAplicacion: mes != null && !Number.isNaN(mes) ? mes : null,
      indiceReferencia: (v.indiceReferencia ?? '').trim() || null,
    };
  }

  agregar() {
    if (!this.validarMesOpcional()) {
      this.submitButton = 'Guardar';
      this.loading = false;
      return;
    }
    if (this.incrementoForm.invalid) {
      this.mostrarErroresValidacion(false);
      return;
    }
    const payload = this.buildPayload();
    this.incrementosService.agregarIncremento(payload).subscribe(
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: `Se agregó un nuevo registro de INPC de manera exitosa.`,
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
          text: `Ocurrió un error al agregar el registro de INPC.`,
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
    if (!this.validarMesOpcional()) {
      this.submitButton = 'Actualizar';
      this.loading = false;
      return;
    }
    if (this.incrementoForm.invalid) {
      this.mostrarErroresValidacion(true);
      return;
    }
    const payload = this.buildPayload();
    this.incrementosService.actualizarIncremento(this.idIncremento, payload).subscribe(
      () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: `Los datos del registro de INPC se actualizaron correctamente.`,
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
          text: `Ocurrió un error al actualizar el registro de INPC.`,
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
