import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { MarcaService } from 'src/app/services/moduleService/marcas.service';
import { ModeloService } from 'src/app/services/moduleService/modelos.service';
import { ProductoService } from 'src/app/services/moduleService/productos.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-agregar-modelo',
  templateUrl: './agregar-modelo.component.html',
  styleUrl: './agregar-modelo.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarModeloComponent implements OnInit {

  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public modeloForm: FormGroup;
  public idModelo: number;
  public title = 'Agregar Modelo';
  public listaClientes: any[] = [];
  public listaProductos: any;
  public listaMarcas: any;
  selectedFileName: string = '';
  previewUrl: string | ArrayBuffer | null = null;

  constructor(
    private fb: FormBuilder,
    private modeloService: ModeloService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
    private productoService: ProductoService,
    private marcaService: MarcaService
  ) { }

  ngOnInit(): void {
    this.obtenerMarcas()
    this.obtenerProductos()
    this.initForm();
    this.activatedRouted.params.subscribe((params) => {
      this.idModelo = params['idModelo'];
      if (this.idModelo) {
        this.title = 'Actualizar Modelo';
        this.obtenerModelo();
      }
    });
  }

  obtenerModelo() {
    this.modeloService.obtenerModelo(this.idModelo).subscribe((res: any) => {
      const data = res?.data ?? res ?? {};

      // Toma idProducto desde cualquiera de las variantes y normaliza a number
      const rawIdProducto =
        Object.prototype.hasOwnProperty.call(data, 'idProducto')
          ? data.idProducto
          : Object.prototype.hasOwnProperty.call(data, '_idProducto')
            ? data._idProducto
            : null;
      const idProductoNum =
        rawIdProducto !== null && rawIdProducto !== undefined
          ? Number(rawIdProducto)
          : null;

      // Si tu form incluye marca, normaliza también
      const rawIdMarca =
        Object.prototype.hasOwnProperty.call(data, 'idMarca')
          ? data.idMarca
          : data?.marca?.id ?? null;
      const idMarcaNum =
        rawIdMarca !== null && rawIdMarca !== undefined
          ? Number(rawIdMarca)
          : null;

      this.modeloForm.patchValue(
        {
          id: data?.id ?? null,
          idProducto: idProductoNum,
          idMarca: idMarcaNum,
          nombre: data?.nombre ?? null,
          descripcion: data?.descripcion ?? null,
          fechaCreacion: data?.fechaCreacion ?? null,
          fechaActualizacion: data?.fechaActualizacion ?? null,
          estatus: data?.estatus ?? null,
        },
        { emitEvent: false }
      );
      this.modeloForm.markAsPristine();
      this.modeloForm.updateValueAndValidity({ emitEvent: false });
    });
  }


  obtenerProductos() {
    this.productoService.obtenerProductos().subscribe((response) => {
      this.listaProductos = response.data;
    })
  }

  public info: any;
  obtenerMarcas() {
    this.marcaService.obtenerMarcas().subscribe((response: any) => {
      this.listaMarcas = response.data;
    });
  }

  initForm() {
    this.modeloForm = this.fb.group({
      nombre: ['', Validators.required],
      idProducto: [null, Validators.required],
      idMarca: [null, Validators.required],
      estatus: [1]
    });
  }

  submit() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idModelo) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  agregar() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.modeloForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;
      const etiquetas: any = {
        nombre: 'Nombre',
        idProducto: 'Producto',
        idMarca: 'Marca'
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.modeloForm.controls).forEach((key) => {
        const control = this.modeloForm.get(key);
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
      ...this.modeloForm.value,
    };
    this.modeloForm.removeControl('id');
    this.modeloService.agregarModelo(payload).subscribe(
      (response: any) => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: `Se agregó un nuevo modelo de manera exitosa.`,
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
          text: `Ocurrió un error al agregar el modelo.`,
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
    if (this.modeloForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;
      const etiquetas: any = {
        nombre: 'Nombre',
        idProducto: 'Producto',
        idMarca: 'Marca'
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.modeloForm.controls).forEach((key) => {
        const control = this.modeloForm.get(key);
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
      ...this.modeloForm.value,
    };
    this.modeloService.actualizarModelo(this.idModelo, payload).subscribe(
      (response: any) => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          title: '¡Operación Exitosa!',
          text: `Los datos del modelo se actualizaron correctamente.`,
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
          text: `Ocurrió un error al actualizar el modelo.`,
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
    this.route.navigateByUrl('/modelos');
  }

}
