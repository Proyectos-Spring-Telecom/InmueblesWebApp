import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { finalize, take } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { environment } from 'src/environments/environment';
import {
  contractDimAnim,
  contractModalAnim,
  rentaHintMsgAnim,
  rentaResumenRevealAnim,
  routeAnimation,
} from 'src/app/pipe/module-open.animation';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import { HistoricoPagosRentaService } from 'src/app/services/moduleService/historico-pagos-renta.service';
import { FormulasService } from 'src/app/services/moduleService/formulas.service';
import {
  evaluarFormulaLocalConFactores,
  factoresActivosDesdeListadoApi,
  extraerFilasFormulasListadoApi,
} from 'src/app/pages/factores/formula-eval-local';
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
  extraerRentaActualParaEdicion,
  mapRentaActualApiToGridRow,
  RentaActualGridRow,
} from './renta-actual-list.mapper';
import {
  contarMontoSimbolosAntesCursor,
  cursorMontoTrasFormato,
  extraerMontoRawDesdeDisplay,
  formatMonedaAlEscribir,
  formatMonedaDesdeNumero,
  parseMonedaNumerico,
  parseValorNumerico,
} from 'src/app/shared/valor-miles-format';
import { exportarDxDataGridExcel, gridTieneDatosParaExportar } from 'src/app/shared/grid-excel-export';

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
  factor?: RentaModalResumenCampo;
  montoACobrar?: RentaModalResumenCampo;
  montoFinalMantenimiento?: RentaModalResumenCampo;
  montoTotalCombinado?: RentaModalResumenCampo;
}

type CampoMonedaRentaModal =
  | 'total'
  | 'montoFinal'
  | 'totalMantenimiento'
  | 'montoFinalMantenimiento';

type RentaModalPasoCatalogo = 'arrendatario' | 'contrato' | 'formula';

/** Forma de calcular el pago: fórmula guardada, o INPC/%Anual directo de Banxico (sin Factor ni Fórmula). */
type RentaModoCalculo = 'formula' | 'inpc' | 'porcentaje';

/** Periodo del catálogo INPC de Banxico, para el modo de cálculo directo. */
interface PeriodoInpcRenta {
  anio: number;
  mes: number;
  inpc: number;
  porcentajeAnual: number;
  label: string;
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
  busquedaHub = '';
  filtroActivo = '';
  mensajeAgrupar = 'Arrastre un encabezado de columna aquí para agrupar por dicha columna';
  autoExpandAllGroups = true;

  mostrarModalRenta = false;
  rentaModalModo: 'alta' | 'edicion' = 'alta';
  rentaEditId: number | null = null;
  rentaGuardando = false;
  evaluandoFormula = false;
  rentaForm!: FormGroup;

  arrendatariosOpciones: SelectOpcion[] = [];
  contratosOpciones: SelectOpcion[] = [];
  formulasOpciones: SelectOpcion[] = [];
  private arrendatariosCatalogo: Record<string, unknown>[] = [];
  /** Filas crudas de fórmulas (expresión + tipoResultado) para evaluar en front. */
  private formulasCatalogoRaw: Record<string, unknown>[] = [];
  /** Factores activos para sustituir variables (incluye nombres con espacios). */
  private factoresCatalogoEval: { variable: string; valor: number }[] = [];
  catalogosModalCargando = false;
  resumenRentaModal: RentaModalResumenVm = this.resumenRentaModalVacio();
  rentaTotalDisplay = '';
  rentaMontoFinalDisplay = '';
  rentaTotalMantenimientoDisplay = '';
  rentaMontoFinalMantenimientoDisplay = '';
  rentaMostrarMantenimiento = false;
  /** Animación puntual al pasar al siguiente select (solo alta). */
  rentaModalCampoAnimando: RentaModalPasoCatalogo | null = null;
  private ultimaEvaluacionFormula: { resultado?: number; tipoResultado?: string } | null = null;
  private rentaModalAnimTimer: ReturnType<typeof setTimeout> | null = null;
  private rentaModalAvanceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly rentaModalCampoIds: Record<RentaModalPasoCatalogo, string> = {
    arrendatario: 'rentaArrendatario',
    contrato: 'rentaContrato',
    formula: 'rentaFormulaAlta',
  };
  private rentaModalPermitirAutoScroll = false;
  private rentaModalScrollTimer: ReturnType<typeof setTimeout> | null = null;
  private rentaRecalcTimer: ReturnType<typeof setTimeout> | null = null;
  private rentaModalSuprimirRecalc = false;
  /** Invalida respuestas de preview obsoletas al cambiar fórmula o catálogo. */
  private previewFormulaSeq = 0;

  // ── Forma de cálculo: Fórmula guardada / INPC directo / % Anual directo ──
  // Nunca son formControlName: no viajan a rentaForm.getRawValue() ni al body.
  rentaModoCalculo: RentaModoCalculo = 'formula';
  catalogoInpcRenta: PeriodoInpcRenta[] = [];
  cargandoInpcRenta = false;
  /** % Anual: un solo periodo. INPC: no se usa (van numerador/denominador). */
  periodoInpcSeleccionadoRenta: number | null = null;
  /** INPC directo: dividendo / divisor → factor. */
  periodoInpcNumeradorRenta: number | null = null;
  periodoInpcDenominadorRenta: number | null = null;
  /** Rango mes→mes del catálogo INPC (mismo DateBox que histórico de pagos). */
  mesDesdeInpcRenta: Date = new Date(new Date().getFullYear(), 0, 1);
  mesHastaInpcRenta: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  readonly mesCalendarOptionsInpcRenta = {
    zoomLevel: 'year' as const,
    maxZoomLevel: 'year' as const,
    minZoomLevel: 'century' as const,
  };

  private readonly rentaCamposRecalculoFormula = new Set<CampoMonedaRentaModal>([]);
  private readonly rentaCamposRecalculoFactor = new Set<CampoMonedaRentaModal>([
    'montoFinal',
    'montoFinalMantenimiento',
  ]);

  @ViewChild('gridContainer', { static: false })
  dataGrid!: DxDataGridComponent;

  @ViewChild('rentaModalBody', { static: false })
  rentaModalBody?: ElementRef<HTMLElement>;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private http: HttpClient,
    private rentaActualService: RentaActualService,
    private arrendatariosService: ArrendatariosService,
    private historicoPagosRentaService: HistoricoPagosRentaService,
    private formulasService: FormulasService,
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
      totalMantenimiento: [null],
      montoFinalMantenimiento: [null],
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
      this.rentaForm.get('totalMantenimiento')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('montoFinalMantenimiento')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('factorVariable')?.setValue(null, { emitEvent: false });
      this.rentaTotalDisplay = '';
      this.rentaMontoFinalDisplay = '';
      this.rentaTotalMantenimientoDisplay = '';
      this.rentaMontoFinalMantenimientoDisplay = '';
      this.rentaMostrarMantenimiento = false;
      this.limpiarEvaluacionFormulaCache();
      this.actualizarValidadoresMantenimientoModal();
      this.actualizarResumenRentaModal();
      this.cdr.markForCheck();

      const idArr = Number(id);
      if (
        this.rentaModalModo === 'alta' &&
        Number.isFinite(idArr) &&
        idArr > 0 &&
        this.contratosOpciones.length > 0
      ) {
        this.continuarTrasSeleccionRentaModal('contrato');
      }
    });
  
    // Al cambiar contrato → limpiar fórmula y cargar totales desde último pago histórico
    this.rentaForm.get('idContrato')?.valueChanges.subscribe((idContrato) => {
      this.previewFormulaSeq++;
      this.rentaForm.get('idFormula')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('montoFinal')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('montoFinalMantenimiento')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('factorVariable')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('total')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('totalMantenimiento')?.setValue(null, { emitEvent: false });
      this.rentaMontoFinalDisplay = '';
      this.rentaMontoFinalMantenimientoDisplay = '';
      this.rentaTotalDisplay = '';
      this.rentaTotalMantenimientoDisplay = '';
      this.rentaMostrarMantenimiento = false;
      this.rentaModoCalculo = 'formula';
      this.limpiarSeleccionPeriodosInpcRenta();
      this.limpiarEvaluacionFormulaCache();
      this.sincronizarValidadorIdFormulaRenta();
      this.autocompletarMontosDesdeUltimoPago(idContrato);
      this.actualizarResumenRentaModal();
      this.cdr.markForCheck();

      const idCon = Number(idContrato);
      if (
        this.rentaModalModo === 'alta' &&
        Number.isFinite(idCon) &&
        idCon > 0 &&
        this.formulasOpciones.length > 0
      ) {
        this.continuarTrasSeleccionRentaModal('formula');
      }
    });
  
    // Al cambiar fórmula → refrescar resumen y recalcular montos derivados
    this.rentaForm.get('idFormula')?.valueChanges.subscribe((idFormula) => {
      this.onCambioFormulaRentaModal(idFormula);
    });

    this.rentaForm.get('factorVariable')?.valueChanges.subscribe(() => {
      this.programarRecalculoRentaModal('factor');
    });

    this.rentaForm.valueChanges.subscribe(() => this.actualizarResumenRentaModal());
  }

  // ─── Forma de cálculo: Fórmula / INPC directo / % Anual directo ────────────

  /** Cambia el modo de cálculo del monto (solo UI: no afecta el body). */
  cambiarModoCalculoRenta(modo: RentaModoCalculo): void {
    if (this.rentaModoCalculo === modo) return;
    this.rentaModoCalculo = modo;

    // Al salir de Fórmula / INPC / % Anual se reinicia monto + info de abajo.
    this.reiniciarResultadosCalculoRentaModal();

    if (modo !== 'formula') {
      // No hay fórmula guardada de por medio: se manda idFormula null,
      // igual que si el usuario nunca hubiera elegido una.
      this.rentaForm.get('idFormula')?.setValue(null, { emitEvent: false });
    }

    this.sincronizarValidadorIdFormulaRenta();
    this.actualizarResumenRentaModal();
    this.cdr.markForCheck();
  }

  /**
   * Reinicia montos derivados, selects INPC/%, preview y resumen inferior.
   * No toca total / totalMantenimiento (vienen del contrato).
   */
  private reiniciarResultadosCalculoRentaModal(): void {
    this.cancelarRecalculoRentaProgramado();
    this.previewFormulaSeq++;
    this.evaluandoFormula = false;
    this.limpiarEvaluacionFormulaCache();
    this.limpiarSeleccionPeriodosInpcRenta();
    this.limpiarMontosDerivadosFormulaModal();
  }

  private limpiarSeleccionPeriodosInpcRenta(): void {
    this.periodoInpcSeleccionadoRenta = null;
    this.periodoInpcNumeradorRenta = null;
    this.periodoInpcDenominadorRenta = null;
  }

  /**
   * Opciones para dx-select-box. Deben ser arreglos estables (no getters):
   * si la referencia cambia en cada ciclo de CD, DevExtreme re-vincula el
   * data source y la selección nunca se aplica.
   */
  opcionesInpcDx: { idx: number; texto: string }[] = [];
  opcionesPorcentajeAnualDx: { idx: number; texto: string }[] = [];

  private reconstruirOpcionesInpcDx(): void {
    this.opcionesInpcDx = this.catalogoInpcRenta.map((p, idx) => ({
      idx,
      texto: `${this.mesCortoInpcRenta(p)} - ${p.inpc}`,
    }));
    this.opcionesPorcentajeAnualDx = this.catalogoInpcRenta.map((p, idx) => ({
      idx,
      texto: `${this.mesCortoInpcRenta(p)} - ${p.porcentajeAnual}%`,
    }));
  }

  /** "Junio 2026 — Banxico" → "Junio 2026". */
  private mesCortoInpcRenta(p: PeriodoInpcRenta): string {
    return (p.label || '').split('—')[0].trim();
  }

  /**
   * `idFormula` solo es obligatorio en modo Fórmula.
   * En INPC/% directo no va al flujo de evaluar; el body puede llevar null.
   */
  private sincronizarValidadorIdFormulaRenta(): void {
    const ctrl = this.rentaForm?.get('idFormula');
    if (!ctrl) return;
    if (this.rentaModoCalculo === 'formula') {
      ctrl.setValidators([Validators.required]);
    } else {
      ctrl.clearValidators();
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * INPC: factor = INPC numerador ÷ INPC denominador.
   * % Anual: factor = 1 + (% / 100).
   * Luego se usa el mismo recálculo local: montoFinal = factor × total.
   */
  aplicarValorInpcDirectoARenta(): void {
    let factor: number | null = null;

    if (this.rentaModoCalculo === 'inpc') {
      if (this.periodoInpcNumeradorRenta == null || this.periodoInpcDenominadorRenta == null) {
        return;
      }
      const num = this.catalogoInpcRenta[this.periodoInpcNumeradorRenta]?.inpc;
      const den = this.catalogoInpcRenta[this.periodoInpcDenominadorRenta]?.inpc;
      if (!Number.isFinite(num) || !Number.isFinite(den)) return;
      if (den === 0) {
        void Swal.fire({
          background: '#141a21',
          color: '#ffffff',
          icon: 'warning',
          title: 'División inválida',
          text: 'El INPC denominador no puede ser 0.',
          confirmButtonText: 'Entendido',
        });
        return;
      }
      factor = parseFloat((num / den).toFixed(6));
    } else {
      if (this.periodoInpcSeleccionadoRenta == null) return;
      const periodo = this.catalogoInpcRenta[this.periodoInpcSeleccionadoRenta];
      const pct = periodo?.porcentajeAnual;
      if (pct == null || !Number.isFinite(pct)) return;
      factor = parseFloat((1 + pct / 100).toFixed(6));
    }

    if (factor == null || !Number.isFinite(factor) || factor <= 0) return;

    this.conRecalcSuspendido(() => {
      this.rentaForm.get('factorVariable')?.setValue(factor, { emitEvent: false });
    });

    this.recalcularMontosDesdeFactor();
    // Directo Banxico: no pasó por fórmula guardada.
    this.conRecalcSuspendido(() => {
      this.rentaForm.get('ocupoFormula')?.setValue(0, { emitEvent: false });
    });
    this.actualizarResumenRentaModal();
    this.cdr.markForCheck();
  }

  /** Normaliza el DateBox a día 1 del mes (solo mes/año importan). */
  onMesRangoInpcRentaChange(): void {
    if (this.mesDesdeInpcRenta instanceof Date && !Number.isNaN(this.mesDesdeInpcRenta.getTime())) {
      this.mesDesdeInpcRenta = new Date(
        this.mesDesdeInpcRenta.getFullYear(),
        this.mesDesdeInpcRenta.getMonth(),
        1,
      );
    }
    if (this.mesHastaInpcRenta instanceof Date && !Number.isNaN(this.mesHastaInpcRenta.getTime())) {
      this.mesHastaInpcRenta = new Date(
        this.mesHastaInpcRenta.getFullYear(),
        this.mesHastaInpcRenta.getMonth(),
        1,
      );
    }
  }

  /** Reconsulta el catálogo INPC con el rango mes→mes (UI; no toca el body). */
  aplicarFiltrosInpcRenta(): void {
    this.onMesRangoInpcRentaChange();
    if (!this.validarRangoMesInpcRenta(true)) return;
    this.limpiarSeleccionPeriodosInpcRenta();
    void this.cargarCatalogoInpcRenta().then((rows) => {
      this.catalogoInpcRenta = rows;
      this.reconstruirOpcionesInpcDx();
      this.cdr.markForCheck();
    });
  }

  private fechaMesInpcRentaPorDefecto(inicioAnio: boolean): Date {
    const hoy = new Date();
    return inicioAnio
      ? new Date(hoy.getFullYear(), 0, 1)
      : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }

  private toIsoFechaInpcRenta(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Primer día del mes desde → último día del mes hasta. */
  private rangoIsoDesdeMesInpcRenta(): { inicio: string; fin: string } | null {
    const desde = this.mesDesdeInpcRenta;
    const hasta = this.mesHastaInpcRenta;
    if (!(desde instanceof Date) || Number.isNaN(desde.getTime())) return null;
    if (!(hasta instanceof Date) || Number.isNaN(hasta.getTime())) return null;
    const inicio = new Date(desde.getFullYear(), desde.getMonth(), 1);
    const fin = new Date(hasta.getFullYear(), hasta.getMonth() + 1, 0);
    return {
      inicio: this.toIsoFechaInpcRenta(inicio),
      fin: this.toIsoFechaInpcRenta(fin),
    };
  }

  private validarRangoMesInpcRenta(mostrarAlerta: boolean): boolean {
    const rango = this.rangoIsoDesdeMesInpcRenta();
    if (!rango) {
      if (mostrarAlerta) {
        void Swal.fire({
          background: '#141a21',
          color: '#ffffff',
          icon: 'warning',
          title: 'Rango incompleto',
          text: 'Selecciona mes desde y mes hasta.',
          confirmButtonText: 'Entendido',
        });
      }
      return false;
    }
    if (rango.inicio > rango.fin) {
      if (mostrarAlerta) {
        void Swal.fire({
          background: '#141a21',
          color: '#ffffff',
          icon: 'warning',
          title: 'Rango inválido',
          text: 'El mes desde no puede ser posterior al mes hasta.',
          confirmButtonText: 'Entendido',
        });
      }
      return false;
    }
    return true;
  }

  /** Mismo endpoint de solo lectura que ya usa "Agregar Factor" / "Agregar Fórmula". */
  private cargarCatalogoInpcRenta(): Promise<PeriodoInpcRenta[]> {
    if (!this.validarRangoMesInpcRenta(false)) {
      const defDesde = this.fechaMesInpcRentaPorDefecto(true);
      const defHasta = this.fechaMesInpcRentaPorDefecto(false);
      this.mesDesdeInpcRenta = defDesde;
      this.mesHastaInpcRenta = defHasta;
    }

    const rango = this.rangoIsoDesdeMesInpcRenta();
    if (!rango) {
      this.cargandoInpcRenta = false;
      return Promise.resolve([]);
    }

    this.cargandoInpcRenta = true;
    const url =
      `${environment.API_SECURITY}/inpc/listado?fechaInicio=${rango.inicio}&fechaFin=${rango.fin}`;

    return lastValueFrom(this.http.get<{ data?: unknown[] }>(url))
      .then((resp) => {
        const meses = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
        ];
        const rows = Array.isArray(resp?.data) ? resp.data : [];
        return rows
          .map((r) => r as Record<string, unknown>)
          .map((r): PeriodoInpcRenta | null => {
            const anio = Number(r['anio']);
            const mes  = Number(r['mes']);
            if (!Number.isFinite(anio) || !Number.isFinite(mes)) return null;
            const inpc = this.parseNumeroFormulario(r['inpc']);
            const pa   = this.parseNumeroFormulario(r['porcentajeAnual']);
            const nombreMes = meses[mes - 1] ?? `Mes ${mes}`;
            return {
              anio, mes,
              inpc: Number.isFinite(inpc) ? inpc : 0,
              porcentajeAnual: Number.isFinite(pa) ? pa : 0,
              label: `${nombreMes} ${anio} — Banxico`,
            };
          })
          .filter((x): x is PeriodoInpcRenta => x != null)
          .sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes));
      })
      .finally(() => {
        this.cargandoInpcRenta = false;
      });
  }

  // ─── Continuidad Arrendatario → Contrato → Fórmula ───────────────────────────

  private limpiarEfectoPasoRentaModal(): void {
    if (this.rentaModalAnimTimer != null) {
      clearTimeout(this.rentaModalAnimTimer);
      this.rentaModalAnimTimer = null;
    }
    if (this.rentaModalAvanceTimer != null) {
      clearTimeout(this.rentaModalAvanceTimer);
      this.rentaModalAvanceTimer = null;
    }
    this.rentaModalCampoAnimando = null;
  }

  /** Tras cerrar un select: animación breve en el destino y foco. */
  private continuarTrasSeleccionRentaModal(pasoDestino: RentaModalPasoCatalogo): void {
    if (this.rentaModalModo !== 'alta' || !this.mostrarModalRenta) return;

    if (this.rentaModalAvanceTimer != null) {
      clearTimeout(this.rentaModalAvanceTimer);
    }

    this.rentaModalAvanceTimer = setTimeout(() => {
      this.rentaModalAvanceTimer = null;
      this.dispararAnimacionCampoRentaModal(pasoDestino);
      this.enfocarCampoRentaModal(pasoDestino);
    }, 80);
  }

  private dispararAnimacionCampoRentaModal(paso: RentaModalPasoCatalogo): void {
    if (this.rentaModalAnimTimer != null) {
      clearTimeout(this.rentaModalAnimTimer);
    }
    this.rentaModalCampoAnimando = null;
    this.cdr.markForCheck();

    requestAnimationFrame(() => {
      this.rentaModalCampoAnimando = paso;
      this.cdr.markForCheck();
      this.rentaModalAnimTimer = setTimeout(() => {
        if (this.rentaModalCampoAnimando === paso) {
          this.rentaModalCampoAnimando = null;
          this.cdr.markForCheck();
        }
        this.rentaModalAnimTimer = null;
      }, 720);
    });
  }

  private enfocarCampoRentaModal(paso: RentaModalPasoCatalogo): void {
    if (this.catalogosModalCargando) return;
    const id = this.rentaModalCampoIds[paso];
    requestAnimationFrame(() => {
      const el = document.getElementById(id) as HTMLSelectElement | null;
      if (!el || el.disabled) return;
      try {
        el.focus({ preventScroll: false });
      } catch {
        el.focus();
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
  }

  // ─── Autocompletar montos desde último pago de renta ─────────────────────────

  private extraerDataUltimoPagoRenta(resp: unknown): Record<string, unknown> | null {
    if (resp == null || typeof resp !== 'object') return null;
    const raiz = resp as Record<string, unknown>;
    const data = raiz['data'];
    if (data != null && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    return null;
  }

  private esUltimoPagoRentaNoEncontrado(err: unknown): boolean {
    if (err == null || typeof err !== 'object') return false;
    const e = err as {
      status?: number;
      statusCode?: number;
      error?: string | { message?: string; statusCode?: number };
      message?: string;
    };
    const nested = e.error;
    const nestedStatus =
      nested != null && typeof nested === 'object'
        ? Number((nested as { statusCode?: number }).statusCode)
        : NaN;
    const status = Number(e.status ?? e.statusCode ?? nestedStatus);
    if (status === 404) return true;
    const msg = [
      e.message,
      typeof nested === 'string' ? nested : nested?.message,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return msg.includes('no se encontr') || msg.includes('not found');
  }

  private aplicarMontosRentaModal(total: number | null, totalMantenimiento: number | null): void {
    if (Number.isFinite(total) && (total as number) > 0) {
      this.rentaForm.get('total')?.setValue(total, { emitEvent: false });
    }

    const tieneMtto =
      totalMantenimiento != null &&
      Number.isFinite(totalMantenimiento) &&
      totalMantenimiento > 0;
    this.rentaMostrarMantenimiento = tieneMtto;

    if (tieneMtto) {
      this.rentaForm
        .get('totalMantenimiento')
        ?.setValue(totalMantenimiento, { emitEvent: false });
    } else {
      this.limpiarMontosMantenimientoModal();
    }

    this.actualizarValidadoresMantenimientoModal();
    this.actualizarDisplayMonedaRenta();
    this.actualizarResumenRentaModal();
    if (this.rentaForm.get('idFormula')?.value) {
      this.programarRecalculoRentaModal('formula');
    }
    this.cdr.markForCheck();
  }

  /** Respaldo: rentaTotal y mantenimientoTotal del contrato en `/arrendatarios/listado`. */
  private autocompletarMontosDesdeContratoCatalogo(
    idArrendatario: number,
    idContrato: number,
  ): void {
    const contrato = this.buscarContratoEnCatalogo(idArrendatario, idContrato);
    if (!contrato) {
      this.rentaMostrarMantenimiento = false;
      this.limpiarMontosMantenimientoModal();
      this.actualizarValidadoresMantenimientoModal();
      this.cdr.markForCheck();
      return;
    }

    this.aplicarMontosRentaModal(
      this.extraerTotalContrato(contrato),
      this.extraerMantenimientoTotalContrato(contrato),
    );
  }

  private autocompletarMontosDesdeUltimoPago(idContrato: unknown): void {
    const id = Number(idContrato);
    const idArr = Number(this.rentaForm.getRawValue()['idArrendatario']);
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(idArr) || idArr <= 0) return;

    const idArrendatario = Math.floor(idArr);
    const idContratoNum = Math.floor(id);

    this.historicoPagosRentaService
      .obtenerUltimoPagoRenta(idArrendatario, idContratoNum)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          const data = this.extraerDataUltimoPagoRenta(resp);
          if (!data) {
            this.autocompletarMontosDesdeContratoCatalogo(idArrendatario, idContratoNum);
            return;
          }

          const montoFinalUltimo = this.parseNumeroFormulario(
            data['montoFinal'] ?? data['monto_final'],
          );
          const montoFinalMttoUltimo = this.parseNumeroFormulario(
            data['montoFinalMantenimiento'] ?? data['monto_final_mantenimiento'],
          );

          this.aplicarMontosRentaModal(
            Number.isFinite(montoFinalUltimo) ? montoFinalUltimo : null,
            Number.isFinite(montoFinalMttoUltimo) ? montoFinalMttoUltimo : null,
          );
        },
        error: (err) => {
          if (this.esUltimoPagoRentaNoEncontrado(err)) {
            this.autocompletarMontosDesdeContratoCatalogo(idArrendatario, idContratoNum);
            return;
          }
          this.rentaMostrarMantenimiento = false;
          this.limpiarMontosMantenimientoModal();
          this.actualizarValidadoresMantenimientoModal();
          this.cdr.markForCheck();
        },
      });
  }

  private limpiarMontosMantenimientoModal(): void {
    this.rentaForm.get('totalMantenimiento')?.setValue(null, { emitEvent: false });
    this.rentaForm.get('montoFinalMantenimiento')?.setValue(null, { emitEvent: false });
    this.rentaTotalMantenimientoDisplay = '';
    this.rentaMontoFinalMantenimientoDisplay = '';
  }

  private actualizarValidadoresMantenimientoModal(): void {
    const req = [Validators.required];
    const ctrlTotal = this.rentaForm.get('totalMantenimiento');
    const ctrlFinal = this.rentaForm.get('montoFinalMantenimiento');
    if (this.rentaMostrarMantenimiento) {
      ctrlTotal?.setValidators(req);
      ctrlFinal?.setValidators(req);
    } else {
      ctrlTotal?.clearValidators();
      ctrlFinal?.clearValidators();
    }
    ctrlTotal?.updateValueAndValidity({ emitEvent: false });
    ctrlFinal?.updateValueAndValidity({ emitEvent: false });
  }

  private actualizarVisibilidadMantenimientoDesdeContratoSeleccionado(): void {
    const raw = this.rentaForm.getRawValue() as Record<string, unknown>;
    const idArr = Number(raw['idArrendatario']);
    const idCon = Number(raw['idContrato']);
    if (!Number.isFinite(idArr) || idArr <= 0 || !Number.isFinite(idCon) || idCon <= 0) {
      this.rentaMostrarMantenimiento = false;
      this.actualizarValidadoresMantenimientoModal();
      return;
    }
    const contrato = this.buscarContratoEnCatalogo(Math.floor(idArr), Math.floor(idCon));
    const mttoTotal = contrato ? this.extraerMantenimientoTotalContrato(contrato) : null;
    this.rentaMostrarMantenimiento = mttoTotal != null;
    this.actualizarValidadoresMantenimientoModal();
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
    const totalMtto = Number(this.rentaForm?.get('totalMantenimiento')?.value);
    const montoFinalMtto = Number(this.rentaForm?.get('montoFinalMantenimiento')?.value);
    this.rentaTotalDisplay = Number.isFinite(total) ? formatMonedaDesdeNumero(total) : '';
    this.rentaMontoFinalDisplay = Number.isFinite(montoFinal) ? formatMonedaDesdeNumero(montoFinal) : '';
    this.rentaTotalMantenimientoDisplay = Number.isFinite(totalMtto)
      ? formatMonedaDesdeNumero(totalMtto)
      : '';
    this.rentaMontoFinalMantenimientoDisplay = Number.isFinite(montoFinalMtto)
      ? formatMonedaDesdeNumero(montoFinalMtto)
      : '';
  }

  onRentaMonedaInput(ev: Event, campo: CampoMonedaRentaModal): void {
    const input = ev.target as HTMLInputElement;
    const cursor = input.selectionStart ?? 0;
    const simbolosAntes = contarMontoSimbolosAntesCursor(input.value, cursor);
    const raw = extraerMontoRawDesdeDisplay(input.value);
    const n = parseMonedaNumerico(raw);
    this.rentaForm.get(campo)?.setValue(Number.isFinite(n) ? n : null);
    const visible = formatMonedaAlEscribir(input.value);
    input.value = visible;
    const newCursor = cursorMontoTrasFormato(visible, simbolosAntes);
    input.setSelectionRange(newCursor, newCursor);
    if (campo === 'total') {
      this.rentaTotalDisplay = visible;
    } else if (campo === 'montoFinal') {
      this.rentaMontoFinalDisplay = visible;
    } else if (campo === 'totalMantenimiento') {
      this.rentaTotalMantenimientoDisplay = visible;
    } else {
      this.rentaMontoFinalMantenimientoDisplay = visible;
    }
    this.despuesDeCambioMonedaRenta(campo);
  }

  onRentaMonedaBlur(ev: Event, campo: CampoMonedaRentaModal): void {
    const input = ev.target as HTMLInputElement;
    const ctrl = this.rentaForm.get(campo);
    const n = this.parseNumeroFormulario(ctrl?.value);
    if (Number.isFinite(n)) {
      ctrl?.setValue(n);
      const fmt = formatMonedaDesdeNumero(n);
      input.value = fmt;
      if (campo === 'total') {
        this.rentaTotalDisplay = fmt;
      } else if (campo === 'montoFinal') {
        this.rentaMontoFinalDisplay = fmt;
      } else if (campo === 'totalMantenimiento') {
        this.rentaTotalMantenimientoDisplay = fmt;
      } else {
        this.rentaMontoFinalMantenimientoDisplay = fmt;
      }
      this.despuesDeCambioMonedaRenta(campo);
      return;
    }
    input.value = '';
    if (campo === 'total') {
      this.rentaTotalDisplay = '';
    } else if (campo === 'montoFinal') {
      this.rentaMontoFinalDisplay = '';
    } else if (campo === 'totalMantenimiento') {
      this.rentaTotalMantenimientoDisplay = '';
    } else {
      this.rentaMontoFinalMantenimientoDisplay = '';
    }
    this.despuesDeCambioMonedaRenta(campo);
  }

  private despuesDeCambioMonedaRenta(campo: CampoMonedaRentaModal): void {
    if (this.rentaCamposRecalculoFormula.has(campo)) {
      this.programarRecalculoRentaModal('formula');
      return;
    }
    if (this.rentaCamposRecalculoFactor.has(campo)) {
      this.programarRecalculoRentaModal('factor', campo);
    }
  }

  private cancelarRecalculoRentaProgramado(): void {
    if (this.rentaRecalcTimer != null) {
      clearTimeout(this.rentaRecalcTimer);
      this.rentaRecalcTimer = null;
    }
  }

  private programarRecalculoRentaModal(
    origen: 'formula' | 'factor',
    campoMontos?: CampoMonedaRentaModal,
  ): void {
    if (this.rentaModalSuprimirRecalc || !this.mostrarModalRenta) return;
    this.cancelarRecalculoRentaProgramado();

    if (origen === 'formula') {
      this.ejecutarRecalculoRentaModal(origen, campoMontos);
      return;
    }

    this.rentaRecalcTimer = setTimeout(() => {
      this.rentaRecalcTimer = null;
      this.ejecutarRecalculoRentaModal(origen, campoMontos);
    }, 350);
  }

  /** Reacción inmediata al elegir otra fórmula en el modal (solo UI local). */
  private onCambioFormulaRentaModal(idFormula: unknown): void {
    // Nueva fórmula: limpia montos/resumen previos antes de recalcular.
    this.reiniciarResultadosCalculoRentaModal();

    if (idFormula == null || idFormula === '') {
      this.actualizarResumenRentaModal();
      this.cdr.markForCheck();
      return;
    }

    this.actualizarResumenRentaModal();
    this.programarRecalculoRentaModal('formula');
    this.cdr.markForCheck();
  }

  /** Limpia montos calculados por fórmula sin tocar el total base. */
  private limpiarMontosDerivadosFormulaModal(): void {
    this.conRecalcSuspendido(() => {
      this.rentaForm.get('montoFinal')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('montoFinalMantenimiento')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('factorVariable')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('ocupoFormula')?.setValue(0, { emitEvent: false });
    });
    this.actualizarDisplayMonedaRenta();
  }

  private ejecutarRecalculoRentaModal(
    origen: 'formula' | 'factor',
    campoMontos?: CampoMonedaRentaModal,
  ): void {
    if (this.rentaModalSuprimirRecalc || !this.mostrarModalRenta) return;

    if (origen === 'formula') {
      if (this.idsPreviewRentaListos(this.rentaForm.getRawValue() as Record<string, unknown>)) {
        this.ejecutarPreviewFormula();
      }
      return;
    }

    if (campoMontos === 'montoFinal' || campoMontos === 'montoFinalMantenimiento') {
      this.recalcularFactorDesdeMontosFinales(campoMontos);
      return;
    }

    this.recalcularMontosDesdeFactor();
  }

  private conRecalcSuspendido(fn: () => void): void {
    this.rentaModalSuprimirRecalc = true;
    try {
      fn();
    } finally {
      this.rentaModalSuprimirRecalc = false;
    }
  }

  private recalcularMontosDesdeFactor(): void {
    const raw = this.rentaForm.getRawValue() as Record<string, unknown>;
    const factor = this.parseNumeroFormulario(raw['factorVariable']);
    const total = this.parseNumeroFormulario(raw['total']);
    if (!Number.isFinite(factor) || factor <= 0) return;

    this.conRecalcSuspendido(() => {
      if (Number.isFinite(total) && total > 0) {
        const montoFinal = Number((factor * total).toFixed(2));
        this.rentaForm.get('montoFinal')?.setValue(montoFinal, { emitEvent: false });
        this.rentaForm.get('ocupoFormula')?.setValue(1, { emitEvent: false });
      }

      if (this.rentaMostrarMantenimiento) {
        const totalMtto = this.parseNumeroFormulario(raw['totalMantenimiento']);
        if (Number.isFinite(totalMtto) && totalMtto > 0) {
          const montoFinalMtto = Number((factor * totalMtto).toFixed(2));
          this.rentaForm
            .get('montoFinalMantenimiento')
            ?.setValue(montoFinalMtto, { emitEvent: false });
        }
      }
    });

    this.actualizarDisplayMonedaRenta();
    this.actualizarResumenRentaModal();
    this.cdr.markForCheck();
  }

  private recalcularFactorDesdeMontosFinales(
    campo: 'montoFinal' | 'montoFinalMantenimiento',
  ): void {
    const raw = this.rentaForm.getRawValue() as Record<string, unknown>;
    let factor: number | null = null;

    if (campo === 'montoFinal') {
      const total = this.parseNumeroFormulario(raw['total']);
      const montoFinal = this.parseNumeroFormulario(raw['montoFinal']);
      if (Number.isFinite(total) && total > 0 && Number.isFinite(montoFinal) && montoFinal >= 0) {
        factor = parseFloat((montoFinal / total).toFixed(4));
      }
    } else {
      const totalMtto = this.parseNumeroFormulario(raw['totalMantenimiento']);
      const montoFinalMtto = this.parseNumeroFormulario(raw['montoFinalMantenimiento']);
      if (
        Number.isFinite(totalMtto) &&
        totalMtto > 0 &&
        Number.isFinite(montoFinalMtto) &&
        montoFinalMtto >= 0
      ) {
        factor = parseFloat((montoFinalMtto / totalMtto).toFixed(4));
      }
    }

    if (factor == null || !Number.isFinite(factor)) return;

    this.conRecalcSuspendido(() => {
      this.rentaForm.get('factorVariable')?.setValue(factor, { emitEvent: false });
      this.rentaForm.get('ocupoFormula')?.setValue(0, { emitEvent: false });

      if (campo === 'montoFinal') {
        const totalMtto = this.parseNumeroFormulario(raw['totalMantenimiento']);
        if (this.rentaMostrarMantenimiento && Number.isFinite(totalMtto) && totalMtto > 0) {
          const montoFinalMtto = Number((factor * totalMtto).toFixed(2));
          this.rentaForm
            .get('montoFinalMantenimiento')
            ?.setValue(montoFinalMtto, { emitEvent: false });
        }
      } else {
        const total = this.parseNumeroFormulario(raw['total']);
        if (Number.isFinite(total) && total > 0) {
          const montoFinal = Number((factor * total).toFixed(2));
          this.rentaForm.get('montoFinal')?.setValue(montoFinal, { emitEvent: false });
        }
      }
    });

    this.actualizarDisplayMonedaRenta();
    this.actualizarResumenRentaModal();
    this.cdr.markForCheck();
  }

  private limpiarEvaluacionFormulaCache(): void {
    this.ultimaEvaluacionFormula = null;
  }

  /** Aplica la misma evaluación de fórmula al total de renta y, si aplica, al de mantenimiento. */
  private aplicarFormulaEvaluadaAMontos(
    evalNorm: { resultado?: number; tipoResultado?: string },
  ): boolean {
    const raw = this.rentaForm.getRawValue() as Record<string, unknown>;
    const total = this.parseNumeroFormulario(raw['total']);
    if (!Number.isFinite(total) || total <= 0) return false;

    const aplicado = this.aplicarEvaluacionFormula(evalNorm, total);
    if (!aplicado) return false;

    this.conRecalcSuspendido(() => {
      this.rentaForm.get('montoFinal')?.setValue(aplicado.montoFinal, { emitEvent: false });
      this.rentaForm.get('factorVariable')?.setValue(aplicado.factorVariable, { emitEvent: false });
      this.rentaForm.get('ocupoFormula')?.setValue(1, { emitEvent: false });

      if (this.rentaMostrarMantenimiento) {
        const totalMtto = this.parseNumeroFormulario(raw['totalMantenimiento']);
        if (Number.isFinite(totalMtto) && totalMtto > 0) {
          const aplicadoMtto = this.aplicarEvaluacionFormula(evalNorm, totalMtto);
          if (aplicadoMtto) {
            this.rentaForm
              .get('montoFinalMantenimiento')
              ?.setValue(aplicadoMtto.montoFinal, { emitEvent: false });
          }
        } else {
          this.rentaForm.get('montoFinalMantenimiento')?.setValue(null, { emitEvent: false });
          this.rentaMontoFinalMantenimientoDisplay = '';
        }
      } else {
        this.limpiarMontosMantenimientoModal();
      }
    });

    this.actualizarDisplayMonedaRenta();
    this.actualizarResumenRentaModal();
    return true;
  }

  /** Mantenimiento total del contrato (con IVA); solo si `incluyeMantenimiento` es 1. */
  private extraerMantenimientoTotalContrato(contrato: Record<string, unknown>): number | null {
    if (Number(contrato['incluyeMantenimiento']) !== 1) return null;
    const raw = contrato['mantenimientoTotal'];
    if (raw == null || String(raw).trim() === '') return null;
    const n = parseValorNumerico(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
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

    const seq = this.previewFormulaSeq;
    this.evaluandoFormula = true;
    this.cdr.markForCheck();

    // Cálculo en front: el motor del API parte variables por espacios
    // ("Factor junio" → FACTOR + JUNIO). Aquí se respetan los nombres completos.
    void this.asegurarCatalogosEvalFormula()
      .then(() => {
        if (seq !== this.previewFormulaSeq) return;

        const local = evaluarFormulaLocalConFactores(
          this.formulasCatalogoRaw,
          this.factoresCatalogoEval,
          ids.idFormula,
        );
        const evalNorm = {
          resultado: local.resultado,
          tipoResultado: local.tipoResultado,
        };
        this.ultimaEvaluacionFormula = evalNorm;
        if (!this.aplicarFormulaEvaluadaAMontos(evalNorm)) {
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'warning',
            title: 'Sin total base',
            text: 'El contrato aún no tiene total cargado para aplicar la fórmula.',
            confirmButtonText: 'Entendido',
          });
        }
        this.scrollRentaModalSiCorresponde();
      })
      .catch((err: unknown) => {
        if (seq !== this.previewFormulaSeq) return;
        this.limpiarEvaluacionFormulaCache();
        this.limpiarMontosDerivadosFormulaModal();
        this.actualizarResumenRentaModal();
        console.error('Error al calcular la fórmula de la renta:', err);
        const msg =
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : this.mensajeErrorHttp(err) || 'No se pudo calcular la fórmula en el navegador.';
        void Swal.fire({
          background: '#141a21',
          color: '#ffffff',
          icon: 'error',
          title: 'No se pudo calcular la fórmula',
          text: msg,
          confirmButtonText: 'Entendido',
        });
      })
      .finally(() => {
        if (seq !== this.previewFormulaSeq) return;
        this.evaluandoFormula = false;
        this.cdr.markForCheck();
      });
  }

  /** Carga factores (+ fórmulas crudas) necesarios para el eval local. */
  private asegurarCatalogosEvalFormula(): Promise<void> {
    const tareas: Promise<unknown>[] = [];

    if (!this.formulasCatalogoRaw.length) {
      tareas.push(
        lastValueFrom(this.formulasService.obtenerFormulasData(1, 300)).then((resp) => {
          this.formulasCatalogoRaw = extraerFilasFormulasListadoApi(resp);
          this.formulasOpciones = this.mapFormulasOpciones(resp);
        }),
      );
    }

    if (!this.factoresCatalogoEval.length) {
      tareas.push(
        lastValueFrom(
          this.http.get<{ data?: unknown[] }>(`${environment.API_SECURITY}/factores/listado`),
        ).then((resp) => {
          const rows = Array.isArray(resp?.data) ? resp.data : [];
          this.factoresCatalogoEval = factoresActivosDesdeListadoApi(rows);
        }),
      );
    }

    if (!tareas.length) return Promise.resolve();
    return Promise.all(tareas).then(() => undefined);
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
    return `${campo.etiqueta}\u0000${campo.valor}`;
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

  aplicarBusquedaHub(): void {
    const grid = this.dataGrid?.instance;
    const texto = this.busquedaHub.trim().toLowerCase();
    if (!texto) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaRentas);
      return;
    }
    this.filtroActivo = texto;
    const dataFiltrada = this.filtrarFilasRentasPorTexto(texto);
    grid?.option('dataSource', dataFiltrada);
  }

  onGridOptionChanged(e: any): void {
    if (e.fullName !== 'searchPanel.text') return;
    const grid = this.dataGrid?.instance;
    const texto = (e.value ?? '').toString().trim().toLowerCase();
    if (!texto) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaRentas);
      return;
    }
    this.filtroActivo = texto;
    grid?.option('dataSource', this.filtrarFilasRentasPorTexto(texto));
  }

  private filtrarFilasRentasPorTexto(texto: string): RentaActualGridRow[] {
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

  limpiarVista(): void {
    this.busquedaHub = '';
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

  puedeExportarExcel(): boolean {
    return gridTieneDatosParaExportar(this.dataGrid?.instance);
  }

  async exportarExcel(): Promise<void> {
    await exportarDxDataGridExcel({
      component: this.dataGrid?.instance,
      fileName: 'RentasActuales',
    });
  }

  // ─── Modal alta ──────────────────────────────────────────────────────────────

  abrirModalAlta(): void {
    this.limpiarEfectoPasoRentaModal();
    this.rentaModalModo = 'alta';
    this.rentaEditId    = null;
    this.rentaForm.reset({
      idArrendatario: null,
      idContrato:     null,
      total:          null,
      idFormula:      null,
      montoFinal:     null,
      totalMantenimiento: null,
      montoFinalMantenimiento: null,
      factorVariable: null,
      ocupoFormula:   0,
    });
    this.rentaForm.get('idArrendatario')?.enable();
    this.rentaForm.get('idContrato')?.enable();
    this.contratosOpciones    = [];
    this.resumenRentaModal    = this.resumenRentaModalVacio();
    this.rentaTotalDisplay    = '';
    this.rentaMontoFinalDisplay = '';
    this.rentaTotalMantenimientoDisplay = '';
    this.rentaMontoFinalMantenimientoDisplay = '';
    this.rentaMostrarMantenimiento = false;
    this.rentaModoCalculo = 'formula';
    this.limpiarSeleccionPeriodosInpcRenta();
    this.limpiarEvaluacionFormulaCache();
    this.actualizarValidadoresMantenimientoModal();
    this.sincronizarValidadorIdFormulaRenta();
    this.rentaModalPermitirAutoScroll = true;
    this.previewFormulaSeq = 0;
    this.mostrarModalRenta    = true;
    this.cargarCatalogosModal();
    this.cdr.markForCheck();
  }

  // ─── Modal edición ───────────────────────────────────────────────────────────

  abrirModalEdicion(row: RentaActualGridRow): void {
    if (row?.pagada) return;
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;
    this.rentaModalModo    = 'edicion';
    this.rentaEditId       = Math.floor(id);
    this.rentaModalPermitirAutoScroll = false;
    this.previewFormulaSeq = 0;
    this.mostrarModalRenta = true;
    this.rentaForm.reset();
    this.rentaForm.get('idArrendatario')?.disable();
    this.rentaForm.get('idContrato')?.disable();
    this.resumenRentaModal = this.resumenRentaModalVacio();
    this.rentaTotalDisplay = '';
    this.rentaMontoFinalDisplay = '';
    this.rentaTotalMantenimientoDisplay = '';
    this.rentaMontoFinalMantenimientoDisplay = '';
    this.rentaMostrarMantenimiento = false;
    this.rentaModoCalculo = 'formula';
    this.limpiarSeleccionPeriodosInpcRenta();
    this.limpiarEvaluacionFormulaCache();
    this.sincronizarValidadorIdFormulaRenta();
    this.aplicarDetalleRentaEnFormulario(row.detalle);
    this.cargarCatalogosModal();
    this.cdr.markForCheck();
  }

  cerrarModalRenta(): void {
    this.previewFormulaSeq++;
    this.cancelarScrollRentaModalProgramado();
    this.cancelarRecalculoRentaProgramado();
    this.limpiarEfectoPasoRentaModal();
    this.mostrarModalRenta = false;
    this.rentaEditId       = null;
    this.rentaModalPermitirAutoScroll = false;
    this.resumenRentaModal = this.resumenRentaModalVacio();
    this.rentaTotalDisplay = '';
    this.rentaMontoFinalDisplay = '';
    this.rentaTotalMantenimientoDisplay = '';
    this.rentaMontoFinalMantenimientoDisplay = '';
    this.rentaMostrarMantenimiento = false;
    this.limpiarEvaluacionFormulaCache();
    this.cdr.markForCheck();
  }

  private intentarPreviewFormulaTrasCargarCatalogos(): void {
    const raw = this.rentaForm.getRawValue() as Record<string, unknown>;
    const idFormula = Number(raw['idFormula']);
    if (!Number.isFinite(idFormula) || idFormula <= 0) return;
    if (!this.idsPreviewRentaListos(raw)) return;
    this.ejecutarPreviewFormula();
  }

  /** Hidrata el formulario desde el registro del listado paginado (sin valueChanges). */
  private aplicarDetalleRentaEnFormulario(det: Record<string, unknown>): void {
    const vals = extraerRentaActualParaEdicion(det);
    this.rentaForm.patchValue(
      {
        idArrendatario: vals.idArrendatario,
        idContrato: vals.idContrato,
        total: vals.total,
        idFormula: vals.idFormula,
        montoFinal: vals.montoFinal,
        totalMantenimiento: vals.totalMantenimiento,
        montoFinalMantenimiento: vals.montoFinalMantenimiento,
        factorVariable: vals.factorVariable,
        ocupoFormula: vals.ocupoFormula,
      },
      { emitEvent: false },
    );
    this.rentaMostrarMantenimiento =
      (vals.totalMantenimiento != null && vals.totalMantenimiento > 0) ||
      (vals.montoFinalMantenimiento != null && vals.montoFinalMantenimiento > 0);
    this.actualizarValidadoresMantenimientoModal();
    this.actualizarDisplayMonedaRenta();
  }

  /** Sincroniza resumen y displays cuando catálogo y detalle de edición están listos. */
  private finalizarHidratacionModalEdicion(): void {
    if (this.rentaModalModo !== 'edicion' || this.catalogosModalCargando) return;

    const idArr = Number(this.rentaForm.getRawValue()['idArrendatario']);
    if (!Number.isFinite(idArr) || idArr <= 0) return;

    this.actualizarVisibilidadMantenimientoDesdeContratoSeleccionado();
    if (!this.rentaMostrarMantenimiento) {
      this.limpiarMontosMantenimientoModal();
    }
    this.actualizarDisplayMonedaRenta();
    this.actualizarResumenRentaModal();
    this.intentarPreviewFormulaTrasCargarCatalogos();
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
  
    if (this.rentaModoCalculo === 'formula' && (!Number.isFinite(idFor) || idFor <= 0)) {
      return { listo: false, mensajeVacio: 'Selecciona una fórmula para ver el resumen del pago.', pagoAFavorDe: '', arrendatario: '', campos: [], filaMontos: null };
    }

    if (this.rentaModoCalculo !== 'formula') {
      const factorActual = this.parseNumeroFormulario(raw['factorVariable']);
      if (!Number.isFinite(factorActual) || factorActual <= 0) {
        return {
          listo: false,
          mensajeVacio: this.rentaModoCalculo === 'inpc'
            ? 'Selecciona dos periodos INPC (numerador ÷ denominador) y aplícalos para ver el resumen del pago.'
            : 'Selecciona un periodo de % Anual y aplícalo para ver el resumen del pago.',
          pagoAFavorDe: '', arrendatario: '', campos: [], filaMontos: null,
        };
      }
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
  
    if (this.rentaModoCalculo === 'formula') {
      const formula = this.etiquetaOpcion(this.formulasOpciones, idFor);
      if (formula) campos.push({ etiqueta: 'Fórmula', valor: formula });
    } else {
      campos.push({
        etiqueta: 'Forma de cálculo',
        valor: this.rentaModoCalculo === 'inpc' ? 'INPC directo (Banxico)' : '% Anual directo (Banxico)',
      });
    }
  
    const montoFinalMtto = String(raw['montoFinalMantenimiento'] ?? '').trim();
    const factorVariable = String(raw['factorVariable'] ?? '').trim();

    const filaMontos: RentaModalResumenFilaMontos = {};
    if (factorVariable) {
      filaMontos.factor = { etiqueta: 'Factor INPC', valor: factorVariable };
    }
    const montoFinal = String(raw['montoFinal'] ?? '').trim();
    if (montoFinal) {
      filaMontos.montoACobrar = {
        etiqueta: 'Monto A Cobrar',
        valor: this.esNumeroCaptura(montoFinal) ? formatearMoneda(montoFinal) : montoFinal,
        dinero: true,
        destacado: true,
      };
    }
    if (this.rentaMostrarMantenimiento && montoFinalMtto) {
      filaMontos.montoFinalMantenimiento = {
        etiqueta: 'Monto mantenimiento',
        valor: this.esNumeroCaptura(montoFinalMtto)
          ? formatearMoneda(montoFinalMtto)
          : montoFinalMtto,
        dinero: true,
        destacado: true,
      };
    }

    const numRenta = this.parseNumeroFormulario(raw['montoFinal']);
    const numMtto = this.rentaMostrarMantenimiento
      ? this.parseNumeroFormulario(raw['montoFinalMantenimiento'])
      : NaN;
    if (
      this.rentaMostrarMantenimiento &&
      Number.isFinite(numRenta) &&
      numRenta > 0 &&
      Number.isFinite(numMtto) &&
      numMtto > 0
    ) {
      filaMontos.montoTotalCombinado = {
        etiqueta: 'Total a cobrar',
        valor: formatearMoneda(numRenta + numMtto),
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

  private montosMantenimientoDesdeFormulario(raw: Record<string, unknown>): {
    totalMantenimiento: number;
    montoFinalMantenimiento: number;
  } {
    if (!this.rentaMostrarMantenimiento) {
      return { totalMantenimiento: 0, montoFinalMantenimiento: 0 };
    }
    const totalMtto = this.parseNumeroFormulario(raw['totalMantenimiento']);
    const montoFinalMtto = this.parseNumeroFormulario(raw['montoFinalMantenimiento']);
    return {
      totalMantenimiento: Number.isFinite(totalMtto) && totalMtto > 0 ? totalMtto : 0,
      montoFinalMantenimiento:
        Number.isFinite(montoFinalMtto) && montoFinalMtto > 0 ? montoFinalMtto : 0,
    };
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
      lastValueFrom(this.arrendatariosService.obtenerArrendatariosListado()),
      lastValueFrom(this.formulasService.obtenerFormulasData(1, 300)),
      this.cargarCatalogoInpcRenta(),
      lastValueFrom(
        this.http.get<{ data?: unknown[] }>(`${environment.API_SECURITY}/factores/listado`),
      ),
    ])
      .then((results) => {
        const [arrResult, formResult, inpcResult, factoresResult] = results;
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
          this.formulasCatalogoRaw = extraerFilasFormulasListadoApi(formResult.value);
          this.formulasOpciones = this.mapFormulasOpciones(formResult.value);
        } else {
          console.error('Error fórmulas modal renta:', formResult.reason);
          this.formulasCatalogoRaw = [];
          this.formulasOpciones = [];
        }
        if (inpcResult.status === 'fulfilled') {
          this.catalogoInpcRenta = inpcResult.value;
        } else {
          console.error('Error catálogo INPC modal renta:', inpcResult.reason);
          this.catalogoInpcRenta = [];
        }
        this.reconstruirOpcionesInpcDx();
        if (factoresResult.status === 'fulfilled') {
          const rows = Array.isArray(factoresResult.value?.data)
            ? factoresResult.value.data
            : [];
          this.factoresCatalogoEval = factoresActivosDesdeListadoApi(rows);
        } else {
          console.error('Error factores modal renta:', factoresResult.reason);
          this.factoresCatalogoEval = [];
        }
      })
      .finally(() => {
        this.catalogosModalCargando = false;
        if (this.rentaModalModo === 'edicion') {
          this.finalizarHidratacionModalEdicion();
          return;
        }
        this.actualizarVisibilidadMantenimientoDesdeContratoSeleccionado();
        if (!this.rentaMostrarMantenimiento) {
          this.limpiarMontosMantenimientoModal();
        }
        this.actualizarDisplayMonedaRenta();
        this.actualizarResumenRentaModal();
        this.intentarPreviewFormulaTrasCargarCatalogos();
        if (this.arrendatariosOpciones.length > 0) {
          this.enfocarCampoRentaModal('arrendatario');
        }
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

    // En modo INPC/% Anual directo no hay fórmula guardada: se salta el
    // paso de evaluar/auditar (que requiere idFormula) y se va directo a
    // registrar/actualizar con lo que ya está resuelto en el formulario.
    if (this.rentaModoCalculo !== 'formula') {
      this.guardarRentaSinFormula(raw, total, idContrato, idArrendatario, ocupoFormula);
      return;
    }

    if (!Number.isFinite(total) || !Number.isFinite(idFormula)) {
      void Swal.fire({
        background: '#141a21', color: '#ffffff',
        icon: 'warning', title: 'Valores inválidos',
        text: 'Revisa el total y la fórmula seleccionada.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const montoFinal = this.parseNumeroFormulario(raw.montoFinal);
    const factorVariable = this.parseNumeroFormulario(raw.factorVariable);

    if (
      !Number.isFinite(montoFinal) ||
      montoFinal <= 0 ||
      !Number.isFinite(factorVariable) ||
      factorVariable <= 0
    ) {
      void Swal.fire({
        background: '#141a21', color: '#ffffff',
        icon: 'error', title: 'Montos inválidos',
        text: 'Selecciona la fórmula y espera el cálculo (monto final y factor) antes de guardar.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    this.rentaGuardando = true;
    this.cdr.markForCheck();

    // El cálculo ya se hizo en front. No se llama a /formulas/evaluar porque
    // el motor del API parte nombres con espacios ("Factor junio" → FACTOR+JUNIO).
    // Intento de auditoría en segundo plano (si falla, no bloquea el guardado).
    const evaluarBody: { idFormula: number; idContrato?: number; idArrendatario?: number } = {
      idFormula: Math.floor(idFormula),
    };
    if (Number.isFinite(idContrato) && idContrato > 0) {
      evaluarBody['idContrato'] = Math.floor(idContrato);
    }
    if (Number.isFinite(idArrendatario) && idArrendatario > 0) {
      evaluarBody['idArrendatario'] = Math.floor(idArrendatario);
    }
    this.formulasService.evaluar(evaluarBody).pipe(take(1)).subscribe({
      error: (err) => console.warn('Auditoría de fórmula omitida:', err),
    });

    const montosMtto = this.montosMantenimientoDesdeFormulario(raw);
    const putBody: RentaActualPutPayload = {
      total,
      idFormula: Math.floor(idFormula),
      montoFinal,
      totalMantenimiento: montosMtto.totalMantenimiento,
      montoFinalMantenimiento: montosMtto.montoFinalMantenimiento,
      factorVariable,
      ocupoFormula,
    };

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
  }

  /**
   * Guarda la renta cuando el modo de cálculo es INPC directo o % Anual
   * directo. Usa el MISMO servicio y la MISMA forma de payload
   * (RentaActualPostPayload / RentaActualPutPayload) que el modo Fórmula;
   * la única diferencia es que no se llama a FormulasService.evaluar()
   * porque no hay idFormula que auditar.
   */
  private guardarRentaSinFormula(
    raw: Record<string, unknown>,
    total: number,
    idContrato: number,
    idArrendatario: number,
    ocupoFormula: number,
  ): void {
    const montoFinal = this.parseNumeroFormulario(raw['montoFinal']);
    const factorVariable = this.parseNumeroFormulario(raw['factorVariable']);
    const idFormula = Number(raw['idFormula']);

    if (
      !Number.isFinite(total) ||
      !Number.isFinite(montoFinal) || montoFinal <= 0 ||
      !Number.isFinite(factorVariable) || factorVariable <= 0
    ) {
      void Swal.fire({
        background: '#141a21', color: '#ffffff',
        icon: 'warning', title: 'Valores inválidos',
        text: this.rentaModoCalculo === 'inpc'
          ? 'Selecciona dos periodos INPC (numerador ÷ denominador) y aplícalos antes de guardar.'
          : 'Selecciona un periodo de % Anual y aplícalo antes de guardar.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    this.rentaGuardando = true;
    this.cdr.markForCheck();

    const montosMtto = this.montosMantenimientoDesdeFormulario(raw);

    const putBody: RentaActualPutPayload = {
      total,
      idFormula: Number.isFinite(idFormula) && idFormula > 0 ? Math.floor(idFormula) : (null as unknown as number),
      montoFinal,
      totalMantenimiento: montosMtto.totalMantenimiento,
      montoFinalMantenimiento: montosMtto.montoFinalMantenimiento,
      factorVariable,
      ocupoFormula,
    };

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
      text: this.mensajeErrorRentaActual(err),
      confirmButtonText: 'Entendido',
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

  // ─── Duplicar al mes siguiente ────────────────────────────────────────────────

  async duplicarRentaAlSiguienteMes(row: RentaActualGridRow): Promise<void> {
    if (row?.pagada) return;
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;

    const periodoActual =
      row.mesLabel && row.mesLabel !== '—' ? row.mesLabel : 'el periodo actual';
    const periodoDestino = this.etiquetaMesSiguiente(row) ?? 'el mes siguiente';

    const result = await Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      icon: 'question',
      title: '¿Duplicar renta al mes siguiente?',
      html:
        `Se creará una copia idéntica de la renta de <strong>${row.arrendatarioLabel}</strong>` +
        ` (<strong>${row.contratoLabel}</strong>), avanzando el mes de ` +
        `<strong>${periodoActual}</strong> a <strong>${periodoDestino}</strong>.` +
        `<br><br>La operación fallará si ya existe una renta para el mismo arrendatario y contrato en ese mes.`,
      showCancelButton: true,
      confirmButtonText: 'Duplicar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    this.rentaActualService
      .duplicarAlSiguienteMes(Math.floor(id))
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.dataGrid?.instance?.refresh();
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'success',
            title: '¡Operación Exitosa!',
            text: `Se duplicó la renta hacia ${periodoDestino}.`,
            confirmButtonText: 'Listo',
          });
        },
        error: (err) => {
          console.error('Error al duplicar renta al mes siguiente:', err);
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'error',
            title: 'No se pudo duplicar la renta',
            text: this.mensajeErrorDuplicarSiguienteMes(err, row),
            confirmButtonText: 'Entendido',
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

  private mensajeErrorDuplicarSiguienteMes(err: unknown, row: RentaActualGridRow): string {
    const base = this.mensajeErrorHttp(err);
    const e = err as { status?: number; error?: { statusCode?: number; message?: string } };
    const status =
      e?.status ??
      (e?.error != null && typeof e.error === 'object' ? e.error.statusCode : undefined);

    const mencionaConflicto =
      /ya existe/i.test(base) ||
      /mismo arrendatario/i.test(base) ||
      /mes destino|mes siguiente/i.test(base);

    if (status === 409 || mencionaConflicto) {
      const periodoDestino = this.etiquetaMesSiguiente(row) ?? 'el mes siguiente';
      return (
        `Ya existe una renta para ${row.arrendatarioLabel} y el contrato ${row.contratoLabel} ` +
        `en ${periodoDestino}. No se puede duplicar.`
      );
    }

    return base;
  }

  /** Etiqueta del mes destino (+1) a partir del campo `mes` de la fila. */
  private etiquetaMesSiguiente(row: RentaActualGridRow): string | null {
    const raw = row?.detalle?.['mes'] ?? row?.detalle?.['mesRenta'] ?? row?.detalle?.['periodo'];
    if (raw == null || String(raw).trim() === '') return null;

    const texto = String(raw).trim();
    let fecha = new Date(texto);
    if (Number.isNaN(fecha.getTime())) {
      const partes = texto.match(/^(\d{4})-(\d{2})/);
      if (!partes) return null;
      fecha = new Date(Number(partes[1]), Number(partes[2]) - 1, 1);
    }

    const siguiente = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1);
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const nombre = meses[siguiente.getMonth()];
    return nombre ? `${nombre} ${siguiente.getFullYear()}` : null;
  }

  private mensajeErrorRentaActual(err: unknown): string {
    const base = this.mensajeErrorHttp(err);
    const amigable = this.mensajeConflictoRentaActiva(err, base);
    return amigable ?? base;
  }

  private mensajeConflictoRentaActiva(err: unknown, rawMsg: string): string | null {
    const e = err as { status?: number; error?: { statusCode?: number; message?: string } };
    const status =
      e?.status ??
      (e?.error != null && typeof e.error === 'object' ? e.error.statusCode : undefined);
    const esConflicto =
      status === 409 ||
      /ya existe una renta actual activa para el arrendatario\s+\d+\s+y\s+contrato\s+\d+/i.test(rawMsg);
    if (!esConflicto) return null;

    const raw = this.rentaForm?.getRawValue() as Record<string, unknown> | undefined;
    const idArr = Number(raw?.['idArrendatario']);
    const idCon = Number(raw?.['idContrato']);

    const arrendatario =
      Number.isFinite(idArr) && idArr > 0
        ? this.etiquetaOpcion(this.arrendatariosOpciones, idArr) ||
          `arrendatario #${Math.floor(idArr)}`
        : 'el arrendatario seleccionado';

    const contrato =
      Number.isFinite(idCon) && idCon > 0
        ? this.etiquetaOpcion(this.contratosOpciones, idCon) ||
          `contrato #${Math.floor(idCon)}`
        : 'el contrato seleccionado';

    return `Ya existe una renta actual activa para el arrendatario ${arrendatario} y el contrato ${contrato}.`;
  }
}