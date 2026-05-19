import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import {
  CatMetodoPagoPayload,
  CatMetodosPagoService,
} from 'src/app/services/moduleService/cat-metodos-pago.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-agregar-metodo-pago',
  templateUrl: './agregar-metodo-pago.component.html',
  styleUrl: './agregar-metodo-pago.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarMetodoPagoComponent implements OnInit {
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public metodoPagoForm: FormGroup;
  public idMetodoPago: number | null = null;
  public title = 'Agregar método de pago';

  constructor(
    private fb: FormBuilder,
    private catMetodosPagoService: CatMetodosPagoService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.activatedRouted.params.subscribe((params) => {
      const raw = params['idMetodoPago'];
      const idn = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN;
      this.idMetodoPago = Number.isFinite(idn) && idn > 0 ? Math.floor(idn) : null;
      if (this.idMetodoPago != null) {
        this.title = 'Editar método de pago';
        this.submitButton = 'Actualizar';
        this.obtenerMetodoPago();
      } else {
        this.title = 'Agregar método de pago';
        this.submitButton = 'Guardar';
      }
    });
  }

  obtenerMetodoPago() {
    if (this.idMetodoPago == null) return;

    this.catMetodosPagoService.obtenerMetodoPago(this.idMetodoPago).subscribe({
      next: (res: unknown) => {
        const bag = res as Record<string, unknown>;
        const raw = (bag?.['data'] ?? res) as Record<string, unknown>;
        const nombre = raw?.['nombre'];
        this.metodoPagoForm.patchValue(
          {
            nombre: nombre != null ? String(nombre).trim() : '',
          },
          { emitEvent: false },
        );
        this.metodoPagoForm.markAsPristine();
      },
      error: () => {
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cargar el método de pago.',
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
    this.metodoPagoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.maxLength(200)]],
    });
  }

  submit() {
    this.loading = true;
    if (this.idMetodoPago != null) {
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
      text: 'Indique un nombre de método de pago válido.',
      icon: 'error',
      confirmButtonText: 'Entendido',
    });
  }

  private buildPayload(): CatMetodoPagoPayload {
    const nombre = String(this.metodoPagoForm.value?.nombre ?? '').trim();
    return { nombre };
  }

  agregar() {
    if (this.metodoPagoForm.invalid) {
      this.mostrarErroresValidacion(false);
      return;
    }
    const payload = this.buildPayload();
    this.catMetodosPagoService.registrarMetodoPago(payload).subscribe({
      next: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: 'Operación exitosa',
          text: 'El método de pago se registró correctamente.',
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
          text: 'No fue posible registrar el método de pago.',
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
    if (this.idMetodoPago == null) {
      this.submitButton = 'Actualizar';
      this.loading = false;
      return;
    }
    if (this.metodoPagoForm.invalid) {
      this.mostrarErroresValidacion(true);
      return;
    }
    const payload = this.buildPayload();
    this.catMetodosPagoService.actualizarMetodoPago(this.idMetodoPago, payload).subscribe({
      next: () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          title: 'Operación exitosa',
          text: 'El método de pago se actualizó correctamente.',
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
          text: 'No fue posible actualizar el método de pago.',
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
    this.route.navigateByUrl('/metodos-pago');
  }
}
