import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { finalize, take } from 'rxjs/operators';
import Swal from 'sweetalert2';
import {
  contractDimAnim,
  contractModalAnim,
  rentaHintMsgAnim,
  rentaResumenRevealAnim,
  routeAnimation,
} from 'src/app/pipe/module-open.animation';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import { FormulasService } from 'src/app/services/moduleService/formulas.service';
import { RentaFormulaPreviewService } from '../renta-formula-preview.service';
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
  RentaActualPostPayload,
  RentaActualPutPayload,
  RentaActualService,
} from 'src/app/services/moduleService/renta-actual.service';
import {
  extraerFilasRentasActualApi,
  extraerRentaActualDetalleApi,
  mapRentaActualApiToGridRow,
  RentaActualGridRow,
} from './renta-actual-list.mapper';
import {
  extraerMontoRawDesdeDisplay,
  formatMonedaAlEscribir,
  formatMonedaDesdeNumero,
  parseMonedaNumerico,
  parseValorNumerico,
} from 'src/app/shared/valor-miles-format';

interface EvaluacionFormulaRentas {
  montoFinal: number;
  factorVariable: number;
}

interface SelectOpcion {
  id: number;
  label: string;
}

interface RentaModalResumenCampo {
  etiqueta: string;
  valor: string;
  dinero?: boolean;
  destacado?: boolean;
}

interface RentaModalResumenFilaMontos {
  total?: RentaModalResumenCampo;
  factor?: RentaModalResumenCampo;
  montoACobrar?: RentaModalResumenCampo;
}

interface RentaModalResumenVm {
  listo: boolean;
  mensajeVacio: string;
  pagoAFavorDe: string;
  arrendatario: string;
  campos: RentaModalResumenCampo[];
  filaMontos: RentaModalResumenFilaMontos | null;
}

@Component({
  selector: 'app-lista-rentas-actuales',
  templateUrl: './lista-rentas-actuales.component.html',
  styleUrl: './lista-rentas-actuales.component.scss',
  standalone: false,
  animations: [routeAnimation, contractDimAnim, contractModalAnim, rentaResumenRevealAnim, rentaHintMsgAnim],
})
export class ListaRentasActualesComponent implements OnInit {
  embebidoEnHub = false;
  listaRentas!: InstanceType<typeof CustomStore>;
  showFilterRow = true;
  showHeaderFilter = true;
  loading = false;
  pageSize = 20;
  paginaActual = 1;
  totalRegistros = 0;
  totalPaginas = 0;
  paginaActualData: RentaActualGridRow[] = [];
  filtroActivo = '';
  mensajeAgrupar = 'Arrastre un encabezado de columna aquí para agrupar por dicha columna';
  autoExpandAllGroups = true;

  mostrarModalRenta = false;
  rentaModalModo: 'alta' | 'edicion' = 'alta';
  rentaEditId: number | null = null;
  rentaGuardando = false;
  rentaModalCargando = false;
  evaluandoFormula = false;
  rentaForm!: FormGroup;

  arrendatariosOpciones: SelectOpcion[] = [];
  contratosOpciones: SelectOpcion[] = [];
  formulasOpciones: SelectOpcion[] = [];
  private arrendatariosCatalogo: Record<string, unknown>[] = [];
  catalogosModalCargando = false;
  resumenRentaModal: RentaModalResumenVm = this.resumenRentaModalVacio();
  rentaTotalDisplay = '';
  rentaMontoFinalDisplay = '';
  private rentaModalPermitirAutoScroll = false;
  private rentaModalScrollTimer: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('gridContainer', { static: false })
  dataGrid!: DxDataGridComponent;

  @ViewChild('rentaModalBody', { static: false })
  rentaModalBody?: ElementRef<HTMLElement>;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private rentaActualService: RentaActualService,
    private arrendatariosService: ArrendatariosService,
    private formulasService: FormulasService,
    private rentaFormulaPreview: RentaFormulaPreviewService,
  ) { }

  ngOnInit(): void {
    this.embebidoEnHub = this.leerEmbebidoEnHub();
    this.inicializarFormulario();
    this.setupDataSource();
  }

  // ─── Formulario ──────────────────────────────────────────────────────────────

  private inicializarFormulario(): void {
    this.rentaForm = this.fb.group({
      idArrendatario: [null, Validators.required],
      idContrato:     [null, Validators.required],
      total:          [null, Validators.required],
      idFormula:      [null, Validators.required],
      montoFinal:     [null, Validators.required],
      factorVariable: [null, Validators.required],
      ocupoFormula:   [0,    Validators.required],
    });
  
    // Al cambiar arrendatario → limpiar contrato, fórmula, montos y resumen
    this.rentaForm.get('idArrendatario')?.valueChanges.subscribe((id) => {
      this.sincronizarContratosPorArrendatario(id);
      this.rentaForm.get('idContrato')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('idFormula')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('total')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('montoFinal')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('factorVariable')?.setValue(null, { emitEvent: false });
      this.rentaTotalDisplay = '';
      this.rentaMontoFinalDisplay = '';
      this.actualizarResumenRentaModal();
      this.cdr.markForCheck();
    });
  
    // Al cambiar contrato → limpiar fórmula y montos, autocompletar total
    this.rentaForm.get('idContrato')?.valueChanges.subscribe((idContrato) => {
      this.rentaForm.get('idFormula')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('montoFinal')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('factorVariable')?.setValue(null, { emitEvent: false });
      this.rentaMontoFinalDisplay = '';
      this.autocompletarTotalDesdeContrato(idContrato);
      this.actualizarResumenRentaModal();
      this.cdr.markForCheck();
    });
  
    // Al cambiar fórmula → recalcular si ya hay arrendatario, contrato y total
    this.rentaForm.get('idFormula')?.valueChanges.subscribe(() => {
      this.ejecutarPreviewFormula();
    });
  
    this.rentaForm.valueChanges.subscribe(() => this.actualizarResumenRentaModal());
  }

  // ─── Autocompletar total desde contrato ──────────────────────────────────────

  private autocompletarTotalDesdeContrato(idContrato: unknown): void {
    const id    = Number(idContrato);
    const idArr = Number(this.rentaForm.getRawValue()['idArrendatario']);
    if (!Number.isFinite(id)    || id    <= 0) return;
    if (!Number.isFinite(idArr) || idArr <= 0) return;

    const contrato = this.buscarContratoEnCatalogo(Math.floor(idArr), Math.floor(id));
    if (!contrato) return;

    const rentaTotal = this.extraerTotalContrato(contrato);
    if (rentaTotal != null) {
      this.rentaForm.get('total')?.setValue(rentaTotal, { emitEvent: false });
      this.actualizarDisplayMonedaRenta();
      this.actualizarResumenRentaModal();
      this.cdr.markForCheck();
    }
  }

  private idsPreviewRentaListos(raw: Record<string, unknown>): {
    idFormula: number;
    idContrato: number;
    idArrendatario: number;
  } | null {
    const idFormula      = Number(raw['idFormula']);
    const idContrato     = Number(raw['idContrato']);
    const idArrendatario = Number(raw['idArrendatario']);
    if (
      !Number.isFinite(idFormula) || idFormula <= 0 ||
      !Number.isFinite(idContrato) || idContrato <= 0 ||
      !Number.isFinite(idArrendatario) || idArrendatario <= 0
    ) {
      return null;
    }
    return {
      idFormula: Math.floor(idFormula),
      idContrato: Math.floor(idContrato),
      idArrendatario: Math.floor(idArrendatario),
    };
  }

  private parseNumeroFormulario(value: unknown): number {
    return parseValorNumerico(value);
  }

  private actualizarDisplayMonedaRenta(): void {
    const total = Number(this.rentaForm?.get('total')?.value);
    const montoFinal = Number(this.rentaForm?.get('montoFinal')?.value);
    this.rentaTotalDisplay = Number.isFinite(total) ? formatMonedaDesdeNumero(total) : '';
    this.rentaMontoFinalDisplay = Number.isFinite(montoFinal) ? formatMonedaDesdeNumero(montoFinal) : '';
  }

  onRentaMonedaInput(ev: Event, campo: 'total' | 'montoFinal'): void {
    const input = ev.target as HTMLInputElement;
    const raw = extraerMontoRawDesdeDisplay(input.value);
    const n = parseMonedaNumerico(raw);
    this.rentaForm.get(campo)?.setValue(Number.isFinite(n) ? n : null);
    const visible = formatMonedaAlEscribir(input.value);
    input.value = visible;
    if (campo === 'total') {
      this.rentaTotalDisplay = visible;
    } else {
      this.rentaMontoFinalDisplay = visible;
    }
  }

  onRentaMonedaBlur(ev: Event, campo: 'total' | 'montoFinal'): void {
    const input = ev.target as HTMLInputElement;
    const ctrl = this.rentaForm.get(campo);
    const n = this.parseNumeroFormulario(ctrl?.value);
    if (Number.isFinite(n)) {
      ctrl?.setValue(n);
      const fmt = formatMonedaDesdeNumero(n);
      input.value = fmt;
      if (campo === 'total') {
        this.rentaTotalDisplay = fmt;
      } else {
        this.rentaMontoFinalDisplay = fmt;
      }
      return;
    }
    input.value = '';
    if (campo === 'total') {
      this.rentaTotalDisplay = '';
    } else {
      this.rentaMontoFinalDisplay = '';
    }
  }

  /** Renta total del contrato (con IVA); subtotal solo como respaldo. */
  private extraerTotalContrato(contrato: Record<string, unknown>): number | null {
    const candidatos = [
      contrato['rentaTotal'],
      contrato['renta_total'],
      contrato['subTotalRenta'],
      contrato['subtotalRenta'],
    ];
    for (const raw of candidatos) {
      const n = parseValorNumerico(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }

  private normalizarRespuestaFormula(res: unknown): {
    resultado?: number;
    tipoResultado?: string;
  } {
    const body =
      res != null && typeof res === 'object' && 'data' in (res as object)
        ? ((res as { data?: unknown }).data ?? res)
        : res;
    if (body == null || typeof body !== 'object') return {};
    const o = body as Record<string, unknown>;
    return {
      resultado: Number(o['resultado']),
      tipoResultado: String(o['tipoResultado'] ?? o['TipoResultado'] ?? 'MONTO'),
    };
  }

  /**
   * MONTO: `resultado` del API ya es el monto final (ej. 78115.71).
   * PORCENTAJE: `resultado` es el factor; monto final = factor × total.
   */
  private aplicarEvaluacionFormula(
    res: { resultado?: number; tipoResultado?: string },
    total: number,
  ): EvaluacionFormulaRentas | null {
    const resultado = Number(res?.resultado);
    if (!Number.isFinite(resultado)) return null;
  
    const tipo = String(res?.tipoResultado ?? 'PORCENTAJE').toUpperCase();
  
    if (tipo === 'MONTO') {
      const montoFinal     = Number(resultado.toFixed(2));
      const factorVariable = Number.isFinite(total) && total > 0
        ? parseFloat((montoFinal / total).toFixed(4))
        : 1;
      return { montoFinal, factorVariable };
    }
  
    // PORCENTAJE: resultado es el factor
    const montoFinal = Number.isFinite(total) && total > 0
      ? Number((resultado * total).toFixed(2))
      : resultado;
    return { montoFinal, factorVariable: parseFloat(resultado.toFixed(4)) };
  }

  // ─── Preview de fórmula ──────────────────────────────────────────────────────

  private ejecutarPreviewFormula(): void {
    const raw = this.rentaForm.getRawValue() as Record<string, unknown>;
    const ids = this.idsPreviewRentaListos(raw);
    if (!ids) return;

    this.evaluandoFormula = true;
    this.cdr.markForCheck();

    this.rentaFormulaPreview.preview(ids)
      .pipe(
        take(1),
        finalize(() => {
          this.evaluandoFormula = false;
          this.scrollRentaModalSiCorresponde();
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res: any) => {
          const total = this.parseNumeroFormulario(this.rentaForm.getRawValue()['total']);
          const aplicado = this.aplicarEvaluacionFormula(
            this.normalizarRespuestaFormula(res),
            total,
          );
          if (!aplicado) return;

          this.rentaForm.get('montoFinal')?.setValue(aplicado.montoFinal, { emitEvent: false });
          this.rentaForm.get('factorVariable')?.setValue(aplicado.factorVariable, { emitEvent: false });
          this.rentaForm.get('ocupoFormula')?.setValue(1, { emitEvent: false });

          this.actualizarDisplayMonedaRenta();
          this.actualizarResumenRentaModal();
          this.scrollRentaModalSiCorresponde();
          this.cdr.markForCheck();
        },
      });
  }

  private cancelarScrollRentaModalProgramado(): void {
    if (this.rentaModalScrollTimer != null) {
      clearTimeout(this.rentaModalScrollTimer);
      this.rentaModalScrollTimer = null;
    }
  }

  private scrollRentaModalSiCorresponde(): void {
    if (
      !this.rentaModalPermitirAutoScroll ||
      this.rentaModalModo !== 'alta' ||
      !this.mostrarModalRenta ||
      !this.resumenRentaModal.listo
    ) {
      return;
    }
    this.cancelarScrollRentaModalProgramado();
    this.rentaModalScrollTimer = setTimeout(() => {
      this.rentaModalScrollTimer = null;
      if (!this.mostrarModalRenta || !this.resumenRentaModal.listo) return;
      requestAnimationFrame(() => {
        const el = this.rentaModalBody?.nativeElement;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    }, 500);
  }

  // ─── Resumen vacío ───────────────────────────────────────────────────────────

  private resumenRentaModalVacio(): RentaModalResumenVm {
    return {
      listo: false,
      mensajeVacio: 'Selecciona arrendatario y contrato para ver a quién corresponde este pago.',
      pagoAFavorDe: '',
      arrendatario: '',
      campos: [],
      filaMontos: null,
    };
  }

  trackByResumenCampo(_index: number, campo: RentaModalResumenCampo): string {
    return campo.etiqueta;
  }

  private actualizarResumenRentaModal(): void {
    const prevListo = this.resumenRentaModal.listo;
    this.resumenRentaModal = this.construirResumenRentaModal();
    if (
      this.rentaModalPermitirAutoScroll &&
      this.rentaModalModo === 'alta' &&
      this.mostrarModalRenta &&
      !prevListo &&
      this.resumenRentaModal.listo
    ) {
      this.scrollRentaModalSiCorresponde();
    }
    this.cdr.markForCheck();
  }

  // ─── Data source ─────────────────────────────────────────────────────────────

  setupDataSource(): void {
    this.loading = true;
    this.listaRentas = new CustomStore({
      key: 'id',
      load: async (loadOptions: { take?: number; skip?: number }) => {
        const take = Number(loadOptions?.take) || this.pageSize || 20;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;
        try {
          const resp = (await lastValueFrom(
            this.rentaActualService.obtenerRentasPaginadas(page, take),
          )) as Record<string, unknown>;
          this.loading = false;
          const rowsRaw = extraerFilasRentasActualApi(resp);
          const meta =
            resp?.['paginated'] != null && typeof resp['paginated'] === 'object'
              ? (resp['paginated'] as Record<string, unknown>)
              : {};
          const totalRegistros =
            toNum(meta['total']) ?? toNum(resp?.['total']) ?? rowsRaw.length;
          const paginaActual =
            toNum(meta['page']) ?? toNum(resp?.['page']) ?? page;
          const totalPaginas =
            toNum(meta['lastPage']) ??
            toNum(resp['pages']) ??
            Math.max(1, Math.ceil(totalRegistros / take));

          const dataTransformada = rowsRaw
            .map((item) => mapRentaActualApiToGridRow(item))
            .filter((r): r is RentaActualGridRow => r != null);

          this.totalRegistros  = totalRegistros;
          this.paginaActual    = paginaActual;
          this.totalPaginas    = totalPaginas;
          this.paginaActualData = dataTransformada;

          return { data: dataTransformada, totalCount: totalRegistros };
        } catch (err) {
          this.loading = false;
          console.error('Error al cargar rentas actuales:', err);
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

  onGridOptionChanged(e: any): void {
    if (e.fullName !== 'searchPanel.text') return;
    const grid  = this.dataGrid?.instance;
    const texto = (e.value ?? '').toString().trim().toLowerCase();
    if (!texto) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaRentas);
      return;
    }
    this.filtroActivo = texto;
    const dataFiltrada = (this.paginaActualData || []).filter((row) => {
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
    grid?.option('dataSource', dataFiltrada);
  }

  limpiarVista(): void {
    const inst = this.dataGrid?.instance;
    if (!inst) return;
    inst.clearFilter();
    inst.clearGrouping();
    inst.pageIndex(0);
    inst.option('searchPanel.text', '');
    this.filtroActivo = '';
    inst.option('dataSource', this.listaRentas);
    inst.refresh();
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

  // ─── Modal alta ──────────────────────────────────────────────────────────────

  abrirModalAlta(): void {
    this.rentaModalModo = 'alta';
    this.rentaEditId    = null;
    this.rentaForm.reset({
      idArrendatario: null,
      idContrato:     null,
      total:          null,
      idFormula:      null,
      montoFinal:     null,
      factorVariable: null,
      ocupoFormula:   0,
    });
    this.rentaForm.get('idArrendatario')?.enable();
    this.rentaForm.get('idContrato')?.enable();
    this.contratosOpciones    = [];
    this.resumenRentaModal    = this.resumenRentaModalVacio();
    this.rentaTotalDisplay    = '';
    this.rentaMontoFinalDisplay = '';
    this.rentaModalPermitirAutoScroll = true;
    this.mostrarModalRenta    = true;
    this.cargarCatalogosModal();
    this.cdr.markForCheck();
  }

  // ─── Modal edición ───────────────────────────────────────────────────────────

  abrirModalEdicion(row: RentaActualGridRow): void {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;
    this.rentaModalModo    = 'edicion';
    this.rentaEditId       = Math.floor(id);
    this.rentaModalPermitirAutoScroll = false;
    this.mostrarModalRenta = true;
    this.rentaModalCargando = true;
    this.rentaForm.reset();
    this.rentaForm.get('idArrendatario')?.disable();
    this.rentaForm.get('idContrato')?.disable();
    this.resumenRentaModal = this.resumenRentaModalVacio();
    this.rentaTotalDisplay = '';
    this.rentaMontoFinalDisplay = '';
    this.cargarCatalogosModal();
    this.cdr.markForCheck();

    this.rentaActualService.obtenerRentaPorId(this.rentaEditId)
      .pipe(
        take(1),
        finalize(() => {
          this.rentaModalCargando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (resp) => {
          const det = extraerRentaActualDetalleApi(resp);
          if (!det) return;
          const ocupoRaw = det['ocupoFormula'] ?? det['ocupo_formula'];
          const ocupo    = ocupoRaw === true || ocupoRaw === 1 || ocupoRaw === '1' ? 1 : 0;
          this.rentaForm.patchValue({
            idArrendatario: Number(det['idArrendatario']) || null,
            idContrato:     Number(det['idContrato'])     || null,
            total:          Number(det['total']),
            idFormula:      Number(det['idFormula'])      || null,
            montoFinal:     Number(det['montoFinal']      ?? det['monto_final']),
            factorVariable: Number(det['factorVariable']  ?? det['factor_variable']),
            ocupoFormula:   ocupo,
          });
          this.actualizarDisplayMonedaRenta();
          this.actualizarResumenRentaModal();
        },
        error: (err) => {
          console.error(err);
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'error',
            title: 'No se pudo cargar la renta',
            text: this.mensajeErrorHttp(err),
            confirmButtonText: 'Entendido',
          });
          this.cerrarModalRenta();
        },
      });
  }

  cerrarModalRenta(): void {
    this.cancelarScrollRentaModalProgramado();
    this.mostrarModalRenta = false;
    this.rentaEditId       = null;
    this.rentaModalPermitirAutoScroll = false;
    this.resumenRentaModal = this.resumenRentaModalVacio();
    this.rentaTotalDisplay = '';
    this.rentaMontoFinalDisplay = '';
    this.cdr.markForCheck();
  }

  // ─── Resumen modal ───────────────────────────────────────────────────────────

  private construirResumenRentaModal(): RentaModalResumenVm {
    const raw   = this.rentaForm?.getRawValue() ?? {};
    const idArr = Number(raw['idArrendatario']);
    const idCon = Number(raw['idContrato']);
    const idFor = Number(raw['idFormula']);
  
    if (!Number.isFinite(idArr) || idArr <= 0) {
      return { listo: false, mensajeVacio: 'Selecciona un arrendatario para comenzar.', pagoAFavorDe: '', arrendatario: '', campos: [], filaMontos: null };
    }
  
    if (!Number.isFinite(idCon) || idCon <= 0) {
      return { listo: false, mensajeVacio: 'Selecciona un contrato para continuar.', pagoAFavorDe: '', arrendatario: '', campos: [], filaMontos: null };
    }
  
    if (!Number.isFinite(idFor) || idFor <= 0) {
      return { listo: false, mensajeVacio: 'Selecciona una fórmula para ver el resumen del pago.', pagoAFavorDe: '', arrendatario: '', campos: [], filaMontos: null };
    }
  
    const item = this.arrendatariosCatalogo.find(
      (r) => resolverIdArrendatarioApi(r) === Math.floor(idArr),
    );
    const arrendatarioNombre = item
      ? nombreArrendatarioDesdeApi(item)
      : this.etiquetaOpcion(this.arrendatariosOpciones, idArr);
  
    const contrato     = this.buscarContratoEnCatalogo(Math.floor(idArr), Math.floor(idCon));
    const pagoAFavorDe = item
      ? this.nombreArrendadorPago(item, contrato)
      : 'Arrendador no disponible';
  
    const campos: RentaModalResumenCampo[] = [
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
    const inmueble  = inm ? String(inm['inmueble'] ?? '').trim() : '';
    const direccion = inm ? String(inm['direccionFiscal'] ?? '').trim() : '';
    if (inmueble) {
      campos.push({
        etiqueta: 'Inmueble',
        valor: direccion ? `${inmueble} · ${direccion}` : inmueble,
      });
    }
  
    const fi = formatearFecha(String(contrato?.['fechaInicioContrato'] ?? contrato?.['fechaInicio'] ?? ''));
    const ff = formatearFecha(String(contrato?.['fechaTerminoContrato'] ?? contrato?.['fechaFin']   ?? ''));
    if (fi && ff && fi !== '—' && ff !== '—') {
      campos.push({ etiqueta: 'Vigencia', valor: `${fi} – ${ff}` });
    }
  
    const moneda = String(contrato?.['moneda'] ?? 'MXN').trim() || 'MXN';
    this.agregarMontosContratoAlResumen(campos, contrato, moneda);
  
    const formula = this.etiquetaOpcion(this.formulasOpciones, idFor);
    if (formula) campos.push({ etiqueta: 'Fórmula', valor: formula });
  
    const total          = String(raw['total']          ?? '').trim();
    const montoFinal     = String(raw['montoFinal']     ?? '').trim();
    const factorVariable = String(raw['factorVariable'] ?? '').trim();

    const filaMontos: RentaModalResumenFilaMontos = {};
    if (total) {
      filaMontos.total = {
        etiqueta: 'Total a registrar',
        valor: this.esNumeroCaptura(total) ? formatearMoneda(total) : total,
        dinero: true,
      };
    }
    if (factorVariable) {
      filaMontos.factor = { etiqueta: 'Factor INPC', valor: factorVariable };
    }
    if (montoFinal) {
      filaMontos.montoACobrar = {
        etiqueta: 'Monto A Cobrar',
        valor: this.esNumeroCaptura(montoFinal) ? formatearMoneda(montoFinal) : montoFinal,
        dinero: true,
        destacado: true,
      };
    }
  
    const ocupo = Number(raw['ocupoFormula']) === 1 ? 'Sí' : 'No';
    campos.push({ etiqueta: 'Usó fórmula', valor: ocupo });
  
    return {
      listo: true,
      mensajeVacio: '',
      pagoAFavorDe,
      arrendatario: arrendatarioNombre || '—',
      campos,
      filaMontos: Object.keys(filaMontos).length ? filaMontos : null,
    };
  }

  private agregarMontosContratoAlResumen(
    campos: RentaModalResumenCampo[],
    contrato: Record<string, unknown> | null,
    moneda: string,
  ): void {
    if (!contrato) return;
    const totalContrato = this.extraerTotalContrato(contrato);
    const rentaContrato = totalContrato != null ? formatearMoneda(totalContrato) : '—';
    if (rentaContrato && rentaContrato !== '—') {
      campos.push({
        etiqueta: 'Renta del contrato',
        valor: `${rentaContrato} ${moneda}`,
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
      if (Number.isFinite(idInm) && idInm > 0) return `Arrendador #${Math.trunc(idInm)}`;
    }
    const id = Number(item['idArrendador']);
    if (Number.isFinite(id) && id > 0) return `Arrendador #${Math.trunc(id)}`;
    return 'Arrendador no indicado en el catálogo';
  }

  private buscarContratoEnCatalogo(
    idArrendatario: number,
    idContrato: number,
  ): Record<string, unknown> | null {
    const item     = this.arrendatariosCatalogo.find(
      (r) => resolverIdArrendatarioApi(r) === idArrendatario,
    );
    const contratos = Array.isArray(item?.['contratos']) ? item['contratos'] : [];
    for (const raw of contratos) {
      if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const c  = raw as Record<string, unknown>;
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
    return Number.isFinite(parseValorNumerico(v));
  }

  textoPlaceholderContrato(): string {
    const idArr = Number(this.rentaForm?.get('idArrendatario')?.value);
    if (!Number.isFinite(idArr) || idArr <= 0) return 'Seleccione arrendatario primero';
    return this.contratosOpciones.length ? 'Seleccione contrato' : 'Sin contratos';
  }

  // ─── Catálogos ───────────────────────────────────────────────────────────────

  private cargarCatalogosModal(): void {
    this.catalogosModalCargando = true;
    void Promise.allSettled([
      lastValueFrom(this.arrendatariosService.obtenerArrendatariosPaginated(1, 300)),
      lastValueFrom(this.formulasService.obtenerFormulasData(1, 300)),
    ])
      .then((results) => {
        const [arrResult, formResult] = results;
        if (arrResult.status === 'fulfilled') {
          this.arrendatariosCatalogo  = extraerFilasPaginadasApi(arrResult.value);
          this.arrendatariosOpciones  = this.mapArrendatariosOpciones(this.arrendatariosCatalogo);
          this.sincronizarContratosPorArrendatario(this.rentaForm.get('idArrendatario')?.value);
        } else {
          console.error('Error arrendatarios modal renta:', arrResult.reason);
          this.arrendatariosCatalogo = [];
          this.arrendatariosOpciones = [];
          this.contratosOpciones     = [];
        }
        if (formResult.status === 'fulfilled') {
          this.formulasOpciones = this.mapFormulasOpciones(formResult.value);
        } else {
          console.error('Error fórmulas modal renta:', formResult.reason);
          this.formulasOpciones = [];
        }
      })
      .finally(() => {
        this.catalogosModalCargando = false;
        this.actualizarResumenRentaModal();
      });
  }

  private sincronizarContratosPorArrendatario(idArrendatario: unknown): void {
    const id          = Number(idArrendatario);
    const ctrlContrato = this.rentaForm.get('idContrato');
    if (!Number.isFinite(id) || id <= 0) {
      this.contratosOpciones = [];
      ctrlContrato?.setValue(null, { emitEvent: false });
      return;
    }
    const idBuscado = Math.floor(id);
    const item      = this.arrendatariosCatalogo.find(
      (r) => resolverIdArrendatarioApi(r) === idBuscado,
    );
    const contratos = Array.isArray(item?.['contratos']) ? (item['contratos'] as unknown[]) : [];
    this.contratosOpciones = contratos
      .map((raw) => {
        if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
        const c       = raw as Record<string, unknown>;
        const estatus = c['estatus'];
        if (estatus != null && Number(estatus) !== 1) return null;
        const idContrato = Number(c['id'] ?? c['idContrato']);
        if (!Number.isFinite(idContrato) || idContrato <= 0) return null;
        return { id: Math.floor(idContrato), label: etiquetaContratoArrendatarioApi(c) };
      })
      .filter((x): x is SelectOpcion => x != null);

    const actual      = Number(ctrlContrato?.value);
    const sigueValido = this.contratosOpciones.some((o) => o.id === actual);
    if (!sigueValido) ctrlContrato?.setValue(null, { emitEvent: false });
    this.actualizarResumenRentaModal();
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
        return { id: Math.floor(id), label: nombre || `Fórmula #${id}` };
      })
      .filter((x): x is SelectOpcion => x != null);
  }

  // ─── Guardar ─────────────────────────────────────────────────────────────────

  guardarRentaDesdeModal(): void {
    if (!this.rentaForm || this.rentaForm.invalid) {
      void Swal.fire({
        background: '#141a21', color: '#ffffff',
        icon: 'warning', title: 'Faltan datos',
        text: 'Completa los campos obligatorios del formulario.',
        confirmButtonText: 'Entendido',
      });
      return;
    }
  
    const raw            = this.rentaForm.getRawValue();
    const total          = this.parseNumeroFormulario(raw.total);
    const idFormula      = Number(raw.idFormula);
    const idContrato     = Number(raw.idContrato);
    const idArrendatario = Number(raw.idArrendatario);
    const ocupoFormula   = Number(raw.ocupoFormula) === 1 ? 1 : 0;
  
    if (!Number.isFinite(total) || !Number.isFinite(idFormula)) {
      void Swal.fire({
        background: '#141a21', color: '#ffffff',
        icon: 'warning', title: 'Valores inválidos',
        text: 'Revisa el total y la fórmula seleccionada.',
        confirmButtonText: 'Entendido',
      });
      return;
    }
  
    this.rentaGuardando = true;
    this.cdr.markForCheck();
  
    const evaluarBody: { idFormula: number; idContrato?: number; idArrendatario?: number } = {
      idFormula: Math.floor(idFormula),
    };
    if (Number.isFinite(idContrato) && idContrato > 0) {
      evaluarBody['idContrato'] = Math.floor(idContrato);
    }
    if (Number.isFinite(idArrendatario) && idArrendatario > 0) {
      evaluarBody['idArrendatario'] = Math.floor(idArrendatario);
    }
  
    // Paso 1: evaluar con auditoría (guarda en FormulaEvaluaciones)
    this.formulasService.evaluar(evaluarBody)
      .pipe(take(1))
      .subscribe({
        next: (resEvaluar: any) => {
          const aplicado = this.aplicarEvaluacionFormula(
            this.normalizarRespuestaFormula(resEvaluar),
            total,
          );

          if (!aplicado) {
            this.rentaGuardando = false;
            this.cdr.markForCheck();
            void Swal.fire({
              background: '#141a21', color: '#ffffff',
              icon: 'error', title: 'Error en la fórmula',
              text: 'La fórmula no devolvió un resultado válido.',
              confirmButtonText: 'Entendido',
            });
            return;
          }

          const { montoFinal, factorVariable } = aplicado;
  
          const putBody: RentaActualPutPayload = {
            total,
            idFormula:      Math.floor(idFormula),
            montoFinal,
            factorVariable,
            ocupoFormula,
          };
  
          // Paso 2: registrar o actualizar la renta
          if (this.rentaModalModo === 'edicion' && this.rentaEditId != null) {
            this.rentaActualService.actualizarRenta(this.rentaEditId, putBody)
              .pipe(take(1), finalize(() => { this.rentaGuardando = false; this.cdr.markForCheck(); }))
              .subscribe({
                next: () => this.onRentaGuardadaOk('La renta se actualizó correctamente.'),
                error: (err) => this.onRentaGuardadaError(err),
              });
            return;
          }
  
          if (!Number.isFinite(idArrendatario) || idArrendatario <= 0 ||
              !Number.isFinite(idContrato)     || idContrato     <= 0) {
            this.rentaGuardando = false;
            this.cdr.markForCheck();
            void Swal.fire({
              background: '#141a21', color: '#ffffff',
              icon: 'warning', title: 'Arrendatario y contrato',
              text: 'Selecciona arrendatario y contrato para registrar la renta.',
              confirmButtonText: 'Entendido',
            });
            return;
          }
  
          const postBody: RentaActualPostPayload = {
            idArrendatario: Math.floor(idArrendatario),
            idContrato:     Math.floor(idContrato),
            ...putBody,
          };
  
          this.rentaActualService.registrarRenta(postBody)
            .pipe(take(1), finalize(() => { this.rentaGuardando = false; this.cdr.markForCheck(); }))
            .subscribe({
              next: () => this.onRentaGuardadaOk('La renta del mes se registró correctamente.'),
              error: (err) => this.onRentaGuardadaError(err),
            });
        },
        error: (err) => {
          this.rentaGuardando = false;
          this.cdr.markForCheck();
          void Swal.fire({
            background: '#141a21', color: '#ffffff',
            icon: 'error', title: 'Error al evaluar la fórmula',
            text: this.mensajeErrorHttp(err),
            confirmButtonText: 'Entendido',
          });
        },
      });
  }

  private onRentaGuardadaOk(texto: string): void {
    this.cerrarModalRenta();
    this.dataGrid?.instance?.refresh();
    void Swal.fire({
      background: '#141a21', color: '#ffffff',
      icon: 'success', title: '¡Operación Exitosa!',
      text: texto, confirmButtonText: 'Listo',
    });
  }

  private onRentaGuardadaError(err: unknown): void {
    void Swal.fire({
      background: '#141a21', color: '#ffffff',
      icon: 'error', title: 'No se pudo guardar',
      text: this.mensajeErrorHttp(err), confirmButtonText: 'Entendido',
    });
  }

  // ─── Marcar pagada ───────────────────────────────────────────────────────────

  async marcarRentaPagada(row: RentaActualGridRow): Promise<void> {
    if (row?.pagada) return;
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;

    const periodo = row.mesLabel && row.mesLabel !== '—' ? row.mesLabel : 'este periodo';
    const result  = await Swal.fire({
      background: '#141a21', color: '#ffffff',
      icon: 'question', title: '¡Marcar Renta Como Pagada!',
      html: `Se registrara como pagada la renta de <strong>${row.arrendatarioLabel}</strong> (${periodo}).`,
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText:  'Cancelar',
    });
    if (!result.isConfirmed) return;

    this.rentaActualService.marcarComoPagada(Math.floor(id))
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.dataGrid?.instance?.refresh();
          void Swal.fire({
            background: '#141a21', color: '#ffffff',
            icon: 'success', title: '¡Operación Exitosa!',
            text: 'La renta quedó marcada como pagada y se registró en el histórico.',
            confirmButtonText: 'Listo',
          });
        },
        error: (err) => {
          console.error('Error al marcar renta pagada:', err);
          void Swal.fire({
            background: '#141a21', color: '#ffffff',
            icon: 'error', title: 'No se pudo marcar como pagada',
            text: this.mensajeErrorHttp(err), confirmButtonText: 'Entendido',
          });
        },
      });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private leerEmbebidoEnHub(): boolean {
    let actual: ActivatedRoute | null = this.route;
    while (actual) {
      if (actual.snapshot.data['hubEmbebido']) return true;
      actual = actual.parent;
    }
    return false;
  }

  private mensajeErrorHttp(err: unknown): string {
    const e      = err as { error?: string | { message?: string; mensaje?: string }; message?: string };
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