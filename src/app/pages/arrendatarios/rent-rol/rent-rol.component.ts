import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { CellPreparedEvent, RowPreparedEvent } from 'devextreme/ui/data_grid';
import { lastValueFrom, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';
import {
  contractDimAnim,
  contractModalAnim,
  routeAnimation,
} from 'src/app/pipe/module-open.animation';
import { animate, style, transition, trigger } from '@angular/animations';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import { manejarErrorHttp413 } from 'src/app/shared/swal-archivos-pesados';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { HistoricoPagosRentaService } from 'src/app/services/moduleService/historico-pagos-renta.service';
import { InmueblesService } from 'src/app/services/moduleService/inmuebles.service';
import {
  contarMontoSimbolosAntesCursor,
  cursorMontoTrasFormato,
  formatMonedaAlEscribir,
  formatMonedaDesdeNumeroNatural,
  parseMonedaNumerico,
} from 'src/app/shared/valor-miles-format';
import {
  calcularMontosRentRolCaptura,
  construirFormDataArrendatarioCaptura,
  mapClientesAOpciones,
  mapInmueblesAOpciones,
  mapLocalesLibresAOpciones,
  redondearMontoRentRol,
  RentRolLocalOpcion,
  RentRolMontosPreview,
  RentRolSelectOpcion,
} from './rent-rol-captura.helpers';
import {
  extraerFilasRentRolApi,
  extraerMetaPaginacionRentRol,
  filtrarRegistrosRentRol,
  flattenRentRolRowsToGridLines,
  mapHistoricoPagoRentaToRentRolRow,
  mapRentaActualPendienteToRentRolRow,
  RENT_ROL_COLUMNAS_ROWSPAN,
  RENT_ROL_FILAS_GRID_POR_PAGINA,
  RENT_ROL_REGISTROS_POR_PAGINA,
  RentRolGridLine,
  RentRolRow,
} from './rent-rol-list.mapper';
import { exportarRentRolExcel, exportarRentRolPdf } from './rent-rol-export';
import {
  RentaActualPostPayload,
  RentaActualService,
} from 'src/app/services/moduleService/renta-actual.service';
import {
  extraerFilasRentasActualApi,
  mapRentaActualApiToGridRow,
  RentaActualGridRow,
} from '../pagos-renta/lista-rentas-actuales/renta-actual-list.mapper';
import { ListaRentasActualesComponent } from '../pagos-renta/lista-rentas-actuales/lista-rentas-actuales.component';
import {
  cargarTodasRentasActuales,
  cubreMes,
  mapRentaActualAPendiente,
} from './pago-renta/rent-rol-pago-renta.helpers';
import { RentRolAperturaStore } from './pago-renta/rent-rol-apertura.store';
import {
  etiquetaContratoArrendatarioApi,
  extraerFilasPaginadasApi,
  nombreArrendatarioDesdeApi,
  resolverIdArrendatarioApi,
} from '../arrendatarios-list.mapper';

const rrCapturaRevealAnim = trigger('rrCapturaReveal', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(10px)', height: 0, overflow: 'hidden' }),
    animate(
      '240ms cubic-bezier(0.22, 1, 0.36, 1)',
      style({ opacity: 1, transform: 'translateY(0)', height: '*', overflow: 'visible' }),
    ),
  ]),
  transition(':leave', [
    style({ opacity: 1, transform: 'translateY(0)', overflow: 'hidden' }),
    animate(
      '180ms ease-in',
      style({ opacity: 0, transform: 'translateY(-6px)', height: 0 }),
    ),
  ]),
]);

const rrCapturaFadeAnim = trigger('rrCapturaFade', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.98)' }),
    animate(
      '200ms cubic-bezier(0.22, 1, 0.36, 1)',
      style({ opacity: 1, transform: 'scale(1)' }),
    ),
  ]),
  transition(':leave', [
    animate('150ms ease-in', style({ opacity: 0, transform: 'scale(0.98)' })),
  ]),
]);

@Component({
  selector: 'app-rent-rol',
  templateUrl: './rent-rol.component.html',
  styleUrl: './rent-rol.component.scss',
  standalone: false,
  animations: [
    routeAnimation,
    contractDimAnim,
    contractModalAnim,
    rrCapturaRevealAnim,
    rrCapturaFadeAnim,
  ],
})
export class RentRolComponent implements OnInit, OnDestroy {
  readonly REGISTROS_POR_PAGINA = RENT_ROL_REGISTROS_POR_PAGINA;
  readonly FILAS_GRID_POR_PAGINA = RENT_ROL_FILAS_GRID_POR_PAGINA;
  private readonly LIMITE_CARGA_BUSQUEDA = 100;
  private readonly mapaCentroCuernavaca = { lat: 18.9186, lng: -99.2341 };
  private readonly mapaZoomCuernavaca = 13;
  private readonly apiKey = 'AIzaSyDuJ3IBZIs2mRbR4alTg7OZIsk0sXEJHhg';
  private readonly PIN_URL = 'assets/images/logos/marker_spring.webp';

  listaRentRol!: InstanceType<typeof CustomStore>;
  cargando = false;
  cargandoBusqueda = false;
  paginaActual = 1;
  totalRegistros = 0;
  totalPaginasApi = 1;
  totalRegistrosFiltrados = 0;

  /**
   * Fecha del DateBox (cualquier día del mes).
   * El API sigue recibiendo fechaInicio/fechaFin del mes completo.
   */
  mesFechaFiltro: Date = this.fechaMesPorDefecto();
  private mesFiltro = '';
  fechaInicioFiltro = '';
  fechaFinFiltro = '';
  idArrendatarioFiltro: number | null = null;
  idContratoFiltro: number | null = null;
  arrendatariosFiltroOpciones: { id: number; label: string }[] = [];
  contratosFiltroOpciones: { id: number; label: string }[] = [];
  catalogosFiltroCargando = false;
  private arrendatariosCatalogoFiltro: Record<string, unknown>[] = [];
  busquedaTexto = '';

  /** Calendario DevExtreme en vista de meses (sin elegir día). */
  readonly mesCalendarOptions = {
    zoomLevel: 'year' as const,
    maxZoomLevel: 'year' as const,
    minZoomLevel: 'century' as const,
  };

  registrosVisibles: RentRolRow[] = [];
  /** Conjunto usado por los KPIs: todos del periodo o todos los filtrados en búsqueda. */
  registrosParaKpi: RentRolRow[] = [];

  private cacheRegistrosKey = '';
  private todosRegistrosCache: RentRolRow[] = [];
  private busquedaTimer?: ReturnType<typeof setTimeout>;

  // ── Captura modal ──────────────────────────────────────────────
  mostrarModalCaptura = false;
  capturaForm!: FormGroup;
  catalogosCapturaCargando = false;
  cargandoInmuebles = false;
  cargandoLocales = false;
  inmueblesConsultados = false;
  localesConsultados = false;
  localesDropdownAbierto = false;
  guardandoCaptura = false;
  arrendadoresOpciones: RentRolSelectOpcion[] = [];
  inmueblesOpciones: RentRolSelectOpcion[] = [];
  localesOpciones: RentRolLocalOpcion[] = [];
  localesSeleccionados = new Set<number>();
  /** Misma semántica que agregar-arrendatario: UI «Sí» = sin capturar mantto (form 0). */
  switchManttoSi = true;
  /** Vista con `$` del subtotal; el FormControl guarda el número. */
  capturaSubtotalDisplay = '';
  private capturaMontosBlurTimer: ReturnType<typeof setTimeout> | undefined;
  private capturaCalcCampoFoco: Record<string, boolean> = {};
  montosPreview: RentRolMontosPreview = calcularMontosRentRolCaptura({
    metros: null,
    subTotalRenta: null,
    incluyeMantenimiento: false,
    pctMantenimiento: null,
  });

  mostrarModalMapa = false;
  latSeleccionada: number | null = null;
  lngSeleccionada: number | null = null;
  private map: unknown = null;
  private marker: unknown = null;

  exportMenuAbierto = false;

  @ViewChild('gridRentRol', { static: false })
  gridRentRol?: DxDataGridComponent;

  /** Modal de renta de Pagos del mes (misma lógica), usado en modo solo-modal. */
  @ViewChild(ListaRentasActualesComponent)
  rentasMes?: ListaRentasActualesComponent;

  constructor(
    private historicoPagosRentaService: HistoricoPagosRentaService,
    private rentaActualService: RentaActualService,
    private arrendatariosService: ArrendatariosService,
    private inmueblesService: InmueblesService,
    private clientesService: ClientesService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) {}

  get totalPaginas(): number {
    return this.totalPaginasApi;
  }

  get modoBusquedaActivo(): boolean {
    return this.busquedaTexto.trim().length > 0;
  }

  get paginaInicio(): number {
    return (this.paginaActual - 1) * this.REGISTROS_POR_PAGINA;
  }

  get paginaFin(): number {
    if (this.modoBusquedaActivo) {
      return Math.min(this.paginaInicio + this.registrosVisibles.length, this.totalRegistrosFiltrados);
    }
    return Math.min(this.paginaInicio + this.registrosVisibles.length, this.totalRegistros);
  }

  get totalRenta(): number {
    return this.redondear(this.filasParaKpi().reduce((s, r) => s + r.renta.subTotal, 0));
  }

  get totalIvaRenta(): number {
    return this.redondear(this.filasParaKpi().reduce((s, r) => s + r.renta.iva, 0));
  }

  get totalRentaConIva(): number {
    return this.redondear(this.filasParaKpi().reduce((s, r) => s + r.renta.montoFinal, 0));
  }

  get totalMantto(): number {
    return this.redondear(this.filasParaKpi().reduce((s, r) => s + r.mantenimiento.subTotal, 0));
  }

  get totalIvaMantto(): number {
    return this.redondear(this.filasParaKpi().reduce((s, r) => s + r.mantenimiento.iva, 0));
  }

  get totalManttoConIva(): number {
    return this.redondear(this.filasParaKpi().reduce((s, r) => s + r.mantenimiento.montoFinal, 0));
  }

  get subTotalCombinado(): number {
    return this.redondear(this.totalRenta + this.totalMantto);
  }

  get ivaCombinado(): number {
    return this.redondear(this.totalIvaRenta + this.totalIvaMantto);
  }

  get granTotal(): number {
    return this.redondear(this.totalRentaConIva + this.totalManttoConIva);
  }

  get placeholderInmueble(): string {
    if (this.mostrarAvisoSeleccionarArrendadorInmueble) return 'Selecciona arrendador primero';
    if (this.cargandoInmuebles) return 'Cargando inmuebles…';
    if (this.inmueblesConsultados && this.inmueblesOpciones.length === 0) {
      return 'Sin inmuebles registrados';
    }
    return 'Selecciona inmueble';
  }

  get mostrarAvisoSeleccionarArrendadorInmueble(): boolean {
    const idArr = Number(this.capturaForm?.get('idArrendador')?.value);
    return !(Number.isFinite(idArr) && idArr > 0);
  }

  get mostrarAvisoSeleccionarInmuebleLocales(): boolean {
    return !this.mostrarAvisoSeleccionarArrendadorInmueble && !this.capturaForm?.get('idInmueble')?.value;
  }

  get mostrarAvisoLocalesVacios(): boolean {
    return (
      !!this.capturaForm?.get('idInmueble')?.value &&
      !this.cargandoLocales &&
      this.localesConsultados &&
      this.localesOpciones.length === 0
    );
  }

  get localesPickerDeshabilitado(): boolean {
    return !this.capturaForm?.get('idInmueble')?.value || this.cargandoLocales;
  }

  get tieneLocalesSeleccionados(): boolean {
    return this.localesSeleccionados.size > 0;
  }

  get idLocalesSeleccionados(): number[] {
    return [...this.localesSeleccionados];
  }

  get resumenLocalesSeleccionados(): string {
    const n = this.localesSeleccionados.size;
    if (n <= 0) return '';
    if (n === 1) {
      const id = this.idLocalesSeleccionados[0];
      return this.nombreLocalPorId(id);
    }
    return `${n} locales seleccionados`;
  }

  get placeholderLocales(): string {
    if (this.cargandoLocales) return 'Cargando locales…';
    if (!this.capturaForm?.get('idInmueble')?.value) return 'Selecciona inmueble primero';
    if (this.localesConsultados && this.localesOpciones.length === 0) return 'Sin locales disponibles';
    return 'Selecciona local(es)';
  }

  get cerrarCapturaBloqueado(): boolean {
    return this.guardandoCaptura;
  }

  /** Label / visual del switch (como contratoIncluyeMantenimiento en agregar-arrendatario). */
  get switchManttoVisualSi(): boolean {
    return this.switchManttoSi;
  }

  /** Formulario: 1 = se captura mantenimiento (UI en «No»). */
  get incluyeMantenimiento(): boolean {
    return Number(this.capturaForm?.get('incluyeMantenimiento')?.value) === 1;
  }

  get switchManttoHabilitado(): boolean {
    const fromCtrl = Number(this.capturaForm?.get('subTotalRenta')?.value);
    if (Number.isFinite(fromCtrl) && fromCtrl > 0) return true;
    const n = parseMonedaNumerico(this.capturaSubtotalDisplay);
    return Number.isFinite(n) && n > 0;
  }

  montoDisplay(valor: number | null | undefined, listo = true): string {
    if (!listo || valor == null || !Number.isFinite(valor)) return '';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor);
  }

  readonly mapaTitulo = 'Ubicación del arrendatario';
  readonly mapaSubtitulo = 'Toca el mapa para registrar la ubicación del arrendatario.';

  ngOnInit(): void {
    this.mesFechaFiltro = this.fechaMesPorDefecto();
    this.sincronizarFechasDesdeMesFecha();
    this.initCapturaForm();
    this.setupDataSource();
    this.cargarCatalogosFiltro();
  }

  private cargarCatalogosFiltro(): void {
    this.catalogosFiltroCargando = true;
    void lastValueFrom(this.arrendatariosService.obtenerArrendatariosPaginated(1, 300))
      .then((resp) => {
        this.arrendatariosCatalogoFiltro = extraerFilasPaginadasApi(resp);
        this.arrendatariosFiltroOpciones = this.arrendatariosCatalogoFiltro
          .map((r) => {
            const id = resolverIdArrendatarioApi(r);
            if (id == null) return null;
            const nombre = nombreArrendatarioDesdeApi(r);
            return { id, label: nombre || `Arrendatario #${id}` };
          })
          .filter((x): x is { id: number; label: string } => x != null);
        this.sincronizarContratosFiltro(this.idArrendatarioFiltro);
      })
      .catch((err) => console.error('Error catálogos filtro rent-rol:', err))
      .finally(() => {
        this.catalogosFiltroCargando = false;
        this.cdr.markForCheck();
      });
  }

  onArrendatarioFiltroChange(): void {
    this.sincronizarContratosFiltro(this.idArrendatarioFiltro);
    this.cdr.markForCheck();
  }

  private sincronizarContratosFiltro(idArrendatario: number | null): void {
    const id = Number(idArrendatario);
    if (!Number.isFinite(id) || id <= 0) {
      this.contratosFiltroOpciones = [];
      this.idContratoFiltro = null;
      return;
    }
    const item = this.arrendatariosCatalogoFiltro.find(
      (r) => resolverIdArrendatarioApi(r) === Math.floor(id),
    );
    const contratos = Array.isArray(item?.['contratos'])
      ? (item['contratos'] as unknown[])
      : [];
    this.contratosFiltroOpciones = contratos
      .map((raw) => {
        if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
        const c = raw as Record<string, unknown>;
        const idContrato = Number(c['id'] ?? c['idContrato']);
        if (!Number.isFinite(idContrato) || idContrato <= 0) return null;
        return {
          id: Math.floor(idContrato),
          label: etiquetaContratoArrendatarioApi(c),
        };
      })
      .filter((x): x is { id: number; label: string } => x != null);

    const actual = Number(this.idContratoFiltro);
    if (!this.contratosFiltroOpciones.some((o) => o.id === actual)) {
      this.idContratoFiltro = null;
    }
  }

  textoPlaceholderContratoFiltro(): string {
    const idArr = Number(this.idArrendatarioFiltro);
    if (!Number.isFinite(idArr) || idArr <= 0) {
      return 'Seleccione arrendatario primero';
    }
    return this.contratosFiltroOpciones.length ? 'Todos los contratos' : 'Sin contratos';
  }

  ngOnDestroy(): void {
    clearTimeout(this.busquedaTimer);
    if (this.capturaMontosBlurTimer != null) clearTimeout(this.capturaMontosBlurTimer);
  }

  onBusquedaInput(event: Event): void {
    const valor = (event.target as HTMLInputElement).value ?? '';
    clearTimeout(this.busquedaTimer);
    this.busquedaTimer = setTimeout(() => this.aplicarBusqueda(valor), 350);
  }

  limpiarBusqueda(): void {
    clearTimeout(this.busquedaTimer);
    this.busquedaTexto = '';
    this.totalRegistrosFiltrados = 0;
    this.registrosParaKpi = [];
    this.gridRentRol?.instance?.pageIndex(0);
    this.gridRentRol?.instance?.refresh();
  }

  /** Aplica el mes seleccionado (se traduce a fechaInicio/fechaFin del mes completo). */
  aplicarFiltros(): void {
    this.sincronizarFechasDesdeMesFecha();
    if (!this.mesFiltro || !this.fechaInicioFiltro || !this.fechaFinFiltro) {
      void this.alertaValidacion('Selecciona el mes a consultar.');
      return;
    }
    this.cacheRegistrosKey = '';
    this.todosRegistrosCache = [];
    this.registrosParaKpi = [];
    this.gridRentRol?.instance?.pageIndex(0);
    this.gridRentRol?.instance?.refresh();
  }

  onMesFechaChange(e: { value?: Date | string | number | null }): void {
    const v = e?.value;
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      this.mesFechaFiltro = v;
    } else if (typeof v === 'string' || typeof v === 'number') {
      const parsed = new Date(v);
      if (!Number.isNaN(parsed.getTime())) {
        this.mesFechaFiltro = parsed;
      }
    }
    this.sincronizarFechasDesdeMesFecha();
  }

  onRowPrepared(e: RowPreparedEvent): void {
    if (e.rowType !== 'data' || e.data == null) return;
    const line = e.data as RentRolGridLine;
    const rowEl = e.rowElement as HTMLElement | undefined;
    if (!rowEl) return;

    rowEl.classList.add(line.esLineaRenta ? 'row-renta' : 'row-mant');
    rowEl.classList.add(
      line.esLineaRenta ? line.claseEstatusRenta : line.claseEstatusMantenimiento,
    );
  }

  onCellPrepared(e: CellPreparedEvent): void {
    if (e.rowType !== 'data' || e.data == null) return;

    const cell = e.cellElement as HTMLElement | undefined;
    if (!cell) return;

    if (e.column?.type === 'adaptive') {
      cell.style.display = 'none';
      return;
    }

    const field = e.column?.dataField ? String(e.column.dataField) : '';
    if (!field || !RENT_ROL_COLUMNAS_ROWSPAN.includes(field)) return;

    const line = e.data as RentRolGridLine;
    if (line.esLineaRenta) {
      cell.setAttribute('rowspan', '2');
      cell.classList.add('rr-grid-cell--span');
      return;
    }

    cell.style.display = 'none';
  }

  // ── Captura ────────────────────────────────────────────────────

  abrirModalCaptura(): void {
    this.resetCapturaForm();
    this.mostrarModalCaptura = true;
    this.cargarCatalogosCaptura();
  }

  cerrarModalCaptura(): void {
    if (this.cerrarCapturaBloqueado) return;
    this.mostrarModalCaptura = false;
    this.localesDropdownAbierto = false;
    this.cerrarModalMapa(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    this.cerrarLocalesSiClickFuera(event.target);
    this.cerrarExportSiClickFuera(event.target);
  }

  @HostListener('document:focusin', ['$event'])
  onDocumentFocusIn(event: FocusEvent): void {
    this.cerrarLocalesSiClickFuera(event.target);
  }

  /** El modal corta el bubble a document; hay que cerrar también desde ahí. */
  onCapturaModalClick(event: MouseEvent): void {
    event.stopPropagation();
    this.cerrarLocalesSiClickFuera(event.target);
  }

  private cerrarLocalesSiClickFuera(target: EventTarget | null): void {
    if (!this.localesDropdownAbierto) return;
    const el = target as HTMLElement | null;
    if (el?.closest?.('.arrend-locales-picker-wrap')) return;
    this.cerrarLocalesDropdown();
    this.cdr.markForCheck();
  }

  onInmuebleChange(): void {
    const id = Number(this.capturaForm.get('idInmueble')?.value);
    this.localesOpciones = [];
    this.localesSeleccionados.clear();
    this.localesConsultados = false;
    this.cerrarLocalesDropdown();
    if (Number.isFinite(id) && id > 0) {
      this.cargarLocales(id);
    }
  }

  toggleLocalesDropdown(event?: Event): void {
    event?.stopPropagation();
    if (this.localesPickerDeshabilitado) return;
    this.localesDropdownAbierto = !this.localesDropdownAbierto;
    this.cdr.markForCheck();
  }

  cerrarLocalesDropdown(): void {
    if (!this.localesDropdownAbierto) return;
    this.localesDropdownAbierto = false;
  }

  toggleLocal(id: number, event?: Event): void {
    event?.stopPropagation();
    if (this.localesSeleccionados.has(id)) this.localesSeleccionados.delete(id);
    else this.localesSeleccionados.add(id);
  }

  quitarLocal(id: number, event: Event): void {
    event.stopPropagation();
    this.localesSeleccionados.delete(id);
  }

  localSeleccionado(id: number): boolean {
    return this.localesSeleccionados.has(id);
  }

  nombreLocalPorId(id: number): string {
    return this.localesOpciones.find((l) => l.id === id)?.nombre ?? `Local ${id}`;
  }

  onCapturaMetrosFocus(): void {
    this.capturaCalcCampoFoco = { ...this.capturaCalcCampoFoco, metrosRentados: true };
  }

  onCapturaMetrosBlur(): void {
    this.capturaCalcCampoFoco = { ...this.capturaCalcCampoFoco, metrosRentados: false };
    this.forzarSwitchManttoSiIncompleto();
    this.programarRecalculoAlSalirInputsCaptura();
    this.cdr.markForCheck();
  }

  onCapturaPctFocus(): void {
    if (this.switchManttoVisualSi) return;
    this.capturaCalcCampoFoco = { ...this.capturaCalcCampoFoco, pctMantenimiento: true };
  }

  onCapturaPctBlur(): void {
    this.capturaCalcCampoFoco = { ...this.capturaCalcCampoFoco, pctMantenimiento: false };
    this.programarRecalculoAlSalirInputsCaptura();
    this.cdr.markForCheck();
  }

  onCapturaSubtotalFocus(): void {
    this.capturaCalcCampoFoco = { ...this.capturaCalcCampoFoco, subTotalRenta: true };
  }

  onCapturaSubtotalInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cursor = input.selectionStart ?? 0;
    const simbolosAntes = contarMontoSimbolosAntesCursor(input.value, cursor);
    const formatted = formatMonedaAlEscribir(input.value);
    this.capturaSubtotalDisplay = formatted;
    input.value = formatted;
    const newCursor = cursorMontoTrasFormato(formatted, simbolosAntes);
    input.setSelectionRange(newCursor, newCursor);
    this.forzarSwitchManttoSiIncompleto();
    this.cdr.markForCheck();
  }

  onCapturaSubtotalBlur(): void {
    const n = parseMonedaNumerico(this.capturaSubtotalDisplay);
    if (Number.isFinite(n)) {
      const valor = redondearMontoRentRol(n);
      this.capturaForm.get('subTotalRenta')?.setValue(valor, { emitEvent: false });
      this.capturaSubtotalDisplay = formatMonedaDesdeNumeroNatural(valor);
    } else {
      this.capturaForm.get('subTotalRenta')?.setValue('', { emitEvent: false });
      this.capturaSubtotalDisplay = '';
    }
    this.capturaCalcCampoFoco = { ...this.capturaCalcCampoFoco, subTotalRenta: false };
    this.forzarSwitchManttoSiIncompleto();
    this.programarRecalculoAlSalirInputsCaptura();
    this.cdr.markForCheck();
  }

  private algunInputCalculoCapturaEnfocado(): boolean {
    return !!(
      this.capturaCalcCampoFoco['metrosRentados'] ||
      this.capturaCalcCampoFoco['subTotalRenta'] ||
      this.capturaCalcCampoFoco['pctMantenimiento']
    );
  }

  private programarRecalculoAlSalirInputsCaptura(): void {
    if (this.capturaMontosBlurTimer != null) clearTimeout(this.capturaMontosBlurTimer);
    this.capturaMontosBlurTimer = setTimeout(() => {
      this.capturaMontosBlurTimer = undefined;
      if (this.algunInputCalculoCapturaEnfocado()) return;
      this.recalcularMontosPreview();
      this.cdr.markForCheck();
    }, 0);
  }

  /** Sin subtotal de renta el switch queda en Sí (igual que agregar-arrendatario). */
  private forzarSwitchManttoSiIncompleto(): void {
    if (this.switchManttoHabilitado) return;
    this.switchManttoSi = true;
    if (Number(this.capturaForm.get('incluyeMantenimiento')?.value) === 0) {
      this.limpiarCamposMantenimientoCaptura();
      return;
    }
    this.capturaForm.patchValue({ incluyeMantenimiento: 0, pctMantenimiento: '' }, { emitEvent: false });
    this.limpiarCamposMantenimientoCaptura();
  }

  private limpiarCamposMantenimientoCaptura(): void {
    const pctCtrl = this.capturaForm.get('pctMantenimiento');
    pctCtrl?.clearValidators();
    pctCtrl?.setValue('', { emitEvent: false });
    pctCtrl?.updateValueAndValidity({ emitEvent: false });
  }

  onIncluyeManttoClick(event: Event): void {
    if (this.switchManttoHabilitado) return;
    event.preventDefault();
    event.stopPropagation();
    this.forzarSwitchManttoSiIncompleto();
    this.cdr.markForCheck();
  }

  onIncluyeManttoChange(activo: boolean): void {
    if (!this.switchManttoHabilitado) {
      this.forzarSwitchManttoSiIncompleto();
      this.cdr.markForCheck();
      return;
    }
    // Igual que agregar-arrendatario: checked/Sí → form 0; unchecked/No → form 1.
    this.switchManttoSi = activo;
    this.capturaForm.get('incluyeMantenimiento')?.setValue(activo ? 0 : 1, { emitEvent: false });
    if (activo) {
      this.limpiarCamposMantenimientoCaptura();
    } else {
      const pctCtrl = this.capturaForm.get('pctMantenimiento');
      pctCtrl?.setValidators([Validators.required, Validators.min(0.01)]);
      pctCtrl?.updateValueAndValidity({ emitEvent: false });
    }
    this.recalcularMontosPreview();
    this.cdr.detectChanges();
  }

  continuarAUbicacionArrendatario(): void {
    if (!this.validarCapturaAntesMapa()) return;
    this.abrirModalMapa();
  }

  cerrarModalMapa(desdeUsuario = true): void {
    if (desdeUsuario && this.cerrarCapturaBloqueado) return;
    this.mostrarModalMapa = false;
    this.latSeleccionada = null;
    this.lngSeleccionada = null;
    this.map = null;
    this.marker = null;
  }

  confirmarUbicacionMapa(): void {
    if (this.latSeleccionada == null || this.lngSeleccionada == null) {
      void this.alertaValidacion('Selecciona un punto en el mapa.');
      return;
    }
    void this.guardarArrendatarioCaptura();
  }

  onTipoPersonaChange(_event: Event): void {
    const raw = this.capturaForm.get('tipoPersona')?.value;
    const value =
      raw === null || raw === undefined || raw === '' ? null : Number(raw);
    this.capturaForm.get('tipoPersona')?.setValue(value, { emitEvent: true });
  }

  sanitizeRfcInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const sanitizedValue = inputElement.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 13);
    inputElement.value = sanitizedValue;
    this.capturaForm.get('rfc')?.setValue(sanitizedValue, { emitEvent: false });
  }

  private initCapturaForm(): void {
    this.capturaForm = this.fb.group({
      arrendatario: ['', Validators.required],
      idArrendador: [null as number | null, Validators.required],
      tipoPersona: [null as number | null],
      rfc: [''],
      idInmueble: [{ value: null as number | null, disabled: true }, Validators.required],
      metrosRentados: ['', [Validators.required, Validators.min(0.01)]],
      subTotalRenta: ['', [Validators.required, Validators.min(0.01)]],
      costoM2: [''],
      fechaInicioContrato: ['', Validators.required],
      fechaTerminoContrato: ['', Validators.required],
      incluyeMantenimiento: [0],
      pctMantenimiento: [''],
      lat: [null as number | null],
      lng: [null as number | null],
    });
    this.capturaForm.get('idArrendador')?.valueChanges.subscribe((raw) => {
      const id = Number(raw);
      this.capturaForm.patchValue({ idInmueble: null }, { emitEvent: false });
      this.inmueblesOpciones = [];
      this.localesOpciones = [];
      this.localesSeleccionados.clear();
      this.inmueblesConsultados = false;
      this.localesConsultados = false;
      this.cerrarLocalesDropdown();
      if (!Number.isFinite(id) || id <= 0) {
        this.actualizarEstadoSelectInmueble();
        return;
      }
      this.cargarInmuebles(id);
    });
  }

  private resetCapturaForm(): void {
    this.capturaForm.reset({
      arrendatario: '',
      idArrendador: null,
      tipoPersona: null,
      rfc: '',
      idInmueble: null,
      metrosRentados: '',
      subTotalRenta: '',
      costoM2: '',
      fechaInicioContrato: '',
      fechaTerminoContrato: '',
      incluyeMantenimiento: 0,
      pctMantenimiento: '',
      lat: null,
      lng: null,
    });
    this.capturaForm.get('idInmueble')?.disable({ emitEvent: false });
    this.capturaForm.get('pctMantenimiento')?.clearValidators();
    this.capturaForm.get('pctMantenimiento')?.updateValueAndValidity({ emitEvent: false });
    this.switchManttoSi = true;
    this.capturaSubtotalDisplay = '';
    this.capturaCalcCampoFoco = {};
    if (this.capturaMontosBlurTimer != null) {
      clearTimeout(this.capturaMontosBlurTimer);
      this.capturaMontosBlurTimer = undefined;
    }
    this.inmueblesOpciones = [];
    this.localesOpciones = [];
    this.localesSeleccionados.clear();
    this.inmueblesConsultados = false;
    this.localesConsultados = false;
    this.localesDropdownAbierto = false;
    this.recalcularMontosPreview();
  }

  private cargarCatalogosCaptura(): void {
    this.catalogosCapturaCargando = true;
    this.clientesService
      .obtenerClientes()
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          this.catalogosCapturaCargando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe((res) => {
        this.arrendadoresOpciones = mapClientesAOpciones(res);
        this.cdr.markForCheck();
      });
  }

  private cargarInmuebles(idArrendador: number): void {
    this.cargandoInmuebles = true;
    this.inmueblesConsultados = false;
    this.capturaForm.get('idInmueble')?.disable({ emitEvent: false });
    this.inmueblesService
      .obtenerInmueblesPorArrendador(idArrendador)
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          this.cargandoInmuebles = false;
          this.inmueblesConsultados = true;
          this.actualizarEstadoSelectInmueble();
          this.cdr.markForCheck();
        }),
      )
      .subscribe((res) => {
        this.inmueblesOpciones = mapInmueblesAOpciones(res);
        this.actualizarEstadoSelectInmueble();
        this.cdr.markForCheck();
      });
  }

  private actualizarEstadoSelectInmueble(): void {
    const ctrl = this.capturaForm.get('idInmueble');
    if (!ctrl) return;
    const idArr = Number(this.capturaForm.get('idArrendador')?.value);
    const sinArrendador = !(Number.isFinite(idArr) && idArr > 0);
    const deshabilitado =
      sinArrendador || this.cargandoInmuebles || this.inmueblesOpciones.length === 0;
    if (deshabilitado) {
      ctrl.disable({ emitEvent: false });
    } else {
      ctrl.enable({ emitEvent: false });
    }
  }

  private cargarLocales(idInmueble: number): void {
    this.cargandoLocales = true;
    this.localesConsultados = false;
    this.inmueblesService
      .obtenerLocalesLibres(idInmueble)
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          this.cargandoLocales = false;
          this.localesConsultados = true;
          this.cdr.markForCheck();
        }),
      )
      .subscribe((res) => {
        this.localesOpciones = mapLocalesLibresAOpciones(res);
        this.cdr.markForCheck();
      });
  }

  private sincronizarSubtotalDesdeDisplay(): void {
    const n = parseMonedaNumerico(this.capturaSubtotalDisplay);
    if (Number.isFinite(n)) {
      const valor = redondearMontoRentRol(n);
      this.capturaForm.get('subTotalRenta')?.setValue(valor, { emitEvent: false });
      this.capturaSubtotalDisplay = formatMonedaDesdeNumeroNatural(valor);
    } else {
      this.capturaForm.get('subTotalRenta')?.setValue('', { emitEvent: false });
      this.capturaSubtotalDisplay = '';
    }
  }

  private recalcularMontosPreview(): void {
    const v = this.capturaForm.getRawValue();
    this.montosPreview = calcularMontosRentRolCaptura({
      metros: v.metrosRentados,
      subTotalRenta: v.subTotalRenta,
      incluyeMantenimiento: Number(v.incluyeMantenimiento) === 1,
      pctMantenimiento: v.pctMantenimiento,
    });
    this.capturaForm.get('costoM2')?.setValue(this.montosPreview.costoM2 ?? '', {
      emitEvent: false,
    });
  }

  /** Todos los campos del modal son obligatorios; si mantenimiento = No, también el %. */
  private recolectarCamposFaltantesCaptura(): string[] {
    this.capturaForm.markAllAsTouched();
    this.capturaForm.get('incluyeMantenimiento')?.setValue(this.switchManttoSi ? 0 : 1, {
      emitEvent: false,
    });
    this.sincronizarSubtotalDesdeDisplay();
    this.recalcularMontosPreview();

    const faltantes: string[] = [];

    if (!String(this.capturaForm.get('arrendatario')?.value ?? '').trim()) {
      faltantes.push('Arrendatario');
    }
    if (!Number(this.capturaForm.get('idArrendador')?.value)) {
      faltantes.push('Arrendador');
    }

    const idInmueble = Number(this.capturaForm.get('idInmueble')?.value);
    if (!(Number.isFinite(idInmueble) && idInmueble > 0)) {
      faltantes.push('Inmueble');
    }

    if (Number.isFinite(idInmueble) && idInmueble > 0) {
      if (this.localesConsultados && this.localesOpciones.length === 0) {
        faltantes.push('Local(es) (el inmueble no tiene locales disponibles)');
      } else if (this.localesSeleccionados.size === 0) {
        faltantes.push('Local(es)');
      }
    } else if (this.localesSeleccionados.size === 0) {
      faltantes.push('Local(es)');
    }

    const fechaInicio = String(this.capturaForm.get('fechaInicioContrato')?.value ?? '').trim();
    const fechaTermino = String(this.capturaForm.get('fechaTerminoContrato')?.value ?? '').trim();
    if (!fechaInicio) faltantes.push('Fecha inicio');
    if (!fechaTermino) faltantes.push('Fecha término');
    if (fechaInicio && fechaTermino && fechaInicio > fechaTermino) {
      faltantes.push('Fecha término (debe ser mayor o igual a la fecha inicio)');
    }

    const metros = Number(this.capturaForm.get('metrosRentados')?.value);
    const subTotal = Number(this.capturaForm.get('subTotalRenta')?.value);
    if (!(Number.isFinite(metros) && metros > 0)) {
      faltantes.push('Metros rentados');
    }
    if (!(Number.isFinite(subTotal) && subTotal > 0)) {
      faltantes.push('Subtotal renta');
    }
    if (!this.montosPreview.renta.listo) {
      if (Number.isFinite(subTotal) && subTotal > 0) {
        faltantes.push('IVA / Renta total');
      }
    }

    // Incluye mantenimiento siempre tiene Sí/No; si es No, % y montos de mantto son obligatorios.
    if (!this.switchManttoSi) {
      const pct = Number(this.capturaForm.get('pctMantenimiento')?.value);
      if (!(Number.isFinite(pct) && pct > 0)) {
        faltantes.push('Porcentaje de mantenimiento');
      }
      if (!this.montosPreview.mantenimiento.listo) {
        if (Number.isFinite(pct) && pct > 0) {
          faltantes.push('Subtotal / IVA / Total de mantenimiento');
        }
      }
    }

    return faltantes;
  }

  private validarCapturaAntesMapa(): boolean {
    const faltantes = this.recolectarCamposFaltantesCaptura();
    if (faltantes.length) {
      void this.alertaValidacionCampos(faltantes);
      return false;
    }
    return true;
  }

  private abrirSwalCargando(title: string, text: string): void {
    void Swal.fire({
      title,
      text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      background: '#141a21',
      color: '#ffffff',
      didOpen: () => Swal.showLoading(),
    });
  }

  private esperarMs(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  /** Tras OK/error del servicio: media segundo con spinner y luego muestra resultado. */
  private async cerrarCargaYMostrarResultado(
    resultado: { ok: true; title: string; text: string } | { ok: false; text: string },
  ): Promise<void> {
    await this.esperarMs(500);
    Swal.close();
    if (resultado.ok) {
      await Swal.fire({
        color: '#ffffff',
        background: '#141a21',
        title: resultado.title,
        text: resultado.text,
        icon: 'success',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Confirmar',
      });
      return;
    }
    await Swal.fire({
      color: '#ffffff',
      background: '#141a21',
      title: '¡Ops!',
      text: resultado.text,
      icon: 'error',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Confirmar',
    });
  }

  private abrirModalMapa(): void {
    this.latSeleccionada = null;
    this.lngSeleccionada = null;
    this.mostrarModalMapa = true;
    this.cdr.detectChanges();
    void this.loadGoogleMaps()
      .then(() => this.initMapModal())
      .catch(() => {
        void Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          title: '¡Ops!',
          text: 'No se pudo cargar Google Maps. Revisa la conexión e intenta de nuevo.',
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
        });
        this.cerrarModalMapa(false);
      });
  }

  private async guardarArrendatarioCaptura(): Promise<void> {
    if (this.latSeleccionada == null || this.lngSeleccionada == null) return;
    if (!this.validarCapturaAntesGuardarArrendatario()) return;

    // Sincroniza switch UI ↔ form (Sí = form 0; No = form 1, igual que agregar-arrendatario).
    this.capturaForm.get('incluyeMantenimiento')?.setValue(this.switchManttoSi ? 0 : 1, {
      emitEvent: false,
    });
    this.recalcularMontosPreview();

    const v = this.capturaForm.getRawValue();
    this.capturaForm.patchValue({
      lat: this.latSeleccionada,
      lng: this.lngSeleccionada,
    });

    const incluyeMantenimiento = !this.switchManttoSi;
    const pctMantenimiento = Number(v.pctMantenimiento);

    this.guardandoCaptura = true;
    this.abrirSwalCargando('Cargando...', 'Guardando arrendatario, por favor espera.');

    try {
      const tipoPersonaRaw = v.tipoPersona;
      const tipoPersona =
        tipoPersonaRaw === null || tipoPersonaRaw === undefined || tipoPersonaRaw === ''
          ? null
          : Number(tipoPersonaRaw);

      const fd = construirFormDataArrendatarioCaptura({
        arrendatario: String(v.arrendatario ?? ''),
        rfc: String(v.rfc ?? ''),
        tipoPersona: Number.isFinite(tipoPersona as number) ? (tipoPersona as number) : null,
        idArrendador: Number(v.idArrendador),
        lat: this.latSeleccionada,
        lng: this.lngSeleccionada,
        idInmueble: Number(v.idInmueble),
        idLocales: [...this.localesSeleccionados],
        fechaInicioContrato: String(v.fechaInicioContrato ?? ''),
        fechaTerminoContrato: String(v.fechaTerminoContrato ?? ''),
        metrosRentados: Number(v.metrosRentados),
        subTotalRenta: Number(v.subTotalRenta),
        incluyeMantenimiento,
        pctMantenimiento: Number.isFinite(pctMantenimiento) ? pctMantenimiento : undefined,
      });

      await lastValueFrom(this.arrendatariosService.crearArrendatario(fd));
      this.cerrarModalMapa(false);
      this.mostrarModalCaptura = false;
      this.cacheRegistrosKey = '';
      this.todosRegistrosCache = [];
      this.gridRentRol?.instance?.refresh();
      await this.cerrarCargaYMostrarResultado({
        ok: true,
        title: '¡Operación Exitosa!',
        text: 'Se registró el arrendatario con su contrato.',
      });
      void this.router.navigateByUrl('/arrendatarios');
    } catch (err: unknown) {
      if (manejarErrorHttp413(err, true)) {
        this.guardandoCaptura = false;
        this.cdr.markForCheck();
        return;
      }
      const e = err as { error?: { message?: string }; message?: string };
      await this.cerrarCargaYMostrarResultado({
        ok: false,
        text: String(e?.error?.message ?? e?.message ?? 'No se pudo guardar el arrendatario.'),
      });
    } finally {
      this.guardandoCaptura = false;
      this.cdr.markForCheck();
    }
  }

  /** Validación al guardar arrendatario (tras confirmar en el mapa). */
  private validarCapturaAntesGuardarArrendatario(): boolean {
    const faltantes = this.recolectarCamposFaltantesCaptura();
    if (faltantes.length) {
      void this.alertaValidacionCampos(faltantes);
      return false;
    }
    return true;
  }

  private alertaValidacion(text: string): Promise<unknown> {
    return Swal.fire({
      color: '#ffffff',
      background: '#141a21',
      title: 'Faltan datos',
      text,
      icon: 'warning',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Entendido',
    });
  }

  private alertaValidacionCampos(faltantes: string[]): Promise<unknown> {
    const lista = faltantes
      .map(
        (campo, index) => `
      <div style="padding:8px 12px;border-left:4px solid #d9534f;background:#caa8a8;text-align:center;margin-bottom:8px;border-radius:4px;">
        <strong style="color:#b02a37;">${index + 1}. ${campo}</strong>
      </div>
    `,
      )
      .join('');

    return Swal.fire({
      color: '#ffffff',
      background: '#141a21',
      title: '¡Faltan campos obligatorios!',
      html: `
        <p style="text-align:center;font-size:15px;margin-bottom:16px;color:white">
          Los siguientes <strong>campos obligatorios</strong> están vacíos.<br>
          Por favor complétalos antes de continuar:
        </p>
        <div style="max-height:350px;overflow-y:auto;">${lista}</div>
      `,
      icon: 'error',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#3085d6',
      customClass: { popup: 'swal2-padding swal2-border' },
    });
  }

  private loadGoogleMaps(): Promise<void> {
    return new Promise((resolve, reject) => {
      const w = window as any;

      if (w.google && w.google.maps) {
        resolve();
        return;
      }

      const existingScript = document.querySelector('script[data-gmaps="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', (e) => reject(e));
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}`;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-gmaps', 'true');
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  private initMapModal(): void {
    const mapElement = document.getElementById('mapRentRolCaptura');
    if (!mapElement) return;

    const w = window as any;
    if (!w.google || !w.google.maps) return;

    const lat = this.mapaCentroCuernavaca.lat;
    const lng = this.mapaCentroCuernavaca.lng;

    this.map = new w.google.maps.Map(mapElement, {
      center: { lat, lng },
      zoom: this.mapaZoomCuernavaca,
    });

    (this.map as any).addListener('click', (e: any) => {
      const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      this.latSeleccionada = p.lat;
      this.lngSeleccionada = p.lng;
      this.actualizarMarcador(p);
      this.cdr.markForCheck();
    });
  }

  private actualizarMarcador(pos: { lat: number; lng: number }): void {
    const w = window as any;
    if (!this.map || !w.google || !w.google.maps) return;

    if (this.marker) (this.marker as any).setMap(null);
    this.marker = new w.google.maps.Marker({
      position: pos,
      map: this.map,
      icon: {
        url: this.PIN_URL,
        scaledSize: new w.google.maps.Size(70, 70),
        anchor: new w.google.maps.Point(35, 70),
      },
    });
    (this.map as any).panTo(pos);
  }

  private aplicarBusqueda(valor: string): void {
    this.busquedaTexto = valor.trim();
    this.gridRentRol?.instance?.pageIndex(0);
    this.gridRentRol?.instance?.refresh();
  }

  private redondear(valor: number): number {
    return Math.round(valor * 100) / 100;
  }

  /**
   * KPIs sobre todo el periodo (o todo lo filtrado), no solo la página visible del grid.
   * Solo cuentan los registros pagados: las rentas pendientes no suman a los totalizadores.
   */
  private filasParaKpi(): RentRolRow[] {
    const base = this.registrosParaKpi.length > 0 ? this.registrosParaKpi : this.registrosVisibles;
    return base.filter((r) => r.pagada && !r.esPendiente);
  }

  /** Registros pagados del periodo (o de la búsqueda). */
  get conteoPagadas(): number {
    return this.filasParaKpi().length;
  }

  /** Rentas registradas en Pagos del mes que aún no se pagan. */
  get conteoPendientes(): number {
    const base = this.registrosParaKpi.length > 0 ? this.registrosParaKpi : this.registrosVisibles;
    return base.filter((r) => r.esPendiente).length;
  }

  get porcentajeCobrado(): number {
    const total = this.conteoPagadas + this.conteoPendientes;
    return total ? Math.round((this.conteoPagadas / total) * 100) : 0;
  }

  get mesFiltroLabel(): string {
    const m = this.mesFiltro.match(/^(\d{4})-(\d{2})$/);
    if (!m) return '';
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    return `${meses[Number(m[2]) - 1] ?? ''} ${m[1]}`;
  }

  private fechaMesPorDefecto(): Date {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }

  /**
   * Traduce la fecha del DateBox al rango que espera el servicio:
   * primer y último día del mes → fechaInicio / fechaFin.
   */
  private sincronizarFechasDesdeMesFecha(): void {
    const d = this.mesFechaFiltro;
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
      this.mesFiltro = '';
      this.fechaInicioFiltro = '';
      this.fechaFinFiltro = '';
      return;
    }
    const anio = d.getFullYear();
    const mesIdx = d.getMonth();
    const inicio = new Date(anio, mesIdx, 1);
    const fin = new Date(anio, mesIdx + 1, 0);
    this.mesFiltro = `${anio}-${String(mesIdx + 1).padStart(2, '0')}`;
    this.fechaInicioFiltro = this.toIsoFecha(inicio);
    this.fechaFinFiltro = this.toIsoFecha(fin);
  }

  private toIsoFecha(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private claveCacheRegistros(): string {
    return `${this.fechaInicioFiltro}|${this.fechaFinFiltro}|${this.idArrendatarioFiltro ?? ''}|${this.idContratoFiltro ?? ''}`;
  }

  /**
   * Todos los registros del mes: pagos del histórico + rentas registradas en
   * Pagos del mes que aún no se pagan (para que la tabla muestre ambos).
   */
  private async cargarTodosLosRegistros(): Promise<RentRolRow[]> {
    const clave = this.claveCacheRegistros();
    if (this.cacheRegistrosKey === clave) {
      return this.todosRegistrosCache;
    }

    this.cargandoBusqueda = true;
    try {
      const [historico, pendientes] = await Promise.all([
        this.cargarHistoricoDelMes(),
        this.cargarPendientesDelMes(),
      ]);
      // Pendientes primero: son los que requieren acción.
      const acumulado = [...pendientes, ...historico];
      this.todosRegistrosCache = acumulado;
      this.cacheRegistrosKey = clave;
      return acumulado;
    } finally {
      this.cargandoBusqueda = false;
    }
  }

  private async cargarHistoricoDelMes(): Promise<RentRolRow[]> {
    const acumulado: RentRolRow[] = [];
    let page = 1;
    let totalPaginas = 1;
    do {
      const resp = await lastValueFrom(
        this.historicoPagosRentaService.obtenerHistoricoPaginado({
          page,
          limit: this.LIMITE_CARGA_BUSQUEDA,
          fechaInicio: this.fechaInicioFiltro,
          fechaFin: this.fechaFinFiltro,
          idArrendatario: this.idArrendatarioFiltro,
          idContrato: this.idContratoFiltro,
        }),
      );

      const rowsRaw = extraerFilasRentRolApi(resp);
      const meta = extraerMetaPaginacionRentRol(resp, page, this.LIMITE_CARGA_BUSQUEDA);
      totalPaginas = meta.totalPaginas;

      const rows = rowsRaw
        .map((item) => mapHistoricoPagoRentaToRentRolRow(item))
        .filter((r): r is RentRolRow => r != null);

      acumulado.push(...rows);
      page += 1;
    } while (page <= totalPaginas);
    return acumulado;
  }

  /**
   * Rentas de `/renta-actual` del mes filtrado con `pagada = 0`.
   * Las del mes en curso ya pagadas siguen en renta-actual con `pagada = 1`, pero esas
   * también están en el histórico, por eso aquí solo se toman las no pagadas.
   */
  private async cargarPendientesDelMes(): Promise<RentRolRow[]> {
    const mes = this.mesFiltro;
    if (!mes) return [];
    try {
      const raw = await cargarTodasRentasActuales(
        (page, limit) => lastValueFrom(this.rentaActualService.obtenerRentasPaginadas(page, limit)),
        extraerFilasRentasActualApi,
      );
      const idArr = Number(this.idArrendatarioFiltro);
      const idCon = Number(this.idContratoFiltro);
      const abiertas = RentRolAperturaStore.leer();
      const filas: RentRolRow[] = [];
      for (const item of raw) {
        const vm = mapRentaActualAPendiente(item);
        if (!vm || vm.pagada || !cubreMes(vm, mes)) continue;
        if (idArr > 0 && vm.idArrendatario !== idArr) continue;
        if (idCon > 0 && vm.idContrato !== idCon) continue;
        const fila = mapRentaActualPendienteToRentRolRow(item, abiertas.has(vm.id));
        if (fila) filas.push(fila);
      }
      return filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    } catch (err) {
      // Si falla, la tabla sigue mostrando los pagos del histórico como siempre.
      console.error('Error al cargar rentas pendientes de Pagos del mes:', err);
      return [];
    }
  }

  private setupDataSource(): void {
    this.listaRentRol = new CustomStore({
      key: 'gridKey',
      load: async (loadOptions: { take?: number; skip?: number }) => {
        const take = Number(loadOptions?.take) || this.FILAS_GRID_POR_PAGINA;
        const skip = Number(loadOptions?.skip) || 0;
        const textoBusqueda = this.busquedaTexto.trim();

        this.cargando = true;
        try {
          const todos = await this.cargarTodosLosRegistros();
          const filtrados = textoBusqueda ? filtrarRegistrosRentRol(todos, textoBusqueda) : todos;
          const dataCompleta = flattenRentRolRowsToGridLines(filtrados);
          const pagina = Math.floor(skip / take) + 1;

          this.cargando = false;
          this.registrosParaKpi = filtrados;
          this.registrosVisibles = filtrados.slice(
            (pagina - 1) * this.REGISTROS_POR_PAGINA,
            pagina * this.REGISTROS_POR_PAGINA,
          );
          this.totalRegistrosFiltrados = textoBusqueda ? filtrados.length : 0;
          this.totalRegistros = todos.length;
          this.totalPaginasApi = Math.max(1, Math.ceil(filtrados.length / this.REGISTROS_POR_PAGINA));
          this.paginaActual = pagina;
          this.cdr.markForCheck();

          return {
            data: dataCompleta.slice(skip, skip + take),
            totalCount: dataCompleta.length,
          };
        } catch (err) {
          this.cargando = false;
          console.error('Error al cargar rent-rol:', err);
          this.registrosVisibles = [];
          this.registrosParaKpi = [];
          this.totalRegistros = 0;
          this.totalRegistrosFiltrados = 0;
          this.totalPaginasApi = 1;
          return { data: [], totalCount: 0 };
        }
      },
    });
  }

  // ── Registro y acciones de renta: mismo modal y flujos de Pagos del mes ──
  abrirRegistroPago(): void {
    this.rentasMes?.abrirModalAlta();
  }

  /** Fila de Rent Rol → fila de Pagos del mes (misma respuesta de /renta-actual). */
  private filaRentaActual(line: RentRolGridLine): RentaActualGridRow | null {
    const detalle = line.registro.detalleRentaActual;
    return detalle ? mapRentaActualApiToGridRow(detalle) : null;
  }

  editarRenta(line: RentRolGridLine): void {
    const fila = this.filaRentaActual(line);
    if (fila) this.rentasMes?.abrirModalEdicion(fila);
  }

  marcarRentaPagada(line: RentRolGridLine): void {
    const fila = this.filaRentaActual(line);
    if (fila) void this.rentasMes?.marcarRentaPagada(fila);
  }

  /** Tras registrar / editar / pagar / duplicar: vuelve a consultar conservando la página. */
  onPagoRentaCambio(): void {
    this.cacheRegistrosKey = '';
    this.todosRegistrosCache = [];
    this.registrosParaKpi = [];
    this.gridRentRol?.instance?.refresh();
  }

  // ── Periodo del grid (apertura / cierre de mes) ─────────────────

  /** Pendientes azules: generadas y aún editables. */
  get conteoEditables(): number {
    return this.filasPendientesBase().filter((r) => !r.abierta).length;
  }

  /** Pendientes amarillas: mes abierto, solo se pueden marcar como pagadas. */
  get conteoPorPagar(): number {
    return this.filasPendientesBase().filter((r) => r.abierta).length;
  }

  private filasPendientesBase(): RentRolRow[] {
    const base = this.registrosParaKpi.length > 0 ? this.registrosParaKpi : this.registrosVisibles;
    return base.filter((r) => r.esPendiente);
  }

  abriendoMes = false;

  /** Hay rentas azules (pendientes y editables) en el mes que se pueden abrir. */
  get puedeAbrirMes(): boolean {
    return !this.cargando && !this.cargandoBusqueda && !this.abriendoMes && !this.cerrandoMes &&
      !this.modoBusquedaActivo && this.conteoEditables > 0;
  }

  get motivoAperturaBloqueada(): string {
    if (this.modoBusquedaActivo) return 'Limpia la búsqueda para abrir el mes.';
    if (this.conteoEditables === 0) return 'No hay rentas editables (azules) en el mes seleccionado.';
    return 'Apertura de Mes';
  }

  /**
   * Apertura de mes: las rentas AZULES (pendientes y editables) del mes filtrado pasan a
   * AMARILLO. Desde ese momento ya no se pueden editar; solo se pueden marcar como pagadas.
   * Las que se registren después quedan en azul hasta una nueva apertura.
   */
  async aperturaDeMes(): Promise<void> {
    if (this.abriendoMes) return;
    const mes = this.mesFiltro;
    if (!mes) {
      void this.alertaValidacion('Selecciona el mes a abrir.');
      return;
    }

    // Se toma el mes completo, no solo la página visible.
    let registros: RentRolRow[];
    try {
      registros = await this.cargarTodosLosRegistros();
    } catch {
      void this.alertaValidacion('No se pudieron consultar las rentas del mes. Intenta de nuevo.');
      return;
    }
    const azules = registros.filter((r) => r.esPendiente && !r.abierta && r.idRentaActual != null);
    if (!azules.length) {
      void Swal.fire({
        background: '#141a21', color: '#ffffff', icon: 'info',
        title: 'Nada que abrir',
        text: `No hay rentas editables en ${this.etiquetaMesClave(mes)}.`,
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const confirmado = await this.confirmarAccionCritica({
      titulo: `Apertura de ${this.etiquetaMesClave(mes)}`,
      color: '#f5c542',
      pasos: [
        `<strong>${azules.length}</strong> ${azules.length === 1 ? 'renta pasará' : 'rentas pasarán'} de ` +
          '<strong>Editable</strong> (azul) a <strong>Por pagar</strong> (amarillo).',
        'Ya <strong>no se podrán editar</strong>: solo tendrán el botón <strong>Marcar como pagada</strong>.',
        'Las rentas que se registren después quedarán en azul hasta una nueva apertura.',
      ],
      irreversible: 'Esta acción no se puede deshacer: las rentas abiertas ya no vuelven a ser editables.',
      listaTitulo: 'Rentas que se abrirán',
      lista: azules.map((r) => r.nombre),
      casilla: 'Entiendo que estas rentas ya no se podrán editar.',
      confirmar: 'Sí, abrir mes',
    });
    if (!confirmado) return;

    this.abriendoMes = true;
    this.cdr.markForCheck();
    const ok = RentRolAperturaStore.abrir(azules.map((r) => r.idRentaActual as number));
    this.abriendoMes = false;

    if (!ok) {
      void Swal.fire({
        background: '#141a21', color: '#ffffff', icon: 'error',
        title: 'No se pudo abrir el mes',
        text: 'El navegador no permitió guardar la apertura. Revisa que no esté en modo privado e intenta de nuevo.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    this.onPagoRentaCambio();
    void Swal.fire({
      background: '#141a21', color: '#ffffff', icon: 'success',
      title: '¡Mes abierto!',
      html:
        `${azules.length} ${azules.length === 1 ? 'renta quedó' : 'rentas quedaron'} en <strong>Por pagar</strong>. ` +
        'Ya solo se pueden marcar como pagadas.',
      confirmButtonText: 'Listo',
    });
  }

  /** ¿Se puede cerrar el mes filtrado? Hay registros y ninguno está pendiente de pago. */
  get puedeCerrarMes(): boolean {
    return !this.cargando && !this.cargandoBusqueda && !this.cerrandoMes &&
      !this.modoBusquedaActivo && this.conteoPagadas > 0 && this.conteoPendientes === 0;
  }

  get motivoCierreBloqueado(): string {
    if (this.modoBusquedaActivo) return 'Limpia la búsqueda para cerrar el mes.';
    if (this.conteoPendientes > 0) {
      return `Hay ${this.conteoPendientes} ${this.conteoPendientes === 1 ? 'renta pendiente' : 'rentas pendientes'} de pago en el mes.`;
    }
    if (this.conteoPagadas === 0) return 'No hay rentas pagadas en el mes seleccionado.';
    return 'Cierre de Mes';
  }

  cerrandoMes = false;

  /**
   * Cierre de mes: solo cuando TODAS las rentas del mes filtrado están pagadas.
   * Por cada renta pagada genera la del mes siguiente con el mismo servicio que
   * "Duplicar al mes siguiente" (POST /renta-actual/{id}/siguiente-mes). Si el pago ya solo
   * existe en el histórico o es por rango, se registra la misma copia con POST /renta-actual.
   * Quedan como pendientes de cobro en el mes siguiente.
   */
  async cierreDeMes(): Promise<void> {
    if (this.cerrandoMes) return;
    const mes = this.mesFiltro;
    const siguiente = this.claveMesSiguiente(mes);
    if (!mes || !siguiente) {
      void this.alertaValidacion('Selecciona el mes a cerrar.');
      return;
    }

    // Se valida contra el mes completo (no solo la página visible).
    let registros: RentRolRow[];
    try {
      registros = await this.cargarTodosLosRegistros();
    } catch {
      void this.alertaValidacion('No se pudieron consultar las rentas del mes. Intenta de nuevo.');
      return;
    }
    const pendientes = registros.filter((r) => r.esPendiente || !r.pagada);
    const pagadas = registros.filter((r) => r.pagada && !r.esPendiente);
    if (pendientes.length > 0) {
      void Swal.fire({
        background: '#141a21', color: '#ffffff', icon: 'warning',
        title: 'Aún no se puede cerrar el mes',
        html:
          `Hay <strong>${pendientes.length}</strong> ${pendientes.length === 1 ? 'renta pendiente' : 'rentas pendientes'} de pago en ` +
          `<strong>${this.etiquetaMesClave(mes)}</strong>.<br>Márcalas como pagadas para poder cerrar el mes.`,
        confirmButtonText: 'Entendido',
      });
      return;
    }
    if (!pagadas.length) {
      void this.alertaValidacion(`No hay rentas pagadas en ${this.etiquetaMesClave(mes)} para cerrar.`);
      return;
    }

    // Una renta por arrendatario + contrato (si hubo varios pagos del mismo contrato, se toma el último).
    const porContrato = new Map<string, Record<string, unknown>>();
    for (const r of pagadas) {
      const d = r.detalleApi;
      const idArr = Number(d?.['idArrendatario']);
      const idCon = Number(d?.['idContrato']);
      if (!d || !(idArr > 0) || !(idCon > 0)) continue;
      porContrato.set(`${idArr}|${idCon}`, d);
    }

    // Rentas de Pagos del mes: sirven para (1) no duplicar lo que ya existe en el mes siguiente
    // y (2) obtener el id de renta-actual de cada pago del mes, que es el que usa el servicio
    // "Duplicar al mes siguiente" (POST /renta-actual/{id}/siguiente-mes).
    let yaExisten = new Set<string>();
    const idRentaActualDelMes = new Map<string, number>();
    try {
      const raw = await cargarTodasRentasActuales(
        (page, limit) => lastValueFrom(this.rentaActualService.obtenerRentasPaginadas(page, limit)),
        extraerFilasRentasActualApi,
      );
      const vms = raw
        .map((item) => mapRentaActualAPendiente(item))
        .filter((vm): vm is NonNullable<typeof vm> => vm != null);
      yaExisten = new Set(vms.filter((vm) => cubreMes(vm, siguiente)).map((vm) => `${vm.idArrendatario}|${vm.idContrato}`));
      for (const vm of vms) {
        // El API no duplica pagos por rango (esPeriodo): esos se registran como copia.
        if (vm.mesClave === mes && vm.mesFinClave === vm.mesClave) idRentaActualDelMes.set(`${vm.idArrendatario}|${vm.idContrato}`, vm.id);
      }
    } catch {
      /* Si falla, el API igual rechaza los meses duplicados. */
    }

    const aGenerar: { clave: string; detalle: Record<string, unknown>; nombre: string; idRentaActual: number | null }[] = [];
    const omitidas: string[] = [];
    for (const [clave, d] of porContrato) {
      const nombre = this.nombreDesdeDetalle(d);
      if (yaExisten.has(clave)) {
        omitidas.push(nombre);
        continue;
      }
      aGenerar.push({ clave, detalle: d, nombre, idRentaActual: idRentaActualDelMes.get(clave) ?? null });
    }

    if (!aGenerar.length) {
      void Swal.fire({
        background: '#141a21', color: '#ffffff', icon: 'info',
        title: 'Ya está todo generado',
        html:
          `Todas las rentas ya tienen su renta de <strong>${this.etiquetaMesClave(siguiente)}</strong> creada; ` +
          'no hay nada nuevo que generar.' + this.htmlLista(omitidas),
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const mesSig = this.etiquetaMesClave(siguiente);
    const confirmado = await this.confirmarAccionCritica({
      titulo: `Cierre de ${this.etiquetaMesClave(mes)}`,
      color: '#22b07d',
      pasos: [
        `Se cerrará <strong>${this.etiquetaMesClave(mes)}</strong>: todas sus rentas ya están pagadas.`,
        `Se generarán <strong>${aGenerar.length}</strong> ${aGenerar.length === 1 ? 'renta' : 'rentas'} para ` +
          `<strong>${mesSig}</strong>, con los mismos montos y fórmula.`,
        `Quedarán en <strong>Editable</strong> (azul), pendientes de cobro en ${mesSig}.`,
        ...(omitidas.length
          ? [`<strong>${omitidas.length}</strong> ${omitidas.length === 1 ? 'ya tiene' : 'ya tienen'} su renta de ${mesSig} ` +
              'creada (de un cierre anterior); <strong>no se vuelven a crear</strong> para no duplicar el cobro.']
          : []),
      ],
      irreversible: `Las rentas de ${mesSig} quedarán creadas en el sistema; si alguna sobra habría que quitarla una por una.`,
      listaTitulo: `Ya tienen su renta de ${mesSig}`,
      lista: omitidas,
      casilla: `Entiendo que se crearán las rentas de ${mesSig}.`,
      confirmar: 'Sí, cerrar mes',
    });
    if (!confirmado) return;

    this.cerrandoMes = true;
    this.cdr.markForCheck();
    void Swal.fire({
      background: '#141a21', color: '#ffffff',
      title: 'Cerrando mes…',
      html: `Generando rentas de ${this.etiquetaMesClave(siguiente)}`,
      allowOutsideClick: false, allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    let creadas = 0;
    const errores: string[] = [];
    // En serie: el API valida traslapes por arrendatario + contrato.
    for (const item of aGenerar) {
      try {
        if (item.idRentaActual != null) {
          // Mismo servicio que "Duplicar al mes siguiente": copia idéntica con el mes siguiente.
          await lastValueFrom(this.rentaActualService.duplicarAlSiguienteMes(item.idRentaActual));
        } else {
          // El pago ya solo existe en el histórico (meses anteriores): se registra la misma copia.
          await lastValueFrom(this.rentaActualService.registrarRenta(this.payloadMesSiguiente(item.detalle, siguiente)));
        }
        creadas++;
      } catch (err) {
        errores.push(`${item.nombre}: ${this.mensajeErrorApi(err)}`);
      }
    }

    this.cerrandoMes = false;
    this.cdr.markForCheck();
    const resultado = await Swal.fire({
      background: '#141a21', color: '#ffffff',
      icon: errores.length ? (creadas ? 'warning' : 'error') : 'success',
      title: errores.length ? 'Cierre con observaciones' : '¡Mes cerrado!',
      html:
        `Se generaron <strong>${creadas}</strong> ${creadas === 1 ? 'renta' : 'rentas'} para ` +
        `<strong>${this.etiquetaMesClave(siguiente)}</strong>.` +
        (errores.length ? `<br><br><small>No se pudieron generar ${errores.length}:</small>` + this.htmlLista(errores) : ''),
      showCancelButton: creadas > 0,
      confirmButtonText: creadas > 0 ? `Ver ${this.etiquetaMesClave(siguiente)}` : 'Entendido',
      cancelButtonText: 'Quedarme aquí',
      reverseButtons: true,
    });

    if (creadas > 0 && resultado.isConfirmed) {
      const [anio, mesNum] = siguiente.split('-').map(Number);
      this.mesFechaFiltro = new Date(anio, mesNum - 1, 1);
      this.aplicarFiltros();
    } else {
      this.onPagoRentaCambio();
    }
  }

  /**
   * Confirmación para acciones de periodo (Apertura / Cierre): explica paso a paso qué va
   * a pasar, resalta lo que no se puede deshacer y exige marcar una casilla para continuar.
   */
  private async confirmarAccionCritica(o: {
    titulo: string;
    color: string;
    pasos: string[];
    irreversible: string;
    listaTitulo: string;
    lista: string[];
    casilla: string;
    confirmar: string;
  }): Promise<boolean> {
    const pasos = o.pasos
      .map(
        (p, i) =>
          '<li style="display:flex;gap:10px;align-items:flex-start;margin:0 0 8px">' +
          `<span style="flex-shrink:0;width:22px;height:22px;border-radius:7px;background:${o.color};color:#141a21;` +
          `font-weight:800;font-size:12px;display:inline-flex;align-items:center;justify-content:center">${i + 1}</span>` +
          `<span>${p}</span></li>`,
      )
      .join('');
    const html =
      '<div style="text-align:left;font-size:0.92rem;line-height:1.45">' +
      '<p style="margin:0 0 8px;font-weight:700;color:#a6b0c8;text-transform:uppercase;letter-spacing:.06em;font-size:.72rem">' +
      '¿Qué va a pasar?</p>' +
      `<ol style="list-style:none;margin:0;padding:0">${pasos}</ol>` +
      '<div style="display:flex;gap:10px;align-items:flex-start;margin-top:12px;padding:12px 14px;border-radius:12px;' +
      'background:rgba(255,107,111,.12);border:1px solid rgba(255,107,111,.55);color:#ffc2c4">' +
      '<span style="font-size:18px;line-height:1.1">⚠</span>' +
      `<span><strong style="color:#ff8a8d">Importante:</strong> ${o.irreversible}</span></div>` +
      (o.lista.length ? this.htmlListaPlegable(o.listaTitulo, o.lista) : '') +
      '</div>';

    const r = await Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      icon: 'warning',
      iconColor: o.color,
      title: o.titulo,
      html,
      width: 560,
      input: 'checkbox',
      inputValue: 0,
      inputPlaceholder: o.casilla,
      inputValidator: (marcada) => (marcada ? null : 'Marca la casilla para confirmar que entiendes lo que va a pasar.'),
      showCancelButton: true,
      confirmButtonText: o.confirmar,
      cancelButtonText: 'No, cancelar',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      reverseButtons: true,
      focusCancel: true,
      allowOutsideClick: false,
      customClass: { popup: 'rr-swal-critica' },
    });
    return r.isConfirmed;
  }

  /**
   * Lista compacta para alertas: muestra solo el conteo y los nombres quedan plegados
   * («Ver las N»). Al abrirse, caja de alto fijo con scroll y en dos columnas, para que
   * la alerta no crezca aunque sean 30 o más registros.
   */
  private htmlListaPlegable(titulo: string, items: string[]): string {
    const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const n = items.length;
    // Nombres cortos en dos columnas; textos largos (ej. motivos del cierre) en una sola.
    const columnas = items.some((i) => i.length > 32) ? 1 : 2;
    const textoLi = columnas === 1 ? 'white-space:normal' : 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    return (
      '<details style="margin-top:12px;border:1px solid rgba(255,255,255,.1);border-radius:12px;' +
      'background:rgba(255,255,255,.03)">' +
      '<summary style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;' +
      'cursor:pointer;list-style:none;font-size:.85rem;color:#a6b0c8">' +
      `<span><strong style="color:#e8ecf6">${esc(titulo)}</strong></span>` +
      '<span style="display:inline-flex;align-items:center;gap:8px">' +
      `<span style="padding:2px 10px;border-radius:999px;background:rgba(93,135,255,.18);color:#c7d2fe;font-weight:800">${n}</span>` +
      `<span style="color:#8fa8ff;font-weight:600">Ver ${n === 1 ? 'nombre' : 'los ' + n}</span></span>` +
      '</summary>' +
      `<ul style="display:grid;grid-template-columns:repeat(${columnas},minmax(0,1fr));`+'gap:4px 16px;max-height:150px;overflow:auto;' +
      'margin:0;padding:6px 14px 12px 30px;border-top:1px solid rgba(255,255,255,.08);font-size:.82rem;color:#d6dcef">' +
      items.map((i) => `<li style="${textoLi}" title="${esc(i)}">${esc(i)}</li>`).join('') +
      '</ul></details>'
    );
  }

  /** Copia idéntica del pago (montos y configuración de fórmula) para el mes siguiente. */
  private payloadMesSiguiente(d: Record<string, unknown>, mesClave: string): RentaActualPostPayload {
    const n = (v: unknown, def = 0) => {
      const x = Number(v);
      return Number.isFinite(x) ? Math.round(x * 100) / 100 : def;
    };
    const montoFinal = n(d['montoFinal']);
    const montoFinalMtto = n(d['montoFinalMantenimiento']);
    const idFormula = Number(d['idFormula']);
    return {
      idArrendatario: Math.floor(Number(d['idArrendatario'])),
      idContrato: Math.floor(Number(d['idContrato'])),
      // Mediodía UTC: el API trabaja en hora de CDMX (UTC-6); con T00:00Z el día 1 se recorre
      // al último día del mes anterior y el API lo toma como el mes equivocado.
      fechaInicio: `${mesClave}-01T12:00:00.000Z`,
      total: n(d['total'], montoFinal) || montoFinal,
      montoFinal,
      totalMantenimiento: n(d['totalMantenimiento'], montoFinalMtto),
      montoFinalMantenimiento: montoFinalMtto,
      usaFormula: Number(d['usaFormula']) === 1 ? 1 : 0,
      idFormula: Number.isFinite(idFormula) && idFormula > 0 ? Math.floor(idFormula) : null,
      factorVariable: n(d['factorVariable']),
      ocupoFormula: Number(d['ocupoFormula']) === 1 ? 1 : 0,
    };
  }

  private claveMesSiguiente(clave: string): string {
    const m = clave.match(/^(\d{4})-(\d{2})$/);
    if (!m) return '';
    const d = new Date(Number(m[1]), Number(m[2]), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private etiquetaMesClave(clave: string): string {
    const m = clave.match(/^(\d{4})-(\d{2})$/);
    if (!m) return clave;
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    return `${meses[Number(m[2]) - 1] ?? ''} ${m[1]}`;
  }

  private nombreDesdeDetalle(d: Record<string, unknown>): string {
    const arr = d['arrendatario'] as Record<string, unknown> | undefined;
    return String(arr?.['arrendatario'] ?? d['arrendatarioNombre'] ?? `Arrendatario #${d['idArrendatario']}`);
  }

  private mensajeErrorApi(err: unknown): string {
    const e = err as { error?: { message?: string | string[] } | string; message?: string };
    const msg = typeof e?.error === 'string' ? e.error : e?.error?.message ?? e?.message;
    return Array.isArray(msg) ? msg.join(' ') : String(msg ?? 'Error desconocido');
  }

  private htmlLista(items: string[]): string {
    if (!items.length) return '';
    const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    return (
      '<ul style="text-align:left;max-height:160px;overflow:auto;margin:8px 0 0;padding-left:18px;font-size:0.85rem">' +
      items.map((i) => `<li>${esc(i)}</li>`).join('') +
      '</ul>'
    );
  }

  // ── Export menu ─────────────────────────────────────────────────
  toggleExportMenu(): void {
    this.exportMenuAbierto = !this.exportMenuAbierto;
    this.cdr.markForCheck();
  }

  private cerrarExportSiClickFuera(target: EventTarget | null): void {
    if (!this.exportMenuAbierto) return;
    const el = target as HTMLElement | null;
    if (el?.closest?.('.rr-export-wrap')) return;
    this.exportMenuAbierto = false;
    this.cdr.markForCheck();
  }

  private async obtenerRegistrosParaExport(): Promise<RentRolRow[]> {
    if (this.modoBusquedaActivo) {
      return this.registrosParaKpi.length ? this.registrosParaKpi : this.registrosVisibles;
    }
    if (this.registrosParaKpi.length) return this.registrosParaKpi;
    try {
      return await this.cargarTodosLosRegistros();
    } catch {
      return this.registrosVisibles;
    }
  }

  async exportarExcel(): Promise<void> {
    this.exportMenuAbierto = false;
    const rows = await this.obtenerRegistrosParaExport();
    if (!rows.length) return;
    await exportarRentRolExcel({
      rows,
      fechaInicio: this.fechaInicioFiltro,
      fechaFin: this.fechaFinFiltro,
      titulo: 'Rent Rol',
    });
  }

  async exportarPdf(): Promise<void> {
    this.exportMenuAbierto = false;
    const rows = await this.obtenerRegistrosParaExport();
    if (!rows.length) return;
    await exportarRentRolPdf({
      rows,
      fechaInicio: this.fechaInicioFiltro,
      fechaFin: this.fechaFinFiltro,
      titulo: 'Rent Rol',
    });
  }
}
