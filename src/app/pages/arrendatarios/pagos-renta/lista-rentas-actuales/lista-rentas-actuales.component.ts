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
  rentaSeccionRevealAnim,
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
  RentaActualPeriodoTipo,
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
  inmueble: string;
  campos: RentaModalResumenCampo[];
  filaMontos: RentaModalResumenFilaMontos | null;
}

@Component({
  selector: 'app-lista-rentas-actuales',
  templateUrl: './lista-rentas-actuales.component.html',
  styleUrl: './lista-rentas-actuales.component.scss',
  standalone: false,
  animations: [
    routeAnimation,
    contractDimAnim,
    contractModalAnim,
    rentaSeccionRevealAnim,
  ],
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

  /**
   * Captura libre: el usuario edita Total / Monto final / mtto sin fórmula ni INPC.
   * No es formControlName; al guardar fuerza ocupoFormula = 0.
   */
  rentaCapturaLibre = true;
  /** Periodo que cubre el pago: una fecha, rango, o sin elegir aún. */
  rentaPeriodoTipo: RentaActualPeriodoTipo | null = null;
  /** Fecha en que se registra el pago (UI; oculta por ahora, no va al API). */
  fechaRegistroRenta: Date = new Date();
  readonly rentaMostrarCampoFechaRegistro = false;
  /** Día que cubre el pago cuando `rentaPeriodoTipo === 'mes_actual'`. */
  fechaPeriodoMesRenta: Date = new Date();
  /** Rango de vigencia del pago (solo si `rentaPeriodoTipo === 'rango'`). */
  mesPeriodoDesdeRenta: Date = new Date();
  mesPeriodoHastaRenta: Date = new Date();
  /** Tras elegir contrato, la card Forma de cálculo aparece solo cuando el usuario confirma periodo/fecha. */
  rentaPeriodoListoParaFormaCalculo = false;
  private rentaCalculoRevealTimer: ReturnType<typeof setTimeout> | null = null;

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
      factorVariable: [null],
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
      this.rentaPeriodoListoParaFormaCalculo = false;
      this.cancelarRevealFormaCalculoProgramado();
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
      if (this.rentaModalModo === 'alta' && Number.isFinite(idCon) && idCon > 0) {
        this.programarRevealFormaCalculoTrasPeriodo();
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
   * `idFormula` solo es obligatorio en modo Fórmula (y sin captura libre).
   * En INPC/% directo o captura libre no va al flujo de evaluar; el body puede llevar null.
   */
  private sincronizarValidadorIdFormulaRenta(): void {
    const ctrl = this.rentaForm?.get('idFormula');
    if (!ctrl) return;
    if (!this.rentaCapturaLibre && this.rentaModoCalculo === 'formula') {
      ctrl.setValidators([Validators.required]);
    } else {
      ctrl.clearValidators();
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
  }

  /** Activa/desactiva captura libre de montos (sin fórmula / INPC). */
  alternarCapturaLibreRenta(): void {
    this.onCapturaLibreChange(!this.rentaCapturaLibre);
  }

  onCapturaLibreChange(activo: boolean): void {
    this.rentaCapturaLibre = !!activo;
    if (this.rentaCapturaLibre) {
      this.cancelarRevealFormaCalculoProgramado();
      this.rentaForm.get('idFormula')?.setValue(null, { emitEvent: false });
      this.rentaForm.get('ocupoFormula')?.setValue(0, { emitEvent: false });
      this.limpiarSeleccionPeriodosInpcRenta();
      this.limpiarEvaluacionFormulaCache();
    } else {
      this.marcarPeriodoListoParaFormaCalculo();
      this.rentaForm.get('ocupoFormula')?.setValue(1, { emitEvent: false });
    }
    this.sincronizarValidadorIdFormulaRenta();
    this.actualizarResumenRentaModal();
    this.desplazarCuerpoModalPorCapturaLibre(this.rentaCapturaLibre);
    this.cdr.markForCheck();
  }

  /** Card Forma de cálculo: aparece tras periodo/fecha y cuando no es captura libre. */
  get rentaMostrarCardFormaCalculo(): boolean {
    if (this.rentaCapturaLibre) return false;
    const idCon = Number(this.rentaForm.get('idContrato')?.value);
    if (!Number.isFinite(idCon) || idCon <= 0) return false;
    if (!this.rentaPeriodoListoParaFormaCalculo) return false;
    return this.validarPeriodoYFechaRegistroRenta(false);
  }

  private marcarPeriodoListoParaFormaCalculo(): void {
    if (!this.rentaPeriodoListoParaFormaCalculo) {
      this.rentaPeriodoListoParaFormaCalculo = true;
    }
  }

  private cancelarRevealFormaCalculoProgramado(): void {
    if (this.rentaCalculoRevealTimer != null) {
      clearTimeout(this.rentaCalculoRevealTimer);
      this.rentaCalculoRevealTimer = null;
    }
  }

  /** Tras animar la card de periodo, muestra Forma de cálculo si captura directa = No. */
  private programarRevealFormaCalculoTrasPeriodo(): void {
    this.cancelarRevealFormaCalculoProgramado();
    if (this.rentaModalModo !== 'alta' || this.rentaCapturaLibre) return;
    const idCon = Number(this.rentaForm.get('idContrato')?.value);
    if (!Number.isFinite(idCon) || idCon <= 0) return;

    this.rentaCalculoRevealTimer = setTimeout(() => {
      this.rentaCalculoRevealTimer = null;
      if (this.rentaCapturaLibre || this.rentaModalModo !== 'alta') return;
      this.marcarPeriodoListoParaFormaCalculo();
      this.cdr.markForCheck();
    }, 300);
  }

  /** Cambia si el pago es del mes actual o de un rango. */
  cambiarPeriodoTipoRenta(tipo: RentaActualPeriodoTipo): void {
    this.marcarPeriodoListoParaFormaCalculo();
    if (this.rentaPeriodoTipo === tipo) return;
    this.rentaPeriodoTipo = tipo;
    this.actualizarResumenRentaModal();
    this.cdr.markForCheck();
  }

  private resetPeriodoYFechaRegistroRenta(): void {
    const hoy = new Date();
    this.rentaCapturaLibre = true;
    this.rentaPeriodoListoParaFormaCalculo = false;
    this.rentaPeriodoTipo = null;
    this.fechaRegistroRenta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    this.fechaPeriodoMesRenta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    this.mesPeriodoDesdeRenta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    this.mesPeriodoHastaRenta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  }

  private fechaRegistroRentaValida(): Date | null {
    const d = this.fechaRegistroRenta;
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    return d;
  }

  private validarPeriodoYFechaRegistroRenta(mostrarAlerta: boolean): boolean {
    if (this.rentaPeriodoTipo == null) {
      if (mostrarAlerta) {
        void Swal.fire({
          background: '#141a21',
          color: '#ffffff',
          icon: 'warning',
          title: 'Vigencia del pago',
          text: 'Selecciona si el pago es de mes actual o de un rango.',
          confirmButtonText: 'Entendido',
        });
      }
      return false;
    }
    if (this.rentaPeriodoTipo === 'mes_actual') {
      const dia = this.fechaPeriodoMesRenta;
      if (!(dia instanceof Date) || Number.isNaN(dia.getTime())) {
        if (mostrarAlerta) {
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'warning',
          title: 'Vigencia incompleta',
          text: 'Selecciona la fecha que cubre este pago.',
            confirmButtonText: 'Entendido',
          });
        }
        return false;
      }
      return true;
    }

    const desde = this.mesPeriodoDesdeRenta;
    const hasta = this.mesPeriodoHastaRenta;
    if (!(desde instanceof Date) || Number.isNaN(desde.getTime()) ||
        !(hasta instanceof Date) || Number.isNaN(hasta.getTime())) {
      if (mostrarAlerta) {
        void Swal.fire({
          background: '#141a21',
          color: '#ffffff',
          icon: 'warning',
        title: 'Vigencia incompleta',
        text: 'Selecciona la fecha desde y la fecha hasta del pago.',
          confirmButtonText: 'Entendido',
        });
      }
      return false;
    }
    const ini = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
    const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
    if (ini > fin) {
      if (mostrarAlerta) {
        void Swal.fire({
          background: '#141a21',
          color: '#ffffff',
          icon: 'warning',
          title: 'Vigencia inválida',
          text: 'La fecha desde no puede ser posterior a la fecha hasta.',
          confirmButtonText: 'Entendido',
        });
      }
      return false;
    }
    return true;
  }

  /**
   * Fechas del periodo.
   * POST: `fechaInicio` obligatorio; `fechaFin` solo en rango.
   * PUT: solo `fechaFin` (o `null`) se actualiza; nunca `fechaInicio`.
   */
  private payloadFechaInicioPost(): string {
    if (this.rentaPeriodoTipo === 'rango') {
      return this.toIsoDateTimeUtcRenta(this.mesPeriodoDesdeRenta);
    }
    const dia = this.fechaPeriodoMesRenta;
    const fecha =
      dia instanceof Date && !Number.isNaN(dia.getTime()) ? dia : new Date();
    return this.toIsoDateTimeUtcRenta(fecha);
  }

  private payloadFechaFinOpcional(): string | null {
    if (this.rentaPeriodoTipo !== 'rango') return null;
    return this.toIsoDateTimeUtcRenta(this.mesPeriodoHastaRenta);
  }

  /** `YYYY-MM-DDT00:00:00.000Z` (día local → medianoche UTC, como el swagger). */
  private toIsoDateTimeUtcRenta(d: Date): string {
    return `${this.toIsoFechaInpcRenta(d)}T00:00:00.000Z`;
  }

  /** 1 = captura manual desactivada; 0 = captura manual activada. */
  private usaFormulaParaPayload(): number {
    return this.rentaCapturaLibre ? 0 : 1;
  }

  /** Periodo que cubre este pago (mes actual o rango capturado), no las fechas del contrato. */
  private etiquetaPeriodoEstePago(): string {
    if (this.rentaPeriodoTipo == null) return '—';
    if (this.rentaPeriodoTipo === 'rango') {
      const d = this.mesPeriodoDesdeRenta;
      const h = this.mesPeriodoHastaRenta;
      if (!(d instanceof Date) || Number.isNaN(d.getTime()) ||
          !(h instanceof Date) || Number.isNaN(h.getTime())) {
        return '—';
      }
      return `${formatearFecha(this.toIsoFechaInpcRenta(d))} → ${formatearFecha(this.toIsoFechaInpcRenta(h))}`;
    }
    const dia = this.fechaPeriodoMesRenta;
    if (!(dia instanceof Date) || Number.isNaN(dia.getTime())) return '—';
    return formatearFecha(this.toIsoFechaInpcRenta(dia));
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

  /** Vacío o inválido → 0. El factor no es obligatorio. */
  private factorVariableParaPayload(value: unknown): number {
    const n = this.parseNumeroFormulario(value);
    return Number.isFinite(n) ? n : 0;
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

  onRentaMonedaFocus(ev: Event, campo: CampoMonedaRentaModal): void {
    const input = ev.target as HTMLInputElement;
    const n = parseMonedaNumerico(input.value || this.displayMonedaRenta(campo));
    if (Number.isFinite(n) && n === 0) {
      this.asignarDisplayMonedaRenta(campo, '');
      input.value = '';
      return;
    }
    queueMicrotask(() => {
      try {
        input.select();
      } catch {
        /* input ya no enfocado */
      }
    });
  }

  onRentaMonedaInput(ev: Event, campo: CampoMonedaRentaModal): void {
    const input = ev.target as HTMLInputElement;
    const previo = this.displayMonedaRenta(campo);
    const bruto = this.textoMonedaTrasEscribirSobreCero(input.value, previo);
    const sobreCero = bruto !== input.value;
    const cursor = sobreCero ? bruto.length : (input.selectionStart ?? 0);
    const simbolosAntes = contarMontoSimbolosAntesCursor(bruto, cursor);
    const visible = formatMonedaAlEscribir(bruto);
    const n = parseMonedaNumerico(visible);
    this.rentaForm.get(campo)?.setValue(Number.isFinite(n) ? n : null, { emitEvent: false });
    this.asignarDisplayMonedaRenta(campo, visible);
    input.value = visible;
    const newCursor = cursorMontoTrasFormato(visible, simbolosAntes);
    queueMicrotask(() => {
      try {
        input.setSelectionRange(newCursor, newCursor);
      } catch {
        /* input ya no enfocado */
      }
    });
  }

  onRentaMonedaBlur(ev: Event, campo: CampoMonedaRentaModal): void {
    const input = ev.target as HTMLInputElement;
    const ctrl = this.rentaForm.get(campo);
    const n = parseMonedaNumerico(input.value);
    if (Number.isFinite(n)) {
      ctrl?.setValue(n, { emitEvent: false });
      const fmt = formatMonedaDesdeNumero(n);
      this.asignarDisplayMonedaRenta(campo, fmt);
      input.value = fmt;
    } else {
      ctrl?.setValue(null, { emitEvent: false });
      this.asignarDisplayMonedaRenta(campo, '');
      input.value = '';
    }
    this.despuesDeCambioMonedaRenta(campo);
  }

  private asignarDisplayMonedaRenta(campo: CampoMonedaRentaModal, visible: string): void {
    if (campo === 'total') this.rentaTotalDisplay = visible;
    else if (campo === 'montoFinal') this.rentaMontoFinalDisplay = visible;
    else if (campo === 'totalMantenimiento') this.rentaTotalMantenimientoDisplay = visible;
    else this.rentaMontoFinalMantenimientoDisplay = visible;
  }

  private displayMonedaRenta(campo: CampoMonedaRentaModal): string {
    if (campo === 'total') return this.rentaTotalDisplay;
    if (campo === 'montoFinal') return this.rentaMontoFinalDisplay;
    if (campo === 'totalMantenimiento') return this.rentaTotalMantenimientoDisplay;
    return this.rentaMontoFinalMantenimientoDisplay;
  }

  /**
   * Si el campo está en $0.00 y se escribe al final, el 3.er decimal se descarta
   * y el valor no cambia. Tomamos ese dígito como el nuevo importe.
   */
  private textoMonedaTrasEscribirSobreCero(actual: string, previo: string): string {
    const prevN = parseMonedaNumerico(previo);
    if (!(Number.isFinite(prevN) && prevN === 0)) return actual;
    const raw = String(actual ?? '')
      .replace(/\$/g, '')
      .replace(/,/g, '');
    const extra = raw.match(/^0?\.00+(\d+)$/);
    if (extra?.[1]) return extra[1];
    return actual;
  }

  private despuesDeCambioMonedaRenta(_campo: CampoMonedaRentaModal): void {
    this.actualizarResumenRentaModal();
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

  /** Sí → sube (oculta cálculo). No → baja a la card Forma de cálculo. */
  private desplazarCuerpoModalPorCapturaLibre(capturaDirecta: boolean): void {
    if (this.rentaModalModo !== 'alta' || !this.mostrarModalRenta) return;
    this.cancelarScrollRentaModalProgramado();
    const delay = capturaDirecta ? 300 : 360;
    this.rentaModalScrollTimer = setTimeout(() => {
      this.rentaModalScrollTimer = null;
      if (!this.mostrarModalRenta) return;
      requestAnimationFrame(() => {
        const cuerpo = this.rentaModalBody?.nativeElement;
        if (!cuerpo) return;
        if (capturaDirecta) {
          cuerpo.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        const cardCalculo = document.getElementById('rentaCardFormaCalculo');
        if (cardCalculo) {
          cardCalculo.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
          return;
        }
        cuerpo.scrollTo({ top: cuerpo.scrollHeight, behavior: 'smooth' });
      });
    }, delay);
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
      inmueble: '',
      campos: [],
      filaMontos: null,
    };
  }

  trackByResumenCampo(_index: number, campo: RentaModalResumenCampo): string {
    return `${campo.etiqueta}\u0000${campo.valor}`;
  }

  onPeriodoFechaRentaChange(): void {
    this.marcarPeriodoListoParaFormaCalculo();
    this.actualizarResumenRentaModal();
    this.cdr.markForCheck();
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
        row.fhRegistroFmt,
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
    this.rentaForm.get('idFormula')?.enable();
    this.contratosOpciones    = [];
    this.resumenRentaModal    = this.resumenRentaModalVacio();
    this.rentaTotalDisplay    = '';
    this.rentaMontoFinalDisplay = '';
    this.rentaTotalMantenimientoDisplay = '';
    this.rentaMontoFinalMantenimientoDisplay = '';
    this.rentaMostrarMantenimiento = false;
    this.rentaModoCalculo = 'formula';
    this.resetPeriodoYFechaRegistroRenta();
    // En alta el periodo inicia siempre en Mes actual, con su fecha visible.
    this.rentaPeriodoTipo = 'mes_actual';
    this.rentaPeriodoListoParaFormaCalculo = true;
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
    if (row?.pagada || !row?.puedeDuplicarMes) return;
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
    this.rentaForm.get('idFormula')?.disable();
    this.resumenRentaModal = this.resumenRentaModalVacio();
    this.rentaTotalDisplay = '';
    this.rentaMontoFinalDisplay = '';
    this.rentaTotalMantenimientoDisplay = '';
    this.rentaMontoFinalMantenimientoDisplay = '';
    this.rentaMostrarMantenimiento = false;
    this.rentaModoCalculo = 'formula';
    this.resetPeriodoYFechaRegistroRenta();
    this.limpiarSeleccionPeriodosInpcRenta();
    this.limpiarEvaluacionFormulaCache();
    this.sincronizarValidadorIdFormulaRenta();
    this.aplicarDetalleRentaEnFormulario(row.detalle);
    this.aplicarPeriodoDesdeGridRow(row);
    this.cargarCatalogosModal();
    this.cdr.markForCheck();
  }

  cerrarModalRenta(): void {
    this.previewFormulaSeq++;
    this.cancelarRevealFormaCalculoProgramado();
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
    this.rentaCapturaLibre = vals.ocupoFormula !== 1;
    this.sincronizarValidadorIdFormulaRenta();
    this.actualizarValidadoresMantenimientoModal();
    this.actualizarDisplayMonedaRenta();
    this.aplicarPeriodoDesdeDetalleApi(det);
  }

  /** Carga mes / fechaFin del API en los datebox del modal (edición). */
  private aplicarPeriodoDesdeDetalleApi(det: Record<string, unknown>): void {
    const inicio = this.parseFechaApiALocal(
      det['mes'] ?? det['fechaInicio'] ?? det['fecha_inicio'] ?? det['mesRenta'] ?? det['periodo'],
    );
    const fin = this.parseFechaApiALocal(det['fechaFin'] ?? det['fecha_fin']);
    this.asignarPeriodoFechasEdit(inicio, fin);
  }

  /** Respaldo: usa `periodoVm` del grid si el detalle no hidrató el tipo. */
  private aplicarPeriodoDesdeGridRow(row: RentaActualGridRow): void {
    if (this.rentaPeriodoTipo != null) return;
    const vm = row?.periodoVm;
    if (!vm) return;
    const inicio = this.parseFechaApiALocal(vm.inicioRaw) ?? this.parseFechaFmtLocal(vm.inicioFmt);
    const fin = this.parseFechaApiALocal(vm.finRaw) ?? this.parseFechaFmtLocal(vm.finFmt);
    if (vm.esRango) {
      this.asignarPeriodoFechasEdit(inicio, fin ?? inicio);
    } else {
      this.asignarPeriodoFechasEdit(inicio ?? fin, null);
    }
  }

  private asignarPeriodoFechasEdit(inicio: Date | null, fin: Date | null): void {
    if (inicio && fin && inicio.getTime() !== fin.getTime()) {
      this.rentaPeriodoTipo = 'rango';
      this.mesPeriodoDesdeRenta = inicio;
      this.mesPeriodoHastaRenta = fin;
      this.fechaPeriodoMesRenta = new Date(inicio.getTime());
    } else if (inicio) {
      this.rentaPeriodoTipo = 'mes_actual';
      this.fechaPeriodoMesRenta = inicio;
      this.mesPeriodoDesdeRenta = new Date(inicio.getTime());
      this.mesPeriodoHastaRenta = new Date(inicio.getTime());
    } else if (fin) {
      this.rentaPeriodoTipo = 'mes_actual';
      this.fechaPeriodoMesRenta = fin;
      this.mesPeriodoDesdeRenta = new Date(fin.getTime());
      this.mesPeriodoHastaRenta = new Date(fin.getTime());
    }

    if (this.rentaPeriodoTipo != null) {
      this.rentaPeriodoListoParaFormaCalculo = true;
    }
  }

  /** Día de calendario del ISO del API, sin corrimiento por zona. */
  private parseFechaApiALocal(raw: unknown): Date | null {
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
      return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return null;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    const texto = String(raw ?? '').trim();
    if (!texto) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
    const fmt = this.parseFechaFmtLocal(texto);
    if (fmt) return fmt;
    const parsed = new Date(texto);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  /** `dd/MM/yyyy` (como en la columna Periodo del grid). */
  private parseFechaFmtLocal(texto: string): Date | null {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texto ?? '').trim());
    if (!m) return null;
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (!Number.isFinite(d) || !Number.isFinite(mo) || !Number.isFinite(y)) return null;
    return new Date(y, mo - 1, d);
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
      return { listo: false, mensajeVacio: 'Selecciona un arrendatario para comenzar.', pagoAFavorDe: '', arrendatario: '', inmueble: '', campos: [], filaMontos: null };
    }
  
    if (!Number.isFinite(idCon) || idCon <= 0) {
      return { listo: false, mensajeVacio: 'Selecciona un contrato para continuar.', pagoAFavorDe: '', arrendatario: '', inmueble: '', campos: [], filaMontos: null };
    }
  
    if (this.rentaModoCalculo === 'formula' && !this.rentaCapturaLibre && (!Number.isFinite(idFor) || idFor <= 0)) {
      return { listo: false, mensajeVacio: 'Selecciona una fórmula para ver el resumen del pago.', pagoAFavorDe: '', arrendatario: '', inmueble: '', campos: [], filaMontos: null };
    }

    if (this.rentaModoCalculo !== 'formula' && !this.rentaCapturaLibre) {
      const factorActual = this.parseNumeroFormulario(raw['factorVariable']);
      if (!Number.isFinite(factorActual) || factorActual <= 0) {
        return {
          listo: false,
          mensajeVacio: this.rentaModoCalculo === 'inpc'
            ? 'Selecciona dos periodos INPC (numerador ÷ denominador) y aplícalos para ver el resumen del pago.'
            : 'Selecciona un periodo de % Anual y aplícalo para ver el resumen del pago.',
          pagoAFavorDe: '', arrendatario: '', inmueble: '', campos: [], filaMontos: null,
        };
      }
    }

    const montosResumen = this.evaluarMontosListosParaResumen(raw);
    if (!montosResumen.listo) {
      return {
        listo: false,
        mensajeVacio: montosResumen.mensaje,
        pagoAFavorDe: '',
        arrendatario: '',
        inmueble: '',
        campos: [],
        filaMontos: null,
      };
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
    const inmuebleResumen = inmueble
      ? (direccion ? `${inmueble} · ${direccion}` : inmueble)
      : '';
  
    if (this.rentaPeriodoTipo) {
      campos.push({ etiqueta: 'Vigencia del pago', valor: this.etiquetaPeriodoEstePago() });
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
        etiqueta: 'Renta a cobrar',
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
    if (Number.isFinite(numRenta) && numRenta > 0) {
      const totalCobrar =
        this.rentaMostrarMantenimiento &&
        Number.isFinite(numMtto) &&
        numMtto > 0
          ? numRenta + numMtto
          : numRenta;
      filaMontos.montoTotalCombinado = {
        etiqueta: 'Total a cobrar',
        valor: formatearMoneda(totalCobrar),
        dinero: true,
        destacado: true,
      };
    }
  
    return {
      listo: true,
      mensajeVacio: '',
      pagoAFavorDe,
      arrendatario: arrendatarioNombre || '—',
      inmueble: inmuebleResumen,
      campos,
      filaMontos: Object.keys(filaMontos).length ? filaMontos : null,
    };
  }

  private evaluarMontosListosParaResumen(raw: Record<string, unknown>): {
    listo: boolean;
    mensaje: string;
  } {
    const montoFinal = this.parseNumeroFormulario(raw['montoFinal']);
    if (!Number.isFinite(montoFinal) || montoFinal <= 0) {
      return {
        listo: false,
        mensaje: this.rentaCapturaLibre
          ? 'Captura el monto final para ver el resumen del pago.'
          : 'Completa el monto final de renta para ver el resumen del pago.',
      };
    }
    if (!this.rentaMostrarMantenimiento) {
      return { listo: true, mensaje: '' };
    }
    const totalMtto = this.parseNumeroFormulario(raw['totalMantenimiento']);
    const montoFinalMtto = this.parseNumeroFormulario(raw['montoFinalMantenimiento']);
    if (!Number.isFinite(totalMtto) || totalMtto <= 0) {
      return {
        listo: false,
        mensaje: 'Captura el total de mantenimiento para ver el resumen del pago.',
      };
    }
    if (!Number.isFinite(montoFinalMtto) || montoFinalMtto <= 0) {
      return {
        listo: false,
        mensaje: 'Captura el monto final de mantenimiento para ver el resumen del pago.',
      };
    }
    return { listo: true, mensaje: '' };
  }

  private validarMantenimientoRentaModal(mostrarAlerta: boolean): boolean {
    const raw = this.rentaForm.getRawValue() as Record<string, unknown>;
    const chequeo = this.evaluarMontosListosParaResumen(raw);
    if (chequeo.listo) {
      return true;
    }
    if (mostrarAlerta) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Montos incompletos',
        text: chequeo.mensaje.replace(' para ver el resumen del pago.', ' antes de guardar.'),
        confirmButtonText: 'Entendido',
      });
    }
    return false;
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

  textoPlaceholderArrendatario(): string {
    return this.arrendatariosOpciones.length
      ? 'Seleccione arrendatario'
      : 'No hay arrendatarios disponibles';
  }

  textoPlaceholderContrato(): string {
    const idArr = Number(this.rentaForm?.get('idArrendatario')?.value);
    if (!Number.isFinite(idArr) || idArr <= 0) {
      return 'Seleccione arrendatario primero';
    }
    return this.contratosOpciones.length
      ? 'Seleccione contrato'
      : 'No hay contratos disponibles';
  }

  textoPlaceholderFormula(): string {
    return this.formulasOpciones.length
      ? 'Seleccione fórmula'
      : 'No hay fórmulas disponibles';
  }

  textoPlaceholderInpcPeriodo(): string {
    return this.opcionesInpcDx.length
      ? 'Seleccione periodo'
      : 'No hay periodos INPC';
  }

  textoPlaceholderPorcentajePeriodo(): string {
    return this.opcionesPorcentajeAnualDx.length
      ? 'Seleccione periodo'
      : 'No hay periodos disponibles';
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

  async guardarRentaDesdeModal(): Promise<void> {
    if (!this.rentaForm || this.rentaForm.invalid) {
      void Swal.fire({
        background: '#141a21', color: '#ffffff',
        icon: 'warning', title: 'Faltan datos',
        text: 'Completa los campos obligatorios del formulario.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    if (!this.validarPeriodoYFechaRegistroRenta(true)) {
      return;
    }

    if (!this.validarMantenimientoRentaModal(true)) {
      return;
    }

    const esEdicion = this.rentaModalModo === 'edicion';
    const confirmacion = await Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      icon: 'question',
      title: esEdicion ? '¿Actualizar la renta?' : '¿Registrar Pago?',
      text: 'Verifica que los datos de la renta sean correctos antes de continuar.',
      showCancelButton: true,
      allowOutsideClick: false,
      allowEscapeKey: false,
      confirmButtonText: esEdicion ? 'Sí, actualizar' : 'Sí, registrar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });
    if (!confirmacion.isConfirmed) {
      return;
    }
  
    const raw            = this.rentaForm.getRawValue();
    const total          = this.parseNumeroFormulario(raw.total);
    const idFormula      = Number(raw.idFormula);
    const idContrato     = Number(raw.idContrato);
    const idArrendatario = Number(raw.idArrendatario);
    const ocupoFormula   = this.rentaCapturaLibre ? 0 : 1;

    // Captura libre o INPC/% Anual: mismo POST/PUT, sin auditoría de fórmula.
    if (this.rentaCapturaLibre || this.rentaModoCalculo !== 'formula') {
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
    const factorVariable = this.factorVariableParaPayload(raw.factorVariable);

    if (!Number.isFinite(montoFinal) || montoFinal <= 0) {
      void Swal.fire({
        background: '#141a21', color: '#ffffff',
        icon: 'error', title: 'Montos inválidos',
        text: 'Selecciona la fórmula y espera el cálculo del monto final antes de guardar.',
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
    const usaFormula = this.usaFormulaParaPayload();
    const fechaFin = this.payloadFechaFinOpcional();
    const putBody: RentaActualPutPayload = {
      total,
      montoFinal,
      totalMantenimiento: montosMtto.totalMantenimiento,
      montoFinalMantenimiento: montosMtto.montoFinalMantenimiento,
      fechaFin,
      usaFormula,
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
      idContrato: Math.floor(idContrato),
      fechaInicio: this.payloadFechaInicioPost(),
      total,
      montoFinal,
      totalMantenimiento: montosMtto.totalMantenimiento,
      montoFinalMantenimiento: montosMtto.montoFinalMantenimiento,
      fechaFin,
      usaFormula,
      idFormula: Math.floor(idFormula),
      factorVariable,
      ocupoFormula,
    };

    this.rentaActualService.registrarRenta(postBody)
      .pipe(take(1), finalize(() => { this.rentaGuardando = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => this.onRentaGuardadaOk('La renta del mes se registró correctamente.'),
        error: (err) => this.onRentaGuardadaError(err),
      });
  }

  /**
   * Guarda la renta cuando el modo de cálculo es INPC directo, % Anual
   * directo o captura libre. Usa el MISMO servicio y la MISMA forma de payload
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
    const factorVariable = this.factorVariableParaPayload(raw['factorVariable']);
    const idFormula = Number(raw['idFormula']);

    if (!Number.isFinite(total) || !Number.isFinite(montoFinal) || montoFinal <= 0) {
      void Swal.fire({
        background: '#141a21', color: '#ffffff',
        icon: 'warning', title: 'Valores inválidos',
        text: this.rentaCapturaLibre
          ? 'Completa total y monto final antes de guardar.'
          : this.rentaModoCalculo === 'inpc'
          ? 'Selecciona dos periodos INPC (numerador ÷ denominador) y aplícalos antes de guardar.'
          : 'Selecciona un periodo de % Anual y aplícalo antes de guardar.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    this.rentaGuardando = true;
    this.cdr.markForCheck();

    const montosMtto = this.montosMantenimientoDesdeFormulario(raw);
    const usaFormula = this.usaFormulaParaPayload();
    const fechaFin = this.payloadFechaFinOpcional();

    const putBody: RentaActualPutPayload = {
      total,
      montoFinal,
      totalMantenimiento: montosMtto.totalMantenimiento,
      montoFinalMantenimiento: montosMtto.montoFinalMantenimiento,
      fechaFin,
      usaFormula,
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
      idContrato: Math.floor(idContrato),
      fechaInicio: this.payloadFechaInicioPost(),
      total,
      montoFinal,
      totalMantenimiento: montosMtto.totalMantenimiento,
      montoFinalMantenimiento: montosMtto.montoFinalMantenimiento,
      ...(fechaFin != null ? { fechaFin } : {}),
      usaFormula,
      idFormula: Number.isFinite(idFormula) && idFormula > 0 ? Math.floor(idFormula) : null,
      factorVariable,
      ocupoFormula,
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
      icon: 'error', title: '¡Ops!',
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