import { ChangeDetectorRef, Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom, of } from 'rxjs';
import { catchError, finalize, take } from 'rxjs/operators';
import Swal from 'sweetalert2';
import {
  contractDimAnim,
  contractModalAnim,
  rentaHintMsgAnim,
  rentaResumenRevealAnim,
  routeAnimation,
} from 'src/app/pipe/module-open.animation';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { FormulasService } from 'src/app/services/moduleService/formulas.service';
import { InmueblesService } from 'src/app/services/moduleService/inmuebles.service';
import {
  formatearFecha,
  formatearMoneda,
  nombreArrendador,
} from '../../../inmuebles/inmuebles-list.mapper';
import {
  etiquetaContratoArrendatarioApi,
  extraerFilasPaginadasApi,
  nombreArrendatarioDesdeApi,
  resolverIdArrendatarioApi,
} from '../../arrendatarios-list.mapper';
import {
  ArrendadorFiltroOpcion,
  claveCacheFiltroPagosMes,
  etiquetaArrendadorFiltroUi,
  etiquetaInmuebleFiltroUi,
  idsArrendatarioDesdeRespuestaApi,
  InmuebleFiltroOpcion,
  mapArrendadoresAFiltroOpciones,
  mapInmueblesAFiltroOpciones,
} from '../../pagos-mes-inmueble-filtro.helpers';
import {
  MantenimientoActualPostPayload,
  MantenimientoActualPutPayload,
  MantenimientoActualService,
} from 'src/app/services/moduleService/mantenimiento-actual.service';
import {
  extraerFilasMantenimientoActualApi,
  extraerMantenimientoActualDetalleApi,
  mapMantenimientoActualApiToGridRow,
  MantenimientoActualGridRow,
} from './mantenimiento-actual-list.mapper';
import { exportarDxDataGridExcel, gridTieneDatosParaExportar } from 'src/app/shared/grid-excel-export';

interface SelectOpcion {
  id: number;
  label: string;
}

interface MantenimientoModalResumenCampo {
  etiqueta: string;
  valor: string;
  dinero?: boolean;
}

interface MantenimientoModalResumenVm {
  listo: boolean;
  mensajeVacio: string;
  pagoAFavorDe: string;
  arrendatario: string;
  campos: MantenimientoModalResumenCampo[];
}

@Component({
  selector: 'app-lista-mantenimiento-actual',
  templateUrl: './lista-mantenimiento-actual.component.html',
  styleUrl: './lista-mantenimiento-actual.component.scss',
  standalone: false,
  animations: [routeAnimation, contractDimAnim, contractModalAnim, rentaResumenRevealAnim, rentaHintMsgAnim],
})
export class ListaMantenimientoActualComponent implements OnInit {
  embebidoEnHub = false;
  listaMantenimientos!: InstanceType<typeof CustomStore>;
  showFilterRow = true;
  showHeaderFilter = true;
  loading = false;
  pageSize = 20;
  paginaActual = 1;
  totalRegistros = 0;
  totalPaginas = 0;
  paginaActualData: MantenimientoActualGridRow[] = [];
  busquedaHub = '';
  filtroActivo = '';
  mensajeAgrupar =
    'Arrastre un encabezado de columna aquí para agrupar por dicha columna';
  autoExpandAllGroups = true;

  listaArrendadoresFiltro: ArrendadorFiltroOpcion[] = [];
  idArrendadorSeleccionado: number | null = null;
  cargandoArrendadores = false;
  filtroArrendadorAbierto = false;

  listaInmueblesFiltro: InmuebleFiltroOpcion[] = [];
  idInmuebleSeleccionado: number | null = null;
  cargandoInmuebles = false;
  filtroInmuebleAbierto = false;
  private idsArrendatarioFiltro: Set<number> | null = null;
  private cacheClaveFiltroArrendatarios: string | null = null;

  mostrarModalMantenimiento = false;
  mantenimientoModalModo: 'alta' | 'edicion' = 'alta';
  mantenimientoEditId: number | null = null;
  mantenimientoGuardando = false;
  mantenimientoModalCargando = false;
  mantenimientoForm!: FormGroup;

  arrendatariosOpciones: SelectOpcion[] = [];
  contratosOpciones: SelectOpcion[] = [];
  formulasOpciones: SelectOpcion[] = [];
  private arrendatariosCatalogo: Record<string, unknown>[] = [];
  catalogosModalCargando = false;
  resumenMantenimientoModal: MantenimientoModalResumenVm = this.resumenMantenimientoModalVacio();

  @ViewChild('gridContainer', { static: false })
  dataGrid!: DxDataGridComponent;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private mantenimientoActualService: MantenimientoActualService,
    private arrendatariosService: ArrendatariosService,
    private formulasService: FormulasService,
    private inmueblesService: InmueblesService,
    private clientesService: ClientesService,
  ) {}

  get etiquetaArrendadorFiltro(): string {
    return etiquetaArrendadorFiltroUi(
      this.idArrendadorSeleccionado,
      this.listaArrendadoresFiltro,
      this.cargandoArrendadores,
    );
  }

  get etiquetaInmuebleFiltro(): string {
    return etiquetaInmuebleFiltroUi(
      this.idInmuebleSeleccionado,
      this.listaInmueblesFiltro,
      this.cargandoInmuebles,
    );
  }

  get hayFiltrosPagosMesActivos(): boolean {
    return this.idArrendadorSeleccionado != null || this.idInmuebleSeleccionado != null;
  }

  ngOnInit(): void {
    this.embebidoEnHub = this.leerEmbebidoEnHub();
    this.inicializarFormulario();
    this.cargarArrendadoresFiltro();
    this.cargarInmueblesFiltro();
    this.setupDataSource();
  }

  private inicializarFormulario(): void {
    this.mantenimientoForm = this.fb.group({
      idArrendatario: [null, Validators.required],
      idContrato: [null, Validators.required],
      total: [null, Validators.required],
      idFormula: [null, Validators.required],
      montoFinal: [null, Validators.required],
      factorVariable: [null, Validators.required],
      ocupoFormula: [0, Validators.required],
    });
    this.mantenimientoForm.get('idArrendatario')?.valueChanges.subscribe((id) => {
      this.sincronizarContratosPorArrendatario(id);
      this.actualizarResumenMantenimientoModal();
    });
    this.mantenimientoForm.valueChanges.subscribe(() => this.actualizarResumenMantenimientoModal());
  }

  private resumenMantenimientoModalVacio(): MantenimientoModalResumenVm {
    return {
      listo: false,
      mensajeVacio:
        'Selecciona arrendatario y contrato para ver a quién corresponde este pago.',
      pagoAFavorDe: '',
      arrendatario: '',
      campos: [],
    };
  }

  trackByResumenCampo(_index: number, campo: MantenimientoModalResumenCampo): string {
    return campo.etiqueta;
  }

  private actualizarResumenMantenimientoModal(): void {
    this.resumenMantenimientoModal = this.construirResumenMantenimientoModal();
    this.cdr.markForCheck();
  }

  setupDataSource(): void {
    this.loading = true;
    this.listaMantenimientos = new CustomStore({
      key: 'id',
      load: async (loadOptions: { take?: number; skip?: number }) => {
        const take = Number(loadOptions?.take) || this.pageSize || 20;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;
        const idArrendador = this.idArrendadorSeleccionado;
        const idInmueble = this.idInmuebleSeleccionado;
        try {
          if (idArrendador == null && idInmueble == null) {
            const resp = (await lastValueFrom(
              this.mantenimientoActualService.obtenerMantenimientosPaginados(page, take),
            )) as Record<string, unknown>;
            this.loading = false;
            const rowsRaw = extraerFilasMantenimientoActualApi(resp);
            const meta =
              resp?.['paginated'] != null && typeof resp['paginated'] === 'object'
                ? (resp['paginated'] as Record<string, unknown>)
                : {};
            const totalRegistros =
              toNum(meta['total']) ?? toNum(resp?.['total']) ?? rowsRaw.length;
            const paginaActual = toNum(meta['page']) ?? toNum(resp?.['page']) ?? page;
            const totalPaginas =
              toNum(meta['lastPage']) ??
              toNum(resp['pages']) ??
              Math.max(1, Math.ceil(totalRegistros / take));

            const dataTransformada = rowsRaw
              .map((item) => mapMantenimientoActualApiToGridRow(item))
              .filter((r): r is MantenimientoActualGridRow => r != null);

            this.totalRegistros = totalRegistros;
            this.paginaActual = paginaActual;
            this.totalPaginas = totalPaginas;
            this.paginaActualData = dataTransformada;

            return { data: dataTransformada, totalCount: totalRegistros };
          }

          const idsArr = await this.obtenerIdsArrendatarioFiltro();
          const resp = (await lastValueFrom(
            this.mantenimientoActualService.obtenerMantenimientosPaginados(1, 500),
          )) as Record<string, unknown>;
          this.loading = false;
          const rowsRaw = extraerFilasMantenimientoActualApi(resp);
          const dataTransformada = rowsRaw
            .map((item) => mapMantenimientoActualApiToGridRow(item))
            .filter((r): r is MantenimientoActualGridRow => r != null)
            .filter(
              (r) =>
                r.idArrendatario != null &&
                idsArr.has(r.idArrendatario),
            );
          this.totalRegistros = dataTransformada.length;
          this.paginaActual = page;
          this.totalPaginas = Math.max(1, Math.ceil(dataTransformada.length / take));
          this.paginaActualData = dataTransformada.slice(skip, skip + take);
          return {
            data: this.paginaActualData,
            totalCount: dataTransformada.length,
          };
        } catch (err) {
          this.loading = false;
          console.error('Error al cargar mantenimientos actuales:', err);
          return { data: [], totalCount: 0 };
        }
      },
    });

    function toNum(v: unknown): number | null {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
  }

  onPageIndexChanged(e: any): void {
    this.paginaActual = e.component.pageIndex() + 1;
    e.component.refresh();
  }

  aplicarBusquedaHub(): void {
    const grid = this.dataGrid?.instance;
    const texto = this.busquedaHub.trim().toLowerCase();
    if (!texto) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaMantenimientos);
      return;
    }
    this.filtroActivo = texto;
    grid?.option('dataSource', this.filtrarFilasMantenimientoPorTexto(texto));
  }

  onGridOptionChanged(e: any): void {
    if (e.fullName !== 'searchPanel.text') return;
    const grid = this.dataGrid?.instance;
    const texto = (e.value ?? '').toString().trim().toLowerCase();
    if (!texto) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaMantenimientos);
      return;
    }
    this.filtroActivo = texto;
    grid?.option('dataSource', this.filtrarFilasMantenimientoPorTexto(texto));
  }

  private filtrarFilasMantenimientoPorTexto(texto: string): MantenimientoActualGridRow[] {
    return (this.paginaActualData || []).filter((row) => {
      const extras = [
        row.arrendatarioLabel,
        row.contratoLabel,
        row.formulaLabel,
        row.totalFmt,
        row.montoFinalFmt,
        row.pagadaLabel,
        row.mesLabel,
        String(row.id),
      ];
      return extras.some((s) => String(s).toLowerCase().includes(texto));
    });
  }

  limpiarFiltrosPagosMes(): void {
    if (!this.hayFiltrosPagosMesActivos) return;
    this.idArrendadorSeleccionado = null;
    this.filtroArrendadorAbierto = false;
    this.idInmuebleSeleccionado = null;
    this.filtroInmuebleAbierto = false;
    this.idsArrendatarioFiltro = null;
    this.cacheClaveFiltroArrendatarios = null;
    this.cargarInmueblesFiltro();
    this.refrescarGridTrasFiltro();
  }

  limpiarVista(): void {
    this.busquedaHub = '';
    this.idArrendadorSeleccionado = null;
    this.filtroArrendadorAbierto = false;
    this.idInmuebleSeleccionado = null;
    this.filtroInmuebleAbierto = false;
    this.idsArrendatarioFiltro = null;
    this.cacheClaveFiltroArrendatarios = null;
    this.cargarInmueblesFiltro();
    const inst = this.dataGrid?.instance;
    if (!inst) return;
    inst.clearFilter();
    inst.clearGrouping();
    inst.pageIndex(0);
    inst.option('searchPanel.text', '');
    this.filtroActivo = '';
    inst.option('dataSource', this.listaMantenimientos);
    inst.refresh();
  }

  onArrendadorFiltroChange(id: number | null): void {
    const n = Number(id);
    this.idArrendadorSeleccionado = Number.isFinite(n) && n > 0 ? n : null;
    this.filtroArrendadorAbierto = false;
    this.filtroInmuebleAbierto = false;
    this.idsArrendatarioFiltro = null;
    this.cacheClaveFiltroArrendatarios = null;
    this.idInmuebleSeleccionado = null;
    this.cargarInmueblesFiltro();
    this.refrescarGridTrasFiltro();
  }

  onInmuebleFiltroChange(id: number | null): void {
    const n = Number(id);
    this.idInmuebleSeleccionado = Number.isFinite(n) && n > 0 ? n : null;
    this.filtroInmuebleAbierto = false;
    this.filtroArrendadorAbierto = false;
    this.idsArrendatarioFiltro = null;
    this.cacheClaveFiltroArrendatarios = null;
    this.refrescarGridTrasFiltro();
  }

  private refrescarGridTrasFiltro(): void {
    this.busquedaHub = '';
    this.filtroActivo = '';
    const grid = this.dataGrid?.instance;
    if (grid) {
      grid.option('searchPanel.text', '');
      grid.option('dataSource', this.listaMantenimientos);
      grid.pageIndex(0);
      grid.refresh();
    }
    this.cdr.markForCheck();
  }

  toggleFiltroArrendador(ev?: Event): void {
    ev?.stopPropagation();
    if (this.cargandoArrendadores) return;
    this.filtroInmuebleAbierto = false;
    this.filtroArrendadorAbierto = !this.filtroArrendadorAbierto;
  }

  toggleFiltroInmueble(ev?: Event): void {
    ev?.stopPropagation();
    if (this.cargandoInmuebles) return;
    this.filtroArrendadorAbierto = false;
    this.filtroInmuebleAbierto = !this.filtroInmuebleAbierto;
  }

  @HostListener('document:click')
  cerrarFiltrosDropdown(): void {
    if (!this.filtroInmuebleAbierto && !this.filtroArrendadorAbierto) return;
    this.filtroInmuebleAbierto = false;
    this.filtroArrendadorAbierto = false;
  }

  @HostListener('document:keydown.escape')
  cerrarFiltrosDropdownTecla(): void {
    if (!this.filtroInmuebleAbierto && !this.filtroArrendadorAbierto) return;
    this.filtroInmuebleAbierto = false;
    this.filtroArrendadorAbierto = false;
  }

  private cargarArrendadoresFiltro(): void {
    this.cargandoArrendadores = true;
    this.clientesService
      .obtenerClientes()
      .pipe(
        take(1),
        catchError((err) => {
          console.error('Error al cargar arrendadores:', err);
          return of(null);
        }),
      )
      .subscribe((res) => {
        this.listaArrendadoresFiltro = mapArrendadoresAFiltroOpciones(res);
        this.cargandoArrendadores = false;
        this.cdr.markForCheck();
      });
  }

  private cargarInmueblesFiltro(): void {
    this.cargandoInmuebles = true;
    const idArrendador = this.idArrendadorSeleccionado;
    const req$ =
      idArrendador == null
        ? this.inmueblesService.obtenerInmueblesData(1, 500)
        : this.inmueblesService.obtenerInmueblesPorArrendador(idArrendador);
    req$
      .pipe(
        take(1),
        catchError((err) => {
          console.error('Error al cargar inmuebles:', err);
          return of(null);
        }),
      )
      .subscribe((res) => {
        this.listaInmueblesFiltro = mapInmueblesAFiltroOpciones(res);
        if (
          this.idInmuebleSeleccionado != null &&
          !this.listaInmueblesFiltro.some((i) => i.id === this.idInmuebleSeleccionado)
        ) {
          this.idInmuebleSeleccionado = null;
        }
        this.cargandoInmuebles = false;
        this.cdr.markForCheck();
      });
  }

  private async obtenerIdsArrendatarioFiltro(): Promise<Set<number>> {
    const idArrendador = this.idArrendadorSeleccionado;
    const idInmueble = this.idInmuebleSeleccionado;
    const cacheKey = claveCacheFiltroPagosMes(idArrendador, idInmueble);
    if (
      this.cacheClaveFiltroArrendatarios === cacheKey &&
      this.idsArrendatarioFiltro != null
    ) {
      return this.idsArrendatarioFiltro;
    }

    let idsInmuebles: number[] = [];
    if (idInmueble != null) {
      if (idArrendador != null) {
        const respInm = await lastValueFrom(
          this.inmueblesService.obtenerInmueblesPorArrendador(idArrendador),
        );
        const permitidos = new Set(mapInmueblesAFiltroOpciones(respInm).map((i) => i.id));
        idsInmuebles = permitidos.has(idInmueble) ? [idInmueble] : [];
      } else {
        idsInmuebles = [idInmueble];
      }
    } else if (idArrendador != null) {
      const respInm = await lastValueFrom(
        this.inmueblesService.obtenerInmueblesPorArrendador(idArrendador),
      );
      idsInmuebles = mapInmueblesAFiltroOpciones(respInm).map((i) => i.id);
    }

    const ids = new Set<number>();
    for (const iid of idsInmuebles) {
      const resp = await lastValueFrom(
        this.arrendatariosService.obtenerArrendatariosPorInmueble(iid),
      );
      for (const id of idsArrendatarioDesdeRespuestaApi(resp)) ids.add(id);
    }
    this.cacheClaveFiltroArrendatarios = cacheKey;
    this.idsArrendatarioFiltro = ids;
    return ids;
  }

  toggleExpandGroups(): void {
    const groupedColumns = this.dataGrid.instance
      .getVisibleColumns()
      .filter((col) => (col.groupIndex ?? -1) >= 0);
    if (groupedColumns.length === 0) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: 'Agrupación',
        text: 'Arrastre el encabezado de una columna al panel de agrupación.',
        icon: 'warning',
        confirmButtonText: 'Entendido',
      });
      return;
    }
    this.autoExpandAllGroups = !this.autoExpandAllGroups;
    this.dataGrid.instance.refresh();
  }

  puedeExportarExcel(): boolean {
    return gridTieneDatosParaExportar(this.dataGrid?.instance);
  }

  async exportarExcel(): Promise<void> {
    await exportarDxDataGridExcel({
      component: this.dataGrid?.instance,
      fileName: 'MantenimientoActual',
    });
  }

  abrirModalAlta(): void {
    this.mantenimientoModalModo = 'alta';
    this.mantenimientoEditId = null;
    this.mantenimientoForm.reset({
      idArrendatario: null,
      idContrato: null,
      total: null,
      idFormula: null,
      montoFinal: null,
      factorVariable: null,
      ocupoFormula: 0,
    });
    this.mantenimientoForm.get('idArrendatario')?.enable();
    this.mantenimientoForm.get('idContrato')?.enable();
    this.contratosOpciones = [];
    this.resumenMantenimientoModal = this.resumenMantenimientoModalVacio();
    this.mostrarModalMantenimiento = true;
    this.cargarCatalogosModal();
    this.cdr.markForCheck();
  }

  abrirModalEdicion(row: MantenimientoActualGridRow): void {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;
    this.mantenimientoModalModo = 'edicion';
    this.mantenimientoEditId = Math.floor(id);
    this.mostrarModalMantenimiento = true;
    this.mantenimientoModalCargando = true;
    this.mantenimientoForm.reset();
    this.mantenimientoForm.get('idArrendatario')?.disable();
    this.mantenimientoForm.get('idContrato')?.disable();
    this.resumenMantenimientoModal = this.resumenMantenimientoModalVacio();
    this.cargarCatalogosModal();
    this.cdr.markForCheck();

    this.mantenimientoActualService.obtenerMantenimientoPorId(this.mantenimientoEditId)
      .pipe(
        take(1),
        finalize(() => {
          this.mantenimientoModalCargando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (resp) => {
          const det = extraerMantenimientoActualDetalleApi(resp);
          if (!det) return;
          const ocupoRaw = det['ocupoFormula'] ?? det['ocupo_formula'];
          const ocupo =
            ocupoRaw === true || ocupoRaw === 1 || ocupoRaw === '1' ? 1 : 0;
          this.mantenimientoForm.patchValue({
            idArrendatario: Number(det['idArrendatario']) || null,
            idContrato: Number(det['idContrato']) || null,
            total: Number(det['total']),
            idFormula: Number(det['idFormula']) || null,
            montoFinal: Number(det['montoFinal'] ?? det['monto_final']),
            factorVariable: Number(
              det['factorVariable'] ?? det['factor_variable'],
            ),
            ocupoFormula: ocupo,
          });
          this.actualizarResumenMantenimientoModal();
        },
        error: (err) => {
          console.error(err);
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'error',
            title: 'No se pudo cargar el mantenimiento',
            text: this.mensajeErrorHttp(err),
            confirmButtonText: 'Entendido',
          });
          this.cerrarModalMantenimiento();
        },
      });
  }

  cerrarModalMantenimiento(): void {
    this.mostrarModalMantenimiento = false;
    this.mantenimientoEditId = null;
    this.resumenMantenimientoModal = this.resumenMantenimientoModalVacio();
    this.cdr.markForCheck();
  }

  private construirResumenMantenimientoModal(): MantenimientoModalResumenVm {
    const vacio =
      'Selecciona arrendatario y contrato para ver a quién corresponde este pago.';
    const raw = this.mantenimientoForm?.getRawValue() ?? {};
    const idArr = Number(raw['idArrendatario']);
    const idCon = Number(raw['idContrato']);

    if (!Number.isFinite(idArr) || idArr <= 0) {
      return {
        listo: false,
        mensajeVacio: vacio,
        pagoAFavorDe: '',
        arrendatario: '',
        campos: [],
      };
    }

    const item = this.arrendatariosCatalogo.find(
      (r) => resolverIdArrendatarioApi(r) === Math.floor(idArr),
    );
    const arrendatarioNombre = item
      ? nombreArrendatarioDesdeApi(item)
      : this.etiquetaOpcion(this.arrendatariosOpciones, idArr);

    if (!Number.isFinite(idCon) || idCon <= 0) {
      return {
        listo: false,
        mensajeVacio: 'Selecciona un contrato para completar el resumen del pago.',
        pagoAFavorDe: item ? this.nombreArrendadorPago(item, null) : '',
        arrendatario: arrendatarioNombre || '—',
        campos: [],
      };
    }

    const contrato = this.buscarContratoEnCatalogo(Math.floor(idArr), Math.floor(idCon));
    const pagoAFavorDe = item
      ? this.nombreArrendadorPago(item, contrato)
      : 'Arrendador no disponible';
    const campos: MantenimientoModalResumenCampo[] = [
      {
        etiqueta: 'Contrato',
        valor:
          (contrato && etiquetaContratoArrendatarioApi(contrato)) ||
          this.etiquetaOpcion(this.contratosOpciones, idCon),
      },
    ];

    const inm =
      contrato?.['inmueble'] != null && typeof contrato['inmueble'] === 'object'
        ? (contrato['inmueble'] as Record<string, unknown>)
        : null;
    const inmueble = inm ? String(inm['inmueble'] ?? '').trim() : '';
    const direccion = inm ? String(inm['direccionFiscal'] ?? '').trim() : '';
    if (inmueble) {
      campos.push({
        etiqueta: 'Inmueble',
        valor: direccion ? `${inmueble} · ${direccion}` : inmueble,
      });
    }

    const fi = formatearFecha(
      String(contrato?.['fechaInicioContrato'] ?? contrato?.['fechaInicio'] ?? ''),
    );
    const ff = formatearFecha(
      String(contrato?.['fechaTerminoContrato'] ?? contrato?.['fechaFin'] ?? ''),
    );
    if (fi && ff && fi !== '—' && ff !== '—') {
      campos.push({ etiqueta: 'Vigencia', valor: `${fi} – ${ff}` });
    }

    const moneda = String(contrato?.['moneda'] ?? 'MXN').trim() || 'MXN';
    this.agregarMontosContratoAlResumen(campos, contrato, moneda);

    const idFormula = Number(raw['idFormula']);
    if (Number.isFinite(idFormula) && idFormula > 0) {
      const formula = this.etiquetaOpcion(this.formulasOpciones, idFormula);
      if (formula) campos.push({ etiqueta: 'Fórmula', valor: formula });
    }

    const total = String(raw['total'] ?? '').trim();
    const montoFinal = String(raw['montoFinal'] ?? '').trim();
    if (total) {
      campos.push({
        etiqueta: 'Total a registrar',
        valor: this.esNumeroCaptura(total) ? formatearMoneda(total) : total,
        dinero: true,
      });
    }
    if (montoFinal) {
      campos.push({
        etiqueta: 'Monto final',
        valor: this.esNumeroCaptura(montoFinal) ? formatearMoneda(montoFinal) : montoFinal,
        dinero: true,
      });
    }

    const ocupo = Number(raw['ocupoFormula']) === 1 ? 'Sí' : 'No';
    campos.push({ etiqueta: 'Usó fórmula', valor: ocupo });

    return {
      listo: true,
      mensajeVacio: '',
      pagoAFavorDe,
      arrendatario: arrendatarioNombre || '—',
      campos,
    };
  }

  private agregarMontosContratoAlResumen(
    campos: MantenimientoModalResumenCampo[],
    contrato: Record<string, unknown> | null,
    moneda: string,
  ): void {
    if (!contrato) return;

    const subtotal = formatearMoneda(
      contrato['subTotalMantenimiento'] ??
        contrato['subtotalMantenimiento'] ??
        contrato['sub_total_mantenimiento'],
    );
    if (subtotal && subtotal !== '—') {
      campos.push({
        etiqueta: 'Subtotal mantenimiento',
        valor: `${subtotal} ${moneda}`,
        dinero: true,
      });
    }

    const iva = formatearMoneda(
      contrato['ivaMantenimiento'] ?? contrato['iva_mantenimiento'],
    );
    if (iva && iva !== '—') {
      campos.push({
        etiqueta: 'IVA mantenimiento',
        valor: `${iva} ${moneda}`,
        dinero: true,
      });
    }

    const mantenimiento = formatearMoneda(
      contrato['mantenimientoTotal'] ?? contrato['mantenimiento_total'],
    );
    if (mantenimiento && mantenimiento !== '—') {
      campos.push({
        etiqueta: 'Mantenimiento del contrato',
        valor: `${mantenimiento} ${moneda}`,
        dinero: true,
      });
    }
  }

  private nombreArrendadorPago(
    item: Record<string, unknown>,
    contrato: Record<string, unknown> | null,
  ): string {
    const arr = item['arrendador'];
    if (arr != null && typeof arr === 'object') {
      const nombre = nombreArrendador(arr as Record<string, unknown>);
      if (nombre && nombre !== '—') return nombre;
    }
    const inm = contrato?.['inmueble'];
    if (inm != null && typeof inm === 'object') {
      const arrInm = (inm as Record<string, unknown>)['arrendador'];
      if (arrInm != null && typeof arrInm === 'object') {
        const nombre = nombreArrendador(arrInm as Record<string, unknown>);
        if (nombre && nombre !== '—') return nombre;
      }
      const idInm = Number((inm as Record<string, unknown>)['idArrendador']);
      if (Number.isFinite(idInm) && idInm > 0) {
        return `Arrendador #${Math.trunc(idInm)}`;
      }
    }
    const id = Number(item['idArrendador']);
    if (Number.isFinite(id) && id > 0) return `Arrendador #${Math.trunc(id)}`;
    return 'Arrendador no indicado en el catálogo';
  }

  private buscarContratoEnCatalogo(
    idArrendatario: number,
    idContrato: number,
  ): Record<string, unknown> | null {
    const item = this.arrendatariosCatalogo.find(
      (r) => resolverIdArrendatarioApi(r) === idArrendatario,
    );
    const contratos = Array.isArray(item?.['contratos']) ? item['contratos'] : [];
    for (const raw of contratos) {
      if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const c = raw as Record<string, unknown>;
      const id = Number(c['id'] ?? c['idContrato']);
      if (id === idContrato) return c;
    }
    return null;
  }

  private etiquetaOpcion(opciones: SelectOpcion[], id: number): string {
    const hit = opciones.find((o) => o.id === Math.floor(id));
    return hit?.label?.trim() ?? '';
  }

  private esNumeroCaptura(v: string): boolean {
    const n = Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n);
  }

  textoPlaceholderContrato(): string {
    const idArr = Number(this.mantenimientoForm?.get('idArrendatario')?.value);
    if (!Number.isFinite(idArr) || idArr <= 0) {
      return 'Seleccione arrendatario primero';
    }
    return this.contratosOpciones.length ? 'Seleccione contrato' : 'Sin contratos';
  }

  private cargarCatalogosModal(): void {
    this.catalogosModalCargando = true;
    void Promise.allSettled([
      lastValueFrom(this.arrendatariosService.obtenerArrendatariosPaginated(1, 300)),
      lastValueFrom(this.formulasService.obtenerFormulasData(1, 300)),
    ])
      .then((results) => {
        const [arrResult, formResult] = results;
        if (arrResult.status === 'fulfilled') {
          this.arrendatariosCatalogo = extraerFilasPaginadasApi(arrResult.value);
          this.arrendatariosOpciones = this.mapArrendatariosOpciones(
            this.arrendatariosCatalogo,
          );
          this.sincronizarContratosPorArrendatario(
            this.mantenimientoForm.get('idArrendatario')?.value,
          );
        } else {
          console.error('Error arrendatarios modal mantenimiento:', arrResult.reason);
          this.arrendatariosCatalogo = [];
          this.arrendatariosOpciones = [];
          this.contratosOpciones = [];
        }
        if (formResult.status === 'fulfilled') {
          this.formulasOpciones = this.mapFormulasOpciones(formResult.value);
        } else {
          console.error('Error fórmulas modal mantenimiento:', formResult.reason);
          this.formulasOpciones = [];
        }
      })
      .finally(() => {
        this.catalogosModalCargando = false;
        this.actualizarResumenMantenimientoModal();
      });
  }

  private sincronizarContratosPorArrendatario(idArrendatario: unknown): void {
    const id = Number(idArrendatario);
    const ctrlContrato = this.mantenimientoForm.get('idContrato');
    if (!Number.isFinite(id) || id <= 0) {
      this.contratosOpciones = [];
      ctrlContrato?.setValue(null, { emitEvent: false });
      return;
    }
    const idBuscado = Math.floor(id);
    const item = this.arrendatariosCatalogo.find(
      (r) => resolverIdArrendatarioApi(r) === idBuscado,
    );
    const contratos = Array.isArray(item?.['contratos'])
      ? (item['contratos'] as unknown[])
      : [];
    this.contratosOpciones = contratos
      .map((raw) => {
        if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
        const c = raw as Record<string, unknown>;
        const estatus = c['estatus'];
        if (estatus != null && Number(estatus) !== 1) return null;
        const idContrato = Number(c['id'] ?? c['idContrato']);
        if (!Number.isFinite(idContrato) || idContrato <= 0) return null;
        return {
          id: Math.floor(idContrato),
          label: etiquetaContratoArrendatarioApi(c),
        };
      })
      .filter((x): x is SelectOpcion => x != null);

    const actual = Number(ctrlContrato?.value);
    const sigueValido = this.contratosOpciones.some((o) => o.id === actual);
    if (!sigueValido) {
      ctrlContrato?.setValue(null, { emitEvent: false });
    }
    this.actualizarResumenMantenimientoModal();
  }

  private mapArrendatariosOpciones(rows: Record<string, unknown>[]): SelectOpcion[] {
    return rows
      .map((r) => {
        const id = resolverIdArrendatarioApi(r);
        if (id == null) return null;
        const nombre = nombreArrendatarioDesdeApi(r);
        return { id, label: nombre || `Arrendatario #${id}` };
      })
      .filter((x): x is SelectOpcion => x != null);
  }

  private mapFormulasOpciones(resp: unknown): SelectOpcion[] {
    const rows = extraerFilasPaginadasApi(resp);
    return rows
      .map((r) => {
        const estatus = r['estatus'];
        if (estatus != null && Number(estatus) !== 1) return null;
        const id = Number(r['id'] ?? r['idFormula']);
        if (!Number.isFinite(id) || id <= 0) return null;
        const nombre = String(r['nombre'] ?? '').trim();
        const formula = String(r['formula'] ?? '').trim();
        let label: string;
        if (nombre && formula) {
          label = `${nombre} - ${formula}`;
        } else if (nombre) {
          label = nombre;
        } else if (formula) {
          label = formula;
        } else {
          label = `Fórmula #${id}`;
        }
        return { id: Math.floor(id), label };
      })
      .filter((x): x is SelectOpcion => x != null);
  }

  guardarMantenimientoDesdeModal(): void {
    if (!this.mantenimientoForm || this.mantenimientoForm.invalid) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Completa los campos obligatorios del formulario.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const raw = this.mantenimientoForm.getRawValue();
    const total = Number(raw.total);
    const montoFinal = Number(raw.montoFinal);
    const factorVariable = Number(raw.factorVariable);
    const idFormula = Number(raw.idFormula);
    const ocupoFormula = Number(raw.ocupoFormula) === 1 ? 1 : 0;

    if (
      !Number.isFinite(total) ||
      !Number.isFinite(montoFinal) ||
      !Number.isFinite(factorVariable) ||
      !Number.isFinite(idFormula)
    ) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Valores inválidos',
        text: 'Revisa total, monto final, factor fórmula y fórmula.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const putBody: MantenimientoActualPutPayload = {
      total,
      idFormula: Math.floor(idFormula),
      montoFinal,
      factorVariable,
      ocupoFormula,
    };

    this.mantenimientoGuardando = true;
    this.cdr.markForCheck();

    if (this.mantenimientoModalModo === 'edicion' && this.mantenimientoEditId != null) {
      this.mantenimientoActualService.actualizarMantenimiento(this.mantenimientoEditId, putBody)
        .pipe(
          take(1),
          finalize(() => {
            this.mantenimientoGuardando = false;
            this.cdr.markForCheck();
          }),
        )
        .subscribe({
          next: () =>
            this.onMantenimientoGuardadoOk('El mantenimiento se actualizó correctamente.'),
          error: (err) => this.onMantenimientoGuardadoError(err),
        });
      return;
    }

    const idArrendatario = Number(raw.idArrendatario);
    const idContrato = Number(raw.idContrato);
    if (
      !Number.isFinite(idArrendatario) ||
      idArrendatario <= 0 ||
      !Number.isFinite(idContrato) ||
      idContrato <= 0
    ) {
      this.mantenimientoGuardando = false;
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Arrendatario y contrato',
        text: 'Selecciona arrendatario y contrato para registrar el mantenimiento.',
        confirmButtonText: 'Entendido',
      });
      this.cdr.markForCheck();
      return;
    }

    const postBody: MantenimientoActualPostPayload = {
      idArrendatario: Math.floor(idArrendatario),
      idContrato: Math.floor(idContrato),
      ...putBody,
    };

    this.mantenimientoActualService.registrarMantenimiento(postBody)
      .pipe(
        take(1),
        finalize(() => {
          this.mantenimientoGuardando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () =>
          this.onMantenimientoGuardadoOk('El mantenimiento del mes se registró correctamente.'),
        error: (err) => this.onMantenimientoGuardadoError(err),
      });
  }

  private onMantenimientoGuardadoOk(texto: string): void {
    this.cerrarModalMantenimiento();
    this.dataGrid?.instance?.refresh();
    void Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      icon: 'success',
      title: '¡Operación Exitosa!',
      text: texto,
      confirmButtonText: 'Listo',
    });
  }

  private onMantenimientoGuardadoError(err: unknown): void {
    void Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      icon: 'error',
      title: 'No se pudo guardar',
      text: this.mensajeErrorHttp(err),
      confirmButtonText: 'Entendido',
    });
  }

  async marcarMantenimientoPagado(row: MantenimientoActualGridRow): Promise<void> {
    if (row?.pagada) return;
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;

    const periodo = row.mesLabel && row.mesLabel !== '—' ? row.mesLabel : 'este periodo';
    const result = await Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      icon: 'question',
      title: '¡Registrar Pago!',
      html: `Se registrara como pagado el mantenimiento de <strong>${row.arrendatarioLabel}</strong> (${periodo}).`,
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    this.mantenimientoActualService.marcarComoPagada(Math.floor(id))
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.dataGrid?.instance?.refresh();
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'success',
            title: '¡Operación Exitosa!',
            text: 'El mantenimiento quedó marcado como pagado y se registró en el histórico.',
            confirmButtonText: 'Listo',
          });
        },
        error: (err) => {
          console.error('Error al marcar mantenimiento pagado:', err);
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'error',
            title: 'No se pudo marcar como pagado',
            text: this.mensajeErrorHttp(err),
            confirmButtonText: 'Entendido',
          });
        },
      });
  }

  private leerEmbebidoEnHub(): boolean {
    let actual: ActivatedRoute | null = this.route;
    while (actual) {
      if (actual.snapshot.data['hubEmbebido']) return true;
      actual = actual.parent;
    }
    return false;
  }

  private mensajeErrorHttp(err: unknown): string {
    const e = err as {
      error?: string | { message?: string; mensaje?: string };
      message?: string;
    };
    const nested = e?.error;
    if (typeof nested === 'string' && nested.trim()) return nested;
    if (nested && typeof nested === 'object') {
      const msg = nested.message ?? nested.mensaje;
      if (msg != null && String(msg).trim()) return String(msg);
    }
    if (e?.message) return String(e.message);
    return 'Ocurrió un error al comunicarse con el servidor.';
  }
}
