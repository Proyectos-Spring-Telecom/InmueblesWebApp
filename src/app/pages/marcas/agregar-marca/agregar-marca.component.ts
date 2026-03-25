import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { MarcaService } from 'src/app/services/moduleService/marcas.service';
import { ProductoService } from 'src/app/services/moduleService/productos.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-agregar-marca',
  templateUrl: './agregar-marca.component.html',
  styleUrl: './agregar-marca.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarMarcaComponent {

  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public listaModulos: any;
  public marcaForm: FormGroup;
  public idMarca: number;
  public title = 'Agregar Marca';
  public listaClientes: any[] = [];
  selectedFileName: string = '';
  previewUrl: string | ArrayBuffer | null = null;
  public listaProductos: any;

  constructor(
    private fb: FormBuilder,
    private marcaService: MarcaService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
    private productoService: ProductoService
  ) { }

  ngOnInit(): void {
    this.obtenerProductos()
    this.initForm();
    this.activatedRouted.params.subscribe((params) => {
      this.idMarca = params['idMarca'];
      if (this.idMarca) {
        this.title = 'Actualizar Marca';
        this.obtenerMarca();
      }
    });
  }

  obtenerProductos() {
    this.productoService.obtenerProductos().subscribe((response) => {
      this.listaProductos = response.data;
    })
  }

  public info: any;
  obtenerMarca() {
    this.marcaService.obtenerMarca(this.idMarca).subscribe((res: any) => {
      const data = res?.data ?? res ?? {};
      const idProductoNum =
        data?.idProducto !== null && data?.idProducto !== undefined
          ? Number(data.idProducto)
          : null;

      this.marcaForm.patchValue(
        {
          id: data?.id ?? null,
          idProducto: idProductoNum,
          nombre: data?.nombre ?? null,
          descripcion: data?.descripcion ?? null,
          fechaCreacion: data?.fechaCreacion ?? null,
          fechaActualizacion: data?.fechaActualizacion ?? null,
          estatus: data?.estatus ?? null,
        },
        { emitEvent: false }
      );

      this.marcaForm.markAsPristine();
    });
  }

  initForm() {
    this.marcaForm = this.fb.group({
      nombre: ['', Validators.required],
      idProducto: [null, Validators.required],
      estatus: [1]
    });
  }

  submit() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idMarca) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  agregar() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.marcaForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;
      const etiquetas: any = {
        nombre: 'Nombre',
        idProducto: 'Producto'
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.marcaForm.controls).forEach((key) => {
        const control = this.marcaForm.get(key);
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
      ...this.marcaForm.value,
    };
    this.marcaForm.removeControl('id');
    this.marcaService.agregarMarca(payload).subscribe(
      (response: any) => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: `Se agregó una nueva marca de manera exitosa.`,
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
          text: `Ocurrió un error al agregar la marca.`,
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
    if (this.marcaForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;
      const etiquetas: any = {
        nombre: 'Nombre',
        idProducto: 'Producto'
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.marcaForm.controls).forEach((key) => {
        const control = this.marcaForm.get(key);
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
      ...this.marcaForm.value,
    };
    this.marcaService.actualizarMarca(this.idMarca, payload).subscribe(
      (response: any) => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: `Los datos de la marca se actualizaron correctamente.`,
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
          text: `Ocurrió un error al actualizar la marca.`,
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
    this.route.navigateByUrl('/marcas');
  }
}
