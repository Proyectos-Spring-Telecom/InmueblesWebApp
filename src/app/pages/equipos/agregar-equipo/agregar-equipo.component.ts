import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { EquipoService } from 'src/app/services/moduleService/equipos.service';
import { MarcaService } from 'src/app/services/moduleService/marcas.service';
import { ModeloService } from 'src/app/services/moduleService/modelos.service';
import { ProductoService } from 'src/app/services/moduleService/productos.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-agregar-equipo',
  templateUrl: './agregar-equipo.component.html',
  styleUrl: './agregar-equipo.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarEquipoComponent implements OnInit {

  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public equipoForm: FormGroup;
  public idEquipo: number;
  public title = 'Agregar Equipo';
  public listaCliente: any;
  public listaModelos: any;
  selectedFileName: string = '';
  previewUrl: string | ArrayBuffer | null = null;

  constructor(
    private fb: FormBuilder,
    private activatedRouted: ActivatedRoute,
    private route: Router,
    private clienteService: ClientesService,
    private modeloService: ModeloService,
    private equipoService: EquipoService,
    private el: ElementRef<HTMLInputElement>
  ) { }

  ngOnInit(): void {
    this.obtenerModelos()
    this.obtenerCliente()
    this.initForm();
    this.activatedRouted.params.subscribe((params) => {
      this.idEquipo = params['idEquipo'];
      if (this.idEquipo) {
        this.title = 'Actualizar Equipo';
        this.obtenerEquipo();
      }
    });
  }

  obtenerEquipo() {
    this.equipoService.obtenerEquipo(this.idEquipo).subscribe((res: any) => {
      const d = res?.data ?? res ?? {};

      const idClienteNum =
        d?.idCliente !== null && d?.idCliente !== undefined ? Number(d.idCliente) : null;

      const idModeloNum =
        d?.idModelo !== null && d?.idModelo !== undefined ? Number(d.idModelo) : null;

      const idEstadoEquipoNum =
        d?.idEstadoEquipo !== null && d?.idEstadoEquipo !== undefined ? Number(d.idEstadoEquipo) : null;

      this.equipoForm.patchValue(
        {
          id: d?.id ?? null,
          idCliente: idClienteNum,
          idModelo: idModeloNum,
          idEstadoEquipo: idEstadoEquipoNum,
          numeroSerie: d?.numeroSerie ?? null,
          ip: d?.ip ?? null,
          fechaCreacion: d?.fechaCreacion ?? null,
          fechaActualizacion: d?.fechaActualizacion ?? null,
          estatus: d?.estatus ?? null,
        },
        { emitEvent: false }
      );

      this.equipoForm.markAsPristine();
      this.equipoForm.updateValueAndValidity({ emitEvent: false });
    });
  }


  obtenerCliente() {
    this.clienteService.obtenerClientes().subscribe((response) => {
      this.listaCliente = response.data;
    })
  }

  public info: any;
  obtenerModelos() {
    this.modeloService.obtenerModelos().subscribe((response: any) => {
      this.listaModelos = response.data;
    });
  }

  initForm() {
    this.equipoForm = this.fb.group({
      numeroSerie: ['', Validators.required],
      estatus: [1],
      // ip: ['',
      //   [
      //     Validators.required,
      //     Validators.pattern(
      //       /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
      //     ),
      //   ],
      // ],
      idCliente: [null, Validators.required],
      idModelo: [null, Validators.required],
    });
  }

  maskIp(event: Event) {
    const input = event.target as HTMLInputElement;

    // 1) Mantén solo dígitos
    let v = input.value.replace(/\D/g, ''); // quita todo lo que no sea 0-9

    // 2) Agrupa en bloques de 1-3 y únelos con puntos: 1234 -> 123.4
    const parts = v.match(/\d{1,3}/g) ?? [];
    if (parts.length > 4) parts.length = 4; // máximo 4 octetos
    v = parts.join('.');

    // 3) Refleja en el input y en el FormControl (sin disparar loops)
    input.value = v;
    const ctrl = this.equipoForm?.get('ip');
    if (ctrl && ctrl.value !== v) ctrl.setValue(v, { emitEvent: false });
  }


  submit() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idEquipo) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  agregar() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.equipoForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;
      const etiquetas: any = {
        numeroSerie: 'Número Serie',
        // ip: 'IP',
        idCliente: 'Cliente',
        idModelo: 'Modelo',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.equipoForm.controls).forEach((key) => {
        const control = this.equipoForm.get(key);
        if (control?.invalid && control.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
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
              `
        )
        .join('');

      Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: '¡Faltan campos obligatorios!',
        html: `
                  <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
                    Los siguientes <strong>campos obligatorios</strong> están vacíos.<br>
                    Por favor complétalos antes de continuar:
                  </p>
                  <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
                `,
        icon: 'error',
        confirmButtonText: 'Entendido',
        customClass: {
          popup: 'swal2-padding swal2-border',
        },
      });
      return;
    }
    const payload = {
      ...this.equipoForm.value,
    };
    this.equipoForm.removeControl('id');
    this.equipoService.agregarEquipo(payload).subscribe(
      (response: any) => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: `Se agregó un nuevo equipo de manera exitosa.`,
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
        this.regresar();
      },
      (error: any) => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Ops!',
          text: `Ocurrió un error al agregar el equipo.`,
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
      }
    );
  }

  actualizar() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.equipoForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;
      const etiquetas: any = {
        numeroSerie: 'Número Serie',
        // ip: 'IP',
        idCliente: 'Cliente',
        idModelo: 'Modelo',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.equipoForm.controls).forEach((key) => {
        const control = this.equipoForm.get(key);
        if (control?.invalid && control.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
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
              `
        )
        .join('');

      Swal.fire({
        title: '¡Faltan campos obligatorios!',
        html: `
                  <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
                    Los siguientes <strong>campos obligatorios</strong> están vacíos.<br>
                    Por favor complétalos antes de continuar:
                  </p>
                  <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
                `,
        icon: 'error',
        background: '#141a21',
        color: '#ffffff',
        confirmButtonText: 'Entendido',
        customClass: {
          popup: 'swal2-padding swal2-border',
        },
      });
    }
    const payload = {
      ...this.equipoForm.value,
    };
    this.equipoService.actualizarEquipo(this.idEquipo, payload).subscribe(
      (response: any) => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: `Los datos del equipo se actualizaron correctamente.`,
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
        this.regresar();
      },
      (error: any) => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          title: '¡Ops!',
          text: `Ocurrió un error al actualizar el equipo.`,
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
          background: '#141a21',
          color: '#ffffff',
        });
      }
    );
  }

  regresar() {
    this.route.navigateByUrl('/equipos');
  }

}
