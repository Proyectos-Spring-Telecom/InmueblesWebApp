import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import {
  contractDimAnim,
  contractModalAnim,
  estacionamientoFormRevealAnimation,
  routeAnimation,
} from 'src/app/pipe/module-open.animation';
import Swal from 'sweetalert2';
import { distinctUntilChanged, finalize, Subject, map, takeUntil } from 'rxjs';
import {
  EstacionamientoCrearActualizarPayload,
  EstacionamientoService,
} from 'src/app/services/moduleService/estacionamiento.service';
import { EntradasSalidasEstacionamientoService } from 'src/app/services/moduleService/entradas-salidas-estacionamiento.service';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import { extraerArrendatariosInmuebleApi } from '../../monitoreo/monitoreo-arrendatarios.mapper';
import {
  EntradaSalidaGridFila,
  extraerFilasEntradasSalidasApi,
} from '../entradas-salidas.mapper';
export interface OpcionArrendatarioSelect {
  value: number;
  label: string;
}

/** Fila del grid legible para DxDataGrid. */
interface EstacionamientoGridFila {
  id: number;
  nombrePensionado: string;
  numeroTarjeta: string;
  arrendatario: string;
  estatus: number;
}

@Component({
  selector: 'app-agregar-estacionamiento',
  templateUrl: './agregar-estacionamiento.component.html',
  styleUrl: './agregar-estacionamiento.component.scss',
  standalone: false,
  animations: [
    routeAnimation,
    estacionamientoFormRevealAnimation,
    contractDimAnim,
    contractModalAnim,
  ],
})
export class AgregarEstacionamientoComponent implements OnInit, OnDestroy {
  @ViewChild('gridEstacionamiento', { static: false })
  dataGrid!: DxDataGridComponent;

  @ViewChild('gridEntradasSalidas', { static: false })
  gridEntradasSalidas!: DxDataGridComponent;

  /** Grid del acordeón «Entradas y Salidas». */
  public filasEntradasSalidasGrid: EntradaSalidaGridFila[] = [];

  public mostrarModalEntradasSalidasExcel = false;
  public excelEntradasSalidasDragging = false;
  public excelEntradasSalidasNombre = '';
  private excelEntradasSalidasArchivo: File | null = null;
  public subiendoEntradasSalidasExcel = false;
  public autoExpandAllGroupsEntradasSalidas = true;

  public submitButton = 'Guardar';
  public loading = false;
  public estacionamientoForm!: FormGroup;
  /** Id del registro en modo edición (ruta `editar-estacionamiento/:id`). */
  public idEstacionamientoEdicion: number | null = null;
  public title = 'Estacionamientos';

  public filasEstacionamientosGrid: EstacionamientoGridFila[] = [];
  public nombreInmuebleParaTitulo = '';

  public showFilterRow = true;
  public showHeaderFilter = true;
  public autoExpandAllGroups = true;
  public pageSize = 20;
  public mensajeAgrupar =
    'Arrastre un encabezado de columna aquí para agrupar por esa columna';

  /** Alta: debe venir en query como `inmuebleId` (ej. desde Monitoreo). También puede rellenarse al cargar GET por id en edición. */
  public idInmuebleNumerico: number | null = null;

  public esModoEdicion = false;
  /** En alta el formulario inicia oculto hasta pulsar «Agregar estacionamiento». */
  public mostrarFormulario = false;

  public opcionesArrendatario: OpcionArrendatarioSelect[] = [];
  private mapaNombreArrendatario = new Map<number, string>();
  public cargandoArrendatarios = false;
  public cargandoGrid = false;
  public cargandoGridEntradasSalidas = false;

  /** Si falta contexto del inmueble en alta mostramos mensaje en plantilla (sin select de predios). */
  public sinIdInmuebleEnAlta = false;

  private readonly destroyed$ = new Subject<void>();

  private idClienteParaMonitoreo: string | null = null;

  constructor(
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private estacionamientoService: EstacionamientoService,
    private entradasSalidasService: EntradasSalidasEstacionamientoService,
    private arrendatariosService: ArrendatariosService,
  ) {}

  ngOnInit(): void {
    const qpm = this.activatedRoute.snapshot.queryParamMap;
    this.idClienteParaMonitoreo = qpm.get('idCliente');

    if (!this.nombreInmuebleParaTitulo) {
      this.nombreInmuebleParaTitulo =
        qpm.get('inmuebleNombre')?.trim().replace(/^["']+|["']+$/g, '') ?? '';
    }

    this.initForm();

    // Evita doble arranque cuando `paramMap` emite más de una vez con el mismo id (p.ej. tras PATCH):
    // repetir `arrancarModoEdicion` dispara otro GET + refresh del grid + vuelve a abrir el formulario.
    this.activatedRoute.paramMap
      .pipe(
        map((pm) => {
          const rawIdEst = pm.get('idEstacionamiento');
          if (rawIdEst == null || String(rawIdEst).trim() === '') return null;
          const idEst = Number(String(rawIdEst).trim());
          return Number.isFinite(idEst) && idEst > 0 ? Math.floor(idEst) : null;
        }),
        distinctUntilChanged((prev, curr) => prev === curr),
        takeUntil(this.destroyed$),
      )
      .subscribe((idEst) => {
        if (idEst != null) {
          void this.arrancarModoEdicion(idEst);
          return;
        }
        this.arrancarModoAlta();
      });
  }

  /** Evita submit nativo del `<form>` (p. ej. Enter), que puede recargar toda la página. */
  onFormularioEstacionamientoSubmit(event: SubmitEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  /** Muestra el formulario en alta (tras ocultarlo al cargar la vista). */
  abrirFormularioAlta(): void {
    if (this.idInmuebleNumerico == null || this.esModoEdicion) return;
    this.mostrarFormulario = true;
    this.estacionamientoForm.patchValue({
      nombrePensionado: '',
      numeroTarjeta: '',
      idArrendatario: null,
    });
    this.estacionamientoForm.markAsUntouched();
  }

  puedeMostrarBotonAgregar(): boolean {
    return (
      !this.esModoEdicion &&
      this.idInmuebleNumerico != null &&
      !this.mostrarFormulario &&
      !this.sinIdInmuebleEnAlta
    );
  }

  /** En edición, si Cancelar ocultó el panel permite volver a mostrar el formulario sin salir de esta vista. */
  puedeMostrarBotonContinuarEditando(): boolean {
    return (
      this.esModoEdicion &&
      !this.mostrarFormulario &&
      this.idEstacionamientoEdicion != null &&
      !this.loading
    );
  }

  abrirPanelFormularioEdicion(): void {
    if (!this.esModoEdicion) return;
    this.mostrarFormulario = true;
  }

  /** Botón Cancelar junto a Guardar: solo oculta el formulario en esta vista (sin navegar). */
  cancelar(): void {
    this.mostrarFormulario = false;
    if (this.esModoEdicion) return;
    this.estacionamientoForm.patchValue({
      nombrePensionado: '',
      numeroTarjeta: '',
      idArrendatario: null,
    });
    this.estacionamientoForm.markAsUntouched();
  }

  private arrancarModoAlta(): void {
    this.esModoEdicion = false;
    this.idEstacionamientoEdicion = null;
    this.title = 'Agregar Estacionamiento';
    this.mostrarFormulario = false;
    this.loading = false;
    this.submitButton = 'Guardar';

    const q = this.activatedRoute.snapshot.queryParamMap;
    const rawImm = q.get('inmuebleId');
    const n = Number(String(rawImm ?? '').trim());
    const ok = Number.isFinite(n) && n > 0;
    this.idInmuebleNumerico = ok ? Math.floor(n) : null;
    this.sinIdInmuebleEnAlta = !this.esModoEdicion && !ok;

    if (!this.nombreInmuebleParaTitulo) {
      const nom = q.get('inmuebleNombre');
      if (nom) this.nombreInmuebleParaTitulo = nom.trim().replace(/^["']+|["']+$/g, '');
    }

    if (this.idInmuebleNumerico != null) {
      this.recargarArrendatariosYGrid();
      this.cargarGridEntradasSalidas();
      return;
    }

    this.filasEstacionamientosGrid = [];
    this.filasEntradasSalidasGrid = [];
    this.opcionesArrendatario = [];
    this.mapaNombreArrendatario.clear();
    this.estacionamientoForm.patchValue({
      nombrePensionado: '',
      numeroTarjeta: '',
      idArrendatario: null,
    });
  }

  private arrancarModoEdicion(idEstacionamiento: number): void {
    this.esModoEdicion = true;
    this.mostrarFormulario = true;
    this.title = 'Actualizar Estacionamiento';
    this.submitButton = 'Actualizar';
    this.idEstacionamientoEdicion = idEstacionamiento;
    this.sinIdInmuebleEnAlta = false;
    this.loading = true;

    this.estacionamientoService
      .obtenerPorId(idEstacionamiento)
      .pipe(
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (resp) => {
          const datos = this.registroEstacionamientoDesdeApi(resp);
          if (!datos) {
            void this.mensajeFalloDatosYCerrar();
            return;
          }
          const idImm = datos.idInmueble;
          if (!Number.isFinite(idImm) || idImm <= 0) {
            void Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: 'Inmueble no identificado',
              text:
                'No se pudo determinar el inmueble del estacionamiento. Revise los datos del servicio.',
              icon: 'error',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Entendido',
            });
            return;
          }
          this.idInmuebleNumerico = Math.floor(idImm);
          this.arrendatariosService
            .obtenerArrendatariosPorInmueble(this.idInmuebleNumerico)
            .pipe(map((r) => extraerArrendatariosInmuebleApi(r)), takeUntil(this.destroyed$))
            .subscribe({
              next: (filasArr) => {
                this.actualizarOpcionesArrendatario(filasArr);
                const idSel = datos.idArrendatario;
                const existeOpcion =
                  idSel > 0 &&
                  this.opcionesArrendatario.some(
                    (o) => o.value === Math.floor(idSel),
                  );
                const idValor =
                  existeOpcion && idSel > 0 ? Math.floor(idSel) : null;
                this.estacionamientoForm.patchValue({
                  nombrePensionado: datos.nombrePensionado,
                  numeroTarjeta: datos.numeroTarjeta,
                  idArrendatario: idValor,
                });
                this.estacionamientoForm.markAsPristine();
                this.recargarSoloGrid();
                this.cargarGridEntradasSalidas();
              },
              error: (_err) => {
                void Swal.fire({
                  background: '#141a21',
                  color: '#ffffff',
                  title: 'No se cargaron los arrendatarios',
                  text:
                    'Intente nuevamente. Si persiste el error puede continuar cargando otros datos desde la vista.',
                  icon: 'warning',
                  confirmButtonColor: '#3085d6',
                  confirmButtonText: 'Entendido',
                });
                this.actualizarOpcionesArrendatario([]);
                this.estacionamientoForm.patchValue({
                  nombrePensionado: datos.nombrePensionado,
                  numeroTarjeta: datos.numeroTarjeta,
                  idArrendatario:
                    datos.idArrendatario > 0
                      ? Math.floor(datos.idArrendatario)
                      : null,
                });
                this.recargarSoloGrid();
                this.cargarGridEntradasSalidas();
              },
            });
        },
        error: (_err) => {
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: 'Error al cargar el estacionamiento',
            icon: 'error',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Entendido',
          });
          void this.router.navigateByUrl('/estacionamiento');
        },
      });
  }

  private async mensajeFalloDatosYCerrar(): Promise<void> {
    await Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: 'Datos incompletos',
      text:
        'El servicio no devolvió la información esperada del estacionamiento.',
      icon: 'error',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Entendido',
    });
    void this.router.navigateByUrl('/estacionamiento');
  }

  initForm(): void {
    this.estacionamientoForm = this.fb.group({
      nombrePensionado: ['', Validators.required],
      numeroTarjeta: ['', Validators.required],
      idArrendatario: [null as number | null, Validators.required],
    });
  }

  private recargarArrendatariosYGrid(): void {
    const idImm = this.idInmuebleNumerico;
    if (idImm == null) return;
    this.cargandoArrendatarios = true;
    this.arrendatariosService
      .obtenerArrendatariosPorInmueble(idImm)
      .pipe(
        map((resp) => extraerArrendatariosInmuebleApi(resp)),
        finalize(() => {
          this.cargandoArrendatarios = false;
        }),
        takeUntil(this.destroyed$),
      )
      .subscribe({
        next: (filas) => {
          this.actualizarOpcionesArrendatario(filas);
          this.estacionamientoForm.patchValue({
            idArrendatario: null,
          });
          this.estacionamientoForm.markAsUntouched();
          this.recargarSoloGrid();
          this.cargarGridEntradasSalidas();
        },
        error: (_err) => {
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: 'No se cargaron los arrendatarios',
            text:
              'Revise que el predio sea correcto o intente nuevamente más tarde.',
            icon: 'error',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Entendido',
          });
          this.recargarSoloGrid();
          this.cargarGridEntradasSalidas();
        },
      });
  }

  /** GET paginado por idInmueble → grid Entradas y Salidas. */
  cargarGridEntradasSalidas(): void {
    const idImm = this.idInmuebleNumerico;
    if (idImm == null || idImm <= 0) {
      this.filasEntradasSalidasGrid = [];
      return;
    }
    this.cargandoGridEntradasSalidas = true;
    this.entradasSalidasService
      .listarPaginado({ idInmueble: idImm, page: 1, limit: 500 })
      .pipe(
        map((resp) => extraerFilasEntradasSalidasApi(resp)),
        finalize(() => {
          this.cargandoGridEntradasSalidas = false;
        }),
        takeUntil(this.destroyed$),
      )
      .subscribe({
        next: (filas) => {
          this.filasEntradasSalidasGrid = filas;
          this.gridEntradasSalidas?.instance?.refresh();
        },
        error: () => {
          /* void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: 'Entradas y salidas',
            text: 'No se pudo cargar el listado. Intente nuevamente.',
            icon: 'warning',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Entendido',
          }); */
        },
      });
  }

  private recargarSoloGrid(): void {
    const idImm = this.idInmuebleNumerico;
    if (idImm == null) {
      this.filasEstacionamientosGrid = [];
      return;
    }
    this.cargandoGrid = true;
    this.estacionamientoService
      .listarPorInmueble(idImm)
      .pipe(
        map((resp) => this.extraerFilasListaEstacionamiento(resp)),
        finalize(() => {
          this.cargandoGrid = false;
        }),
        takeUntil(this.destroyed$),
      )
      .subscribe({
        next: (filas) => {
          this.filasEstacionamientosGrid = filas.map((r) =>
            this.filaGridDesdeRaw(r),
          );
        },
        error: (_err) => {
          Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: 'Lista de estacionamientos',
            text:
              'No se pudo cargar el listado del inmueble. Se mantiene la tabla que ya tenía en pantalla.',
            icon: 'warning',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Entendido',
          });
        },
      });
  }

  /** Actualiza una fila en memoria sin volver a pedir el listado (no resetea filtros ni página del grid). */
  private aplicarEstatusFilaGrid(idFila: number, estatus: 0 | 1): void {
    const ix = this.filasEstacionamientosGrid.findIndex((r) => r.id === idFila);
    if (ix < 0) return;
    const copia = [...this.filasEstacionamientosGrid];
    copia[ix] = { ...copia[ix], estatus };
    this.filasEstacionamientosGrid = copia;
  }

  private actualizarOpcionesArrendatario(
    filas: Record<string, unknown>[],
  ): void {
    this.mapaNombreArrendatario.clear();
    this.opcionesArrendatario = filas
      .map((item, idx) => {
        const idCand = Number(item['id'] ?? item['idArrendatario']);
        const value =
          Number.isFinite(idCand) && idCand > 0 ? Math.floor(idCand) : idx + 1;
        const label =
          String(item['arrendatario'] ?? '').trim() ||
          `Arrendatario (${value})`;
        this.mapaNombreArrendatario.set(value, label);
        return { value, label };
      })
      .filter((o, i, self) => i === self.findIndex((x) => x.value === o.value));
    this.opcionesArrendatario.sort((a, b) =>
      a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }),
    );
  }

  private extraerFilasListaEstacionamiento(resp: unknown): Record<string, unknown>[] {
    if (Array.isArray(resp)) {
      return resp.filter(
        (x): x is Record<string, unknown> =>
          x != null && typeof x === 'object' && !Array.isArray(x),
      );
    }
    if (resp != null && typeof resp === 'object' && !Array.isArray(resp)) {
      const body = resp as Record<string, unknown>;
      const keys = [
        'data',
        'items',
        'rows',
        'estacionamientos',
        'list',
        'result',
      ];
      for (const k of keys) {
        const cand = body[k];
        if (Array.isArray(cand)) return this.extraerFilasListaEstacionamiento(cand);
      }
    }
    return [];
  }

  private registroEstacionamientoDesdeApi(
    resp: unknown,
  ): {
    idInmueble: number;
    nombrePensionado: string;
    numeroTarjeta: string;
    idArrendatario: number;
  } | null {
    const row = this.asObjetoPrimario(resp);
    if (!row) return null;

    const idInmuebleRaw = Number(
      row['idInmueble'] ??
        row['inmuebleId'] ??
        row['IdInmueble'] ??
        row['ID_INMUEBLE'],
    );
    const idInmueble =
      Number.isFinite(idInmuebleRaw) ? Math.floor(idInmuebleRaw) : NaN;

    const idArrendatarioRaw = Number(
      row['idArrendatario'] ??
        row['IdArrendatario'] ??
        row['ID_ARRENDATARIO'],
    );

    const idArrendatario =
      Number.isFinite(idArrendatarioRaw) && idArrendatarioRaw > 0
        ? Math.floor(idArrendatarioRaw)
        : 0;

    const nombrePensionado =
      String(
        row['nombrePensionado'] ??
          row['nombre_pensionado'] ??
          '',
      ).trim() || '';

    const numeroTarjeta =
      String(
        row['numeroTarjeta'] ??
          row['numero_tarjeta'] ??
          '',
      ).trim() || '';

    if (!(Number.isFinite(idInmueble) && idInmueble > 0)) return null;

    return {
      idInmueble,
      nombrePensionado,
      numeroTarjeta,
      idArrendatario,
    };
  }

  private etiquetaArrendatarioDesdeFilaApi(raw: Record<string, unknown>): string {
    const direct = raw['nombreArrendatario'] ?? raw['nombre_arrendatario'];
    if (typeof direct === 'string' && direct.trim()) return direct.trim();

    const arr = raw['arrendatario'];
    if (arr == null) return '';
    if (typeof arr === 'string') return arr.trim();
    if (typeof arr === 'object' && !Array.isArray(arr)) {
      const o = arr as Record<string, unknown>;
      return String(
        o['arrendatario'] ?? o['nombre'] ?? o['razonSocial'] ?? '',
      ).trim();
    }
    return '';
  }

  private filaGridDesdeRaw(raw: Record<string, unknown>): EstacionamientoGridFila {
    const idCand = Number(raw['id'] ?? raw['idEstacionamiento']);
    const id =
      Number.isFinite(idCand) && idCand > 0
        ? Math.floor(idCand)
        : Math.floor(Date.now()) + Math.floor(Math.random() * 1000);

    const nombrePensionado =
      String(raw['nombrePensionado'] ?? raw['nombre_pensionado'] ?? '').trim();

    const numeroTarjeta =
      String(raw['numeroTarjeta'] ?? raw['numero_tarjeta'] ?? '').trim();

    const idArrendatarioRaw =
      Number(raw['idArrendatario'] ?? raw['IdArrendatario']) ?? 0;

    let arrendatario = this.etiquetaArrendatarioDesdeFilaApi(raw);

    if (!arrendatario) {
      const arr = raw['arrendatario'];
      if (arr != null && typeof arr === 'object' && !Array.isArray(arr)) {
        const o = arr as Record<string, unknown>;
        const nestedId = Number(o['id'] ?? o['idArrendatario']);
        if (Number.isFinite(nestedId) && nestedId > 0) {
          const idFloor = Math.floor(nestedId);
          arrendatario =
            this.mapaNombreArrendatario.get(idFloor) ?? `#${idFloor}`;
        }
      }
    }

    if (!arrendatario && idArrendatarioRaw > 0) {
      const idFloor = Math.floor(idArrendatarioRaw);
      arrendatario =
        this.mapaNombreArrendatario.get(idFloor) ?? `#${idFloor}`;
    }

    /** GET listado: `estatus` viene numérico (0 = baja, 1 = activo), p. ej. `"estatus": 1`. */
    const estatus = this.normalizarEstatusValor(
      raw['estatus'] ?? raw['estatusEstacionamiento'],
    );

    return {
      id,
      nombrePensionado,
      numeroTarjeta,
      arrendatario,
      estatus,
    };
  }

  private asObjetoPrimario(resp: unknown): Record<string, unknown> | null {
    if (resp != null && typeof resp === 'object' && !Array.isArray(resp)) {
      const o = resp as Record<string, unknown>;
      const data = o['data'];
      if (data != null && typeof data === 'object' && !Array.isArray(data)) {
        return data as Record<string, unknown>;
      }
      return o;
    }
    return null;
  }

  submit(): void {
    const idImmRaw = this.idInmuebleNumerico;

    if (this.estacionamientoForm.invalid) {
      this.showRequiredFieldsError();
      return;
    }

    if (
      idImmRaw == null ||
      !(Number.isFinite(idImmRaw) && idImmRaw > 0)
    ) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: 'Falta el inmueble',
        text:
          'No hay un predio válido asociado. En alta debe abrir desde Monitoreo con query `inmuebleId` en la URL.',
        icon: 'error',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const idSel = Number(this.estacionamientoForm.value['idArrendatario']);
    if (!(Number.isFinite(idSel) && idSel > 0)) {
      this.showRequiredFieldsError();
      return;
    }

    this.submitButton =
      this.esModoEdicion && this.idEstacionamientoEdicion
        ? 'Actualizando...'
        : 'Guardando...';
    this.loading = true;

    const payload = {
      idInmueble: Math.floor(idImmRaw),
      nombrePensionado: String(
        this.estacionamientoForm.value['nombrePensionado'] ?? '',
      ).trim(),
      numeroTarjeta: String(
        this.estacionamientoForm.value['numeroTarjeta'] ?? '',
      ).trim(),
      idArrendatario: Math.floor(idSel),
    };

    if (this.esModoEdicion && this.idEstacionamientoEdicion != null) {
      this.estacionamientoService
        .actualizar(this.idEstacionamientoEdicion, payload)
        .pipe(
          finalize(() => {
            this.loading = false;
            this.submitButton = 'Actualizar';
          }),
        )
        .subscribe({
          next: () => void this.confirmarExitosoYAjustarSalida(false),
          error: (err) => void this.manifiestoErrorServicio(err),
        });
      return;
    }

    this.estacionamientoService
      .crear(payload)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.submitButton = 'Guardar';
        }),
      )
      .subscribe({
        next: () => void this.confirmarExitosoYAjustarSalida(true),
        error: (err) => void this.manifiestoErrorServicio(err),
      });
  }

  /**
   * Tras guardar: sin navegar ni F5.
   * Alta y edición refrescan filas del grid vía GET `listarPorInmueble` (`recargarSoloGrid`).
   * Edición además oculta el panel del formulario hasta «Mostrar formulario».
   */
  private confirmarExitosoYAjustarSalida(esAlta: boolean): void {
    if (esAlta) {
      this.mostrarFormulario = false;
      this.estacionamientoForm.patchValue({
        nombrePensionado: '',
        numeroTarjeta: '',
        idArrendatario: null,
      });
      this.estacionamientoForm.markAsUntouched();
      if (this.idInmuebleNumerico != null) this.recargarSoloGrid();
      return;
    }
    this.mostrarFormulario = false;
    this.estacionamientoForm.markAsPristine();
    if (this.idInmuebleNumerico != null) this.recargarSoloGrid();
  }

  private async manifiestoErrorServicio(err: unknown): Promise<void> {
    const msg =
      err != null &&
      typeof err === 'object' &&
      'error' in err &&
      (err as { error?: { message?: string } }).error &&
      typeof (err as { error: { message?: string } }).error?.message ===
        'string'
        ? String((err as { error: { message: string } }).error.message).trim()
        : '';
    await Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      title: 'El servicio no pudo guardar los datos',
      text:
        msg ||
        'Revise los datos enviados o intente nuevamente. Si el problema continúa, contacte soporte técnico.',
      icon: 'error',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Entendido',
    });
  }

  private showRequiredFieldsError(): void {
    const labels: Record<string, string> = {
      nombrePensionado: 'Nombre del pensionado',
      numeroTarjeta: 'Número de tarjeta',
      idArrendatario: 'Arrendatario',
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

    void Swal.fire({
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

  /** Toolbar: vuelve a Monitoreo con la lista de inmuebles. */
  irAMonitoreoListaInmuebles(): void {
    void this.router.navigate(['/monitoreo'], {
      queryParams: this.queryParamsMonitoreoInmuebles(),
    });
  }

  abrirModalEntradasSalidasExcel(): void {
    this.mostrarModalEntradasSalidasExcel = true;
  }

  cerrarModalEntradasSalidasExcel(): void {
    if (this.subiendoEntradasSalidasExcel) return;
    this.mostrarModalEntradasSalidasExcel = false;
    this.excelEntradasSalidasArchivo = null;
    this.excelEntradasSalidasNombre = '';
    this.excelEntradasSalidasDragging = false;
  }

  abrirSelectorExcelEntradasSalidas(): void {
    const el = document.getElementById(
      'estEntradasSalidasExcelInput',
    ) as HTMLInputElement | null;
    el?.click();
  }

  onExcelEntradasSalidasDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.excelEntradasSalidasDragging = true;
  }

  onExcelEntradasSalidasDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.excelEntradasSalidasDragging = false;
  }

  onExcelEntradasSalidasDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.excelEntradasSalidasDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.asignarArchivoExcelEntradasSalidas(file);
  }

  onExcelEntradasSalidasFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.asignarArchivoExcelEntradasSalidas(file);
    input.value = '';
  }

  private esArchivoExcelEntradasSalidas(file: File): boolean {
    if (!file?.name || !/\.(xlsx|xls)$/i.test(file.name)) return false;
    const t = (file.type ?? '').trim().toLowerCase();
    if (!t) return true;
    return (
      t === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      t === 'application/vnd.ms-excel'
    );
  }

  private asignarArchivoExcelEntradasSalidas(file: File): void {
    if (!this.esArchivoExcelEntradasSalidas(file)) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: 'Archivo no permitido',
        text: 'Solo se aceptan archivos Excel (.xlsx o .xls).',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Entendido',
      });
      return;
    }
    const maxMb = 10;
    if (file.size > maxMb * 1024 * 1024) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: 'Archivo demasiado grande',
        text: `El tamaño máximo permitido es ${maxMb} MB.`,
        icon: 'warning',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Entendido',
      });
      return;
    }
    this.excelEntradasSalidasArchivo = file;
    this.excelEntradasSalidasNombre = file.name;
  }

  subirArchivoEntradasSalidas(): void {
    const file = this.excelEntradasSalidasArchivo;
    if (!file) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: 'Seleccione un archivo',
        text: 'Elija un archivo Excel antes de guardar.',
        icon: 'info',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Entendido',
      });
      return;
    }
    const idInm = this.idInmuebleNumerico;
    if (idInm == null || idInm <= 0) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: 'Predio no definido',
        text: 'Abra esta pantalla con el parámetro inmuebleId en la URL.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    this.subiendoEntradasSalidasExcel = true;
    this.entradasSalidasService
      .importarExcel(idInm, file)
      .pipe(finalize(() => (this.subiendoEntradasSalidasExcel = false)))
      .subscribe({
        next: () => {
          this.cerrarModalEntradasSalidasExcel();
          this.cargarGridEntradasSalidas();
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: 'Importación correcta',
            text: 'El archivo se procesó y el listado se actualizó.',
            icon: 'success',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Entendido',
          });
        },
        error: (err) => void this.manifiestoErrorServicio(err),
      });
  }

  limpiarCamposGridEntradasSalidas(): void {
    const g = this.gridEntradasSalidas?.instance;
    if (!g) return;
    g.clearGrouping();
    g.clearFilter();
    g.searchByText('');
    g.refresh();
  }

  toggleExpandGroupsEntradasSalidas(): void {
    const g = this.gridEntradasSalidas?.instance;
    if (!g) return;
    const groupedColumns = g
      .getVisibleColumns()
      .filter((col: { groupIndex?: number }) => (col.groupIndex ?? -1) >= 0);
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
    this.autoExpandAllGroupsEntradasSalidas =
      !this.autoExpandAllGroupsEntradasSalidas;
    g.refresh();
  }

  private queryParamsMonitoreoInmuebles(): Record<string, string> {
    const qp: Record<string, string> = { retorno: 'inmuebles' };
    const idc = this.idClienteParaMonitoreo?.trim();
    if (idc) qp['idCliente'] = idc;
    return qp;
  }

  onPageIndexChanged(_e: unknown): void {}

  onGridOptionChanged(_e: unknown): void {}

  limpiarCamposGrid(): void {
    const g = this.dataGrid?.instance;
    if (!g) return;
    g.clearGrouping();
    g.clearFilter();
    g.searchByText('');
    g.refresh();
  }

  /**
   * Misma forma que llega del API (`estatus: 1` o `0` en JSON).
   * También tolera `"0"`/`"1"` si en algún flujo llegan como string.
   */
  numEstatus(val: unknown): 0 | 1 {
    return this.normalizarEstatusValor(val);
  }

  private normalizarEstatusValor(val: unknown): 0 | 1 {
    if (val === 0 || val === '0') return 0;
    if (val === 1 || val === '1') return 1;
    const n = Number(val);
    if (n === 0) return 0;
    if (n === 1) return 1;
    return 1;
  }

  editarEstacionamientoDesdeGrid(id: number): void {
    void this.router.navigateByUrl(
      '/estacionamiento/editar-estacionamiento/' + id,
    );
  }

  activarEstacionamientoGrid(row: EstacionamientoGridFila): void {
    const nombre = (row.nombrePensionado || 'este estacionamiento').trim();
    void Swal.fire({
      title: '¡Activar!',
      html: `¿Está seguro que requiere activar el estacionamiento: <strong>${nombre}</strong>?`,
      icon: 'warning',
      background: '#141a21',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.value) return;
      this.estacionamientoService
        .actualizarEstatus(row.id, { estatus: 1 })
        .subscribe({
          next: () => {
            void Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Operación Exitosa!',
              html: `El estacionamiento ha sido activado.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
            this.aplicarEstatusFilaGrid(row.id, 1);
          },
          error: (err: unknown) => {
            void Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Ops!',
              html: this.mensajeErrorHttp(err),
              icon: 'error',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
          },
        });
    });
  }

  desactivarEstacionamientoGrid(row: EstacionamientoGridFila): void {
    const nombre = (row.nombrePensionado || 'este estacionamiento').trim();
    void Swal.fire({
      title: '¡Desactivar!',
      html: `¿Está seguro que requiere desactivar el estacionamiento: <strong>${nombre}</strong>?`,
      icon: 'warning',
      background: '#141a21',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.value) return;
      this.estacionamientoService
        .actualizarEstatus(row.id, { estatus: 0 })
        .subscribe({
          next: () => {
            void Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Operación Exitosa!',
              html: `El estacionamiento ha sido dado de baja.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
            this.aplicarEstatusFilaGrid(row.id, 0);
          },
          error: (err: unknown) => {
            void Swal.fire({
              background: '#141a21',
              color: '#ffffff',
              title: '¡Ops!',
              html: this.mensajeErrorHttp(err),
              icon: 'error',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'Confirmar',
            });
          },
        });
    });
  }

  private mensajeErrorHttp(err: unknown): string {
    if (
      err != null &&
      typeof err === 'object' &&
      'error' in err &&
      err.error &&
      typeof err.error === 'object' &&
      'message' in err.error &&
      typeof (err.error as { message?: unknown }).message === 'string'
    ) {
      return String((err.error as { message: string }).message);
    }
    return 'No se pudo actualizar el estatus. Intente nuevamente.';
  }

  toggleExpandGroups(): void {
    const g = this.dataGrid?.instance;
    if (!g) return;
    const groupedColumns = g
      .getVisibleColumns()
      .filter((col: { groupIndex?: number }) => (col.groupIndex ?? -1) >= 0);
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
