import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import {
  IncrementoPayload,
  IncrementosService,
} from 'src/app/services/moduleService/incrementos.service';
import Swal from 'sweetalert2';
import { buscarInpcHistoricoPorId, MESES_INPC, mesNombreANumero } from '../inpc-historico.data';

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
  public idIncremento: number | null = null;
  public title = 'Agregar INPC';
  readonly mesesOpciones = [...MESES_INPC];

  constructor(
    private fb: FormBuilder,
    private incrementosService: IncrementosService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.activatedRouted.params.subscribe((params) => {
      const raw = params['idIncremento'];
      const idn = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN;
      this.idIncremento = Number.isFinite(idn) && idn > 0 ? Math.floor(idn) : null;
      if (this.idIncremento != null) {
        this.title = 'Actualizar INPC';
        this.obtenerIncremento();
      } else {
        this.title = 'Agregar INPC';
      }
    });
  }

  obtenerIncremento() {
    if (this.idIncremento == null) return;

    const local = buscarInpcHistoricoPorId(this.idIncremento);
    if (local) {
      this.incrementoForm.patchValue(
        {
          anio: local.anio,
          mes: local.mes,
          valorInpc: local.valorInpc,
        },
        { emitEvent: false },
      );
      this.incrementoForm.markAsPristine();
      return;
    }

    this.incrementosService.obtenerIncremento(this.idIncremento).subscribe((res: any) => {
      const data = res?.data ?? res ?? {};
      this.incrementoForm.patchValue(
        {
          anio: data?.anio ?? new Date().getFullYear(),
          mes: data?.mes ?? '',
          valorInpc: data?.valorInpc ?? data?.porcentaje ?? 0,
        },
        { emitEvent: false },
      );
      this.incrementoForm.markAsPristine();
    });
  }

  initForm() {
    this.incrementoForm = this.fb.group({
      anio: [
        new Date().getFullYear(),
        [Validators.required, Validators.min(1990), Validators.max(2040)],
      ],
      mes: ['', Validators.required],
      valorInpc: [0, [Validators.required, Validators.min(0)]],
    });
  }

  submit() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idIncremento != null) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  private etiquetas: Record<string, string> = {
    anio: 'Año',
    mes: 'Mes',
    valorInpc: 'INPC',
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

  private buildPayload(): IncrementoPayload {
    const v = this.incrementoForm.value;
    const anio = Number(v.anio);
    const mesNombre = (v.mes ?? '').toString().trim();
    const valor = Number(v.valorInpc);
    const mesNum = mesNombreANumero(mesNombre);
    return {
      nombre: `INPC ${mesNombre} ${anio}`.trim(),
      porcentaje: Number.isFinite(valor) ? valor : 0,
      descripcion: `Registro histórico INPC (${anio}, ${mesNombre})`,
      tipoInmueble: 'COMERCIAL',
      periodicidad: 'MENSUAL',
      mesAplicacion: mesNum,
      indiceReferencia: `INPC ${anio}`,
    };
  }

  agregar() {
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
    if (this.idIncremento == null) {
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
