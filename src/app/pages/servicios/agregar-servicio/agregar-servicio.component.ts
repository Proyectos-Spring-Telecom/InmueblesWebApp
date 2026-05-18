import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import {
  CatServicioPayload,
  CatServiciosService,
} from 'src/app/services/moduleService/cat-servicios.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-agregar-servicio',
  templateUrl: './agregar-servicio.component.html',
  styleUrl: './agregar-servicio.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarServicioComponent implements OnInit {
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public servicioForm: FormGroup;
  public idServicio: number | null = null;
  public title = 'Agregar servicio';

  constructor(
    private fb: FormBuilder,
    private catServiciosService: CatServiciosService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.activatedRouted.params.subscribe((params) => {
      const raw = params['idServicio'];
      const idn = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN;
      this.idServicio = Number.isFinite(idn) && idn > 0 ? Math.floor(idn) : null;
      if (this.idServicio != null) {
        this.title = 'Editar servicio';
        this.submitButton = 'Actualizar';
        this.obtenerServicio();
      } else {
        this.title = 'Agregar servicio';
        this.submitButton = 'Guardar';
      }
    });
  }

  obtenerServicio() {
    if (this.idServicio == null) return;

    this.catServiciosService.obtenerServicio(this.idServicio).subscribe({
      next: (res: unknown) => {
        const bag = res as Record<string, unknown>;
        const raw = (bag?.['data'] ?? res) as Record<string, unknown>;
        const nombre = raw?.['nombre'] ?? raw?.['servicio'];
        this.servicioForm.patchValue(
          {
            nombre: nombre != null ? String(nombre).trim() : '',
          },
          { emitEvent: false },
        );
        this.servicioForm.markAsPristine();
      },
      error: () => {
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar el servicio.',
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

  initForm() {
    this.servicioForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(200)]],
    });
  }

  submit() {
    this.loading = true;
    if (this.idServicio != null) {
      this.submitButton = 'Cargando...';
      this.actualizar();
    } else {
      this.submitButton = 'Cargando...';
      this.agregar();
    }
  }

  private mostrarErroresValidacion(esActualizar: boolean) {
    this.submitButton = esActualizar ? 'Actualizar' : 'Guardar';
    this.loading = false;
    Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: 'Revise el formulario',
      text: 'Indique un nombre de servicio válido.',
      icon: 'error',
      confirmButtonText: 'Entendido',
    });
  }

  private buildPayload(): CatServicioPayload {
    const nombre = String(this.servicioForm.value?.nombre ?? '').trim();
    return { nombre };
  }

  agregar() {
    if (this.servicioForm.invalid) {
      this.mostrarErroresValidacion(false);
      return;
    }
    const payload = this.buildPayload();
    this.catServiciosService.registrarServicio(payload).subscribe({
      next: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: 'Operación exitosa',
          text: 'El servicio se registró correctamente.',
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
          title: 'Error',
          text: 'No fue posible registrar el servicio.',
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
      },
    });
  }

  actualizar() {
    if (this.idServicio == null) {
      this.submitButton = 'Actualizar';
      this.loading = false;
      return;
    }
    if (this.servicioForm.invalid) {
      this.mostrarErroresValidacion(true);
      return;
    }
    const payload = this.buildPayload();
    this.catServiciosService.actualizarServicio(this.idServicio, payload).subscribe({
      next: () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          title: 'Operación exitosa',
          text: 'El servicio se actualizó correctamente.',
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
          title: 'Error',
          text: 'No fue posible actualizar el servicio.',
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
    this.route.navigateByUrl('/servicios');
  }
}
