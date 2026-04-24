import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import Swal from 'sweetalert2';

/** Fila del grid; alinea `dataField` con los `formControlName` del formulario. */
interface EstacionamientoGridFila {
  id: number;
  nombrePensionado: string;
  numeroTarjeta: string;
  arrendatario: string;
}

@Component({
  selector: 'app-agregar-estacionamiento',
  templateUrl: './agregar-estacionamiento.component.html',
  styleUrl: './agregar-estacionamiento.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarEstacionamientoComponent implements OnInit {
  @ViewChild('gridEstacionamiento', { static: false })
  dataGrid!: DxDataGridComponent;

  public submitButton = 'Guardar';
  public loading = false;
  public estacionamientoForm!: FormGroup;
  public idEstacionamiento!: number;
  public title = 'Agregar Estacionamiento';

  /** Estacionamientos de ejemplo asociados al inmueble (misma estructura que el formulario). */
  public filasEstacionamientosGrid: EstacionamientoGridFila[] = [];

  /** Nombre del inmueble (`inmuebleNombre` en la URL, p. ej. desde Monitoreo). */
  public nombreInmuebleParaTitulo = '';

  /** Opciones de grid alineadas con `lista-permisos`. */
  public showFilterRow = true;
  public showHeaderFilter = true;
  public autoExpandAllGroups = true;
  public pageSize = 100;
  public mensajeAgrupar =
    'Arrastre un encabezado de columna aquí para agrupar por esa columna';

  /** Si se entró desde Monitoreo, Cancelar vuelve a la lista de inmuebles allí. */
  private volverAMonitoreoListaInmuebles = false;
  private idClienteParaMonitoreo: string | null = null;

  constructor(
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const q = this.activatedRoute.snapshot.queryParamMap;
    this.volverAMonitoreoListaInmuebles = q.get('desdeMonitoreo') === '1';
    this.idClienteParaMonitoreo = q.get('idCliente');

    const inmuebleId = q.get('inmuebleId');
    const inmuebleNombre = q.get('inmuebleNombre')?.trim() ?? '';
    this.nombreInmuebleParaTitulo = inmuebleNombre;
    this.filasEstacionamientosGrid = this.construirFilasDemoPorInmueble(
      inmuebleId,
      inmuebleNombre,
    );

    this.initForm();

    this.activatedRoute.params.subscribe((params) => {
      this.idEstacionamiento = params['idEstacionamiento'];
      if (this.idEstacionamiento) {
        this.title = 'Actualizar Estacionamiento';
      }
    });
  }

  initForm(): void {
    this.estacionamientoForm = this.fb.group({
      nombrePensionado: ['', Validators.required],
      numeroTarjeta: ['', Validators.required],
      arrendatario: ['', Validators.required],
    });
  }

  /**
   * Filas coherentes con el inmueble (demo): códigos de tarjeta derivados del id y
   * arrendatarios que mencionan el nombre del predio cuando existe.
   */
  private construirFilasDemoPorInmueble(
    inmuebleId: string | null,
    inmuebleNombre: string,
  ): EstacionamientoGridFila[] {
    const idDigits = (inmuebleId ?? '')
      .replace(/\D/g, '')
      .padStart(4, '0')
      .slice(-4);
    const codigo = idDigits || '1000';
    const predio =
      inmuebleNombre.trim() ||
      (inmuebleId && inmuebleId !== 'sin-id'
        ? `Predio ${inmuebleId}`
        : 'Edificio corporativo');

    const cortoPredio =
      predio.length > 48 ? `${predio.slice(0, 45).trimEnd()}…` : predio;

    return [
      {
        id: 1,
        nombrePensionado: 'Lic. Patricia Morales',
        numeroTarjeta: `EST-${codigo}-A`,
        arrendatario: `${cortoPredio} — Dirección general`,
      },
      {
        id: 2,
        nombrePensionado: 'Ing. Hugo Salinas',
        numeroTarjeta: `EST-${codigo}-B`,
        arrendatario: `Visitas y proveedores (${cortoPredio})`,
      },
      {
        id: 3,
        nombrePensionado: 'María Elena Vázquez',
        numeroTarjeta: `EST-${codigo}-C`,
        arrendatario: 'Spring Telecom México',
      },
    ];
  }

  submit(): void {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idEstacionamiento) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  agregar(): void {
    if (this.estacionamientoForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;
      this.showRequiredFieldsError();
      return;
    }

    this.submitButton = 'Guardar';
    this.loading = false;
    Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: '¡Operación Exitosa!',
      text: 'Se agregó el registro de estacionamiento de manera exitosa.',
      icon: 'success',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Confirmar',
    });
    this.regresar();
  }

  actualizar(): void {
    if (this.estacionamientoForm.invalid) {
      this.submitButton = 'Actualizar';
      this.loading = false;
      this.showRequiredFieldsError();
      return;
    }

    this.submitButton = 'Actualizar';
    this.loading = false;
    Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: '¡Operación Exitosa!',
      text: 'Se actualizó el registro de estacionamiento correctamente.',
      icon: 'success',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Confirmar',
    });
    this.regresar();
  }

  private showRequiredFieldsError(): void {
    const labels: Record<string, string> = {
      nombrePensionado: 'Nombre del pensionado',
      numeroTarjeta: 'Número de tarjeta',
      arrendatario: 'Arrendatario',
    };
    const missing: string[] = [];
    Object.keys(this.estacionamientoForm.controls).forEach((key) => {
      const control = this.estacionamientoForm.get(key);
      if (control?.invalid && control.errors?.['required']) {
        missing.push(labels[key] || key);
      }
    });

    const list = missing
      .map(
        (field, index) => `
          <div style="padding: 8px 12px; border-left: 4px solid #d9534f;
                      background: #caa8a8; text-align: center; margin-bottom: 8px;
                      border-radius: 4px;">
            <strong style="color: #b02a37;">${index + 1}. ${field}</strong>
          </div>
        `,
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
        <div style="max-height: 350px; overflow-y: auto;">${list}</div>
      `,
      icon: 'error',
      confirmButtonText: 'Entendido',
    });
  }

  /** Tras guardar correctamente: siempre al listado del módulo estacionamiento. */
  regresar(): void {
    void this.router.navigateByUrl('/estacionamiento');
  }

  /** Cancelar: si vino desde Monitoreo, vuelve a la lista de inmuebles; si no, al listado de estacionamiento. */
  cancelar(): void {
    if (this.volverAMonitoreoListaInmuebles) {
      const qp: Record<string, string> = { retorno: 'inmuebles' };
      const idc = this.idClienteParaMonitoreo?.trim();
      if (idc) qp['idCliente'] = idc;
      void this.router.navigate(['/monitoreo'], { queryParams: qp });
      return;
    }
    void this.router.navigateByUrl('/estacionamiento');
  }

  onPageIndexChanged(e: any): void {
    e.component.refresh();
  }

  onGridOptionChanged(_e: any): void {
    /* Lista permisos filtra búsqueda contra el store; aquí el panel de búsqueda actúa sobre el arreglo local. */
  }

  limpiarCamposGrid(): void {
    const g = this.dataGrid?.instance;
    if (!g) return;
    g.clearGrouping();
    g.clearFilter();
    g.searchByText('');
    g.refresh();
  }

  toggleExpandGroups(): void {
    const g = this.dataGrid?.instance;
    if (!g) return;
    const groupedColumns = g
      .getVisibleColumns()
      .filter((col) => (col.groupIndex ?? -1) >= 0);
    if (groupedColumns.length === 0) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: '¡Ops!',
        text: 'Debes arrastar un encabezado de una columna para expandir o contraer grupos.',
        icon: 'warning',
        showCancelButton: false,
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Entendido',
        allowOutsideClick: false,
      });
      return;
    }
    this.autoExpandAllGroups = !this.autoExpandAllGroups;
    g.refresh();
  }
}

