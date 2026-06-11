import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { catchError, finalize, of, take } from 'rxjs';
import Swal from 'sweetalert2';
import {
  contractDimAnim,
  contractModalAnim,
  routeAnimation,
} from 'src/app/pipe/module-open.animation';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import {
  CatMetodoPagoItem,
  CatMetodosPagoService,
} from 'src/app/services/moduleService/cat-metodos-pago.service';
import { PagoArrendatarioService } from 'src/app/services/moduleService/pago-arrendatario.service';
import { DocumentoPreviewComponent } from 'src/app/shared/documento-preview/documento-preview.component';
import {
  contarMontoSimbolosAntesCursor,
  cursorMontoTrasFormato,
  extraerMontoRawDesdeDisplay,
  formatMonedaDesdeNumero,
  formatearMonedaDesdeLimpia,
  parseMonedaNumerico,
} from 'src/app/shared/valor-miles-format';
import { urlPdfTarjetaInmueble } from '../../../monitoreo/monitoreo-inmueble.mapper';
import {
  extraerServiciosArrendatarioListaPago,
  ServicioArrendatarioListaPago,
} from '../../../monitoreo/monitoreo-arrendatario-detalle.mapper';
import {
  construirFormDataPagoArrendatario,
  extraerFilasPagosApi,
  extraerPagoDetalleApi,
  mapPagoApiToVistaDetalle,
  OPCIONES_ESTATUS_PAGO_API,
  PagoEstatusUi,
  VistaPagoDetalleModal,
} from '../../../monitoreo/monitoreo-pagos.mapper';
import {
  extraerFilasPaginadasApi,
  nombreArrendatarioDesdeApi,
  resolverIdArrendatarioApi,
} from '../../arrendatarios-list.mapper';
import {
  claveMesActual,
  formatearEtiquetaMesPago,
  esServicioArrendatarioExcluidoHub,
  mapPagosServiciosHubGridRows,
  PagoServicioHubGridRow,
} from '../pago-servicio-actual-list.mapper';

interface SelectOpcion {
  id: number;
  label: string;
}

@Component({
  selector: 'app-lista-pagos-servicios-actuales',
  templateUrl: './lista-pagos-servicios-actuales.component.html',
  styleUrl: './lista-pagos-servicios-actuales.component.scss',
  standalone: false,
  animations: [routeAnimation, contractDimAnim, contractModalAnim],
})
export class ListaPagosServiciosActualesComponent implements OnInit {
  readonly etiquetaComprobanteFormatos = 'PDF · PNG · JPG';

  embebidoEnHub = false;
  pagosData: PagoServicioHubGridRow[] = [];
  pagosVisibles: PagoServicioHubGridRow[] = [];
  busquedaPagos = '';
  loading = false;

  mesFiltroPagosSeleccionado = claveMesActual();
  mesesFiltroPagosOpciones: { value: string; label: string }[] = [];

  mostrarModalPago = false;
  mostrarModalPagoDetalle = false;
  pagoGuardando = false;
  pagoForm!: FormGroup;
  pagoMontoRaw = '';

  arrendatariosOpciones: SelectOpcion[] = [];
  private arrendatariosCatalogo: Record<string, unknown>[] = [];
  serviciosArrendatarioModalPago: ServicioArrendatarioListaPago[] = [];
  serviciosArrendatarioModalPagoCargando = false;
  listaCatMetodosPago: CatMetodoPagoItem[] = [];
  metodosPagoCargando = false;

  pagoDetalleModal: VistaPagoDetalleModal | null = null;
  pagoDetalleModalLoading = false;
  pagoDetalleModalError: string | null = null;

  @ViewChild('pagoMontoInput', { static: false })
  pagoMontoInput?: ElementRef<HTMLInputElement>;

  @ViewChild('pagoComprobanteInput', { static: false })
  pagoComprobanteInput?: ElementRef<HTMLInputElement>;

  @ViewChild('docPreview', { static: false })
  docPreview?: DocumentoPreviewComponent;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private pagoArrendatarioService: PagoArrendatarioService,
    private arrendatariosService: ArrendatariosService,
    private catMetodosPagoService: CatMetodosPagoService,
  ) {}

  ngOnInit(): void {
    this.embebidoEnHub = this.leerEmbebidoEnHub();
    this.initPagoForm();
    this.cargarArrendatariosCatalogo();
    this.cargarPagosGrid();
  }

  private initPagoForm(): void {
    this.pagoForm = this.fb.group({
      idArrendatario: [null, Validators.required],
      idServicioArrendatario: [null],
      concepto: [''],
      fechaPago: ['', Validators.required],
      monto: ['', Validators.required],
      idMetodoPago: [null as number | null],
      estatus: ['Pendiente' as PagoEstatusUi],
      comprobantePago: [null as File | null, Validators.required],
      comprobantePagoNombre: [''],
    });

    this.pagoForm.get('idArrendatario')?.valueChanges.subscribe((id) => {
      this.onArrendatarioModalChange(id);
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

  private cargarArrendatariosCatalogo(): void {
    this.arrendatariosService
      .obtenerArrendatariosPaginated(1, 500)
      .pipe(take(1))
      .subscribe({
        next: (res: unknown) => {
          this.arrendatariosCatalogo = extraerFilasPaginadasApi(res);
          this.arrendatariosOpciones = this.mapArrendatariosOpciones(
            this.arrendatariosCatalogo,
          );
          this.cdr.markForCheck();
        },
        error: () => {
          this.arrendatariosCatalogo = [];
          this.arrendatariosOpciones = [];
          this.cdr.markForCheck();
        },
      });
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

  private etiquetaArrendatarioPorId(id: number): string {
    const hit = this.arrendatariosOpciones.find((o) => o.id === id);
    return hit?.label ?? '';
  }

  cargarPagosGrid(): void {
    this.loading = true;
    this.pagoArrendatarioService
      .obtenerPagosPaginados(1, 500)
      .pipe(
        take(1),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          const filas = extraerFilasPagosApi(res);
          this.pagosData = mapPagosServiciosHubGridRows(filas, {
            resolverMetodo: (idMet: number) => this.etiquetaCatMetodoPagoPorId(idMet),
            resolverArrendatario: (idArr: number) => this.etiquetaArrendatarioPorId(idArr),
          });
          this.refrescarMesesFiltroPagosOpciones();
        },
        error: () => {
          this.pagosData = [];
          this.refrescarMesesFiltroPagosOpciones();
        },
      });
  }

  seleccionarMesFiltro(value: string): void {
    this.mesFiltroPagosSeleccionado = value || claveMesActual();
    this.aplicarFiltrosVista();
  }

  get conteoPagados(): number {
    return this.pagosVisibles.filter((p) => p.estatus === 'Pagado').length;
  }

  get conteoPendientes(): number {
    return this.pagosVisibles.filter((p) => p.estatus === 'Pendiente').length;
  }

  get mesFiltroEtiqueta(): string {
    if (this.mesFiltroPagosSeleccionado === '__all__') return '';
    const hit = this.mesesFiltroPagosOpciones.find(
      (m) => m.value === this.mesFiltroPagosSeleccionado,
    );
    return hit ? ` en ${hit.label}` : '';
  }

  get busquedaPagosActiva(): boolean {
    return this.busquedaPagos.trim().length > 0;
  }

  get hayPagosEnCatalogo(): boolean {
    return this.pagosData.length > 0;
  }

  formatearFechaPago(fecha: string): string {
    const s = String(fecha ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '—';
    const [y, m, d] = s.split('-');
    const meses = [
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
    ];
    const mi = Number(m) - 1;
    return `${Number(d)} ${meses[mi] ?? m} ${y}`;
  }

  private refrescarMesesFiltroPagosOpciones(): void {
    const meses = new Set<string>();
    this.pagosData.forEach((r) => {
      if (r.mesClave) meses.add(r.mesClave);
    });

    const ordenados = Array.from(meses).sort();
    const opciones = ordenados.map((value) => ({
      value,
      label: formatearEtiquetaMesPago(value),
    }));
    this.mesesFiltroPagosOpciones = [
      { value: '__all__', label: 'Todos los meses' },
      ...opciones,
    ];

    const existeSeleccion = this.mesesFiltroPagosOpciones.some(
      (o) => o.value === this.mesFiltroPagosSeleccionado,
    );
    if (!existeSeleccion) {
      this.mesFiltroPagosSeleccionado = claveMesActual();
      const mesActualExiste = this.mesesFiltroPagosOpciones.some(
        (o) => o.value === this.mesFiltroPagosSeleccionado,
      );
      if (!mesActualExiste) this.mesFiltroPagosSeleccionado = '__all__';
    }
    this.aplicarFiltrosVista();
  }

  aplicarFiltrosVista(): void {
    let rows = [...this.pagosData];

    if (this.mesFiltroPagosSeleccionado !== '__all__') {
      rows = rows.filter((r) => r.mesClave === this.mesFiltroPagosSeleccionado);
    }

    const q = this.busquedaPagos.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [r.arrendatarioLabel, r.servicioLabel, r.concepto, r.metodo, r.montoFmt, r.estatus].some(
          (campo) => String(campo ?? '').toLowerCase().includes(q),
        ),
      );
    }

    this.pagosVisibles = rows;
  }

  limpiarVista(): void {
    this.busquedaPagos = '';
    this.mesFiltroPagosSeleccionado = claveMesActual();
    const mesActualExiste = this.mesesFiltroPagosOpciones.some(
      (o) => o.value === this.mesFiltroPagosSeleccionado,
    );
    if (!mesActualExiste) {
      this.mesFiltroPagosSeleccionado = '__all__';
    }
    this.aplicarFiltrosVista();
  }

  clasesEstatusPago(estatus: unknown): Record<string, boolean> {
    const e = String(estatus ?? '') as PagoEstatusUi;
    return {
      'mono-pago-estatus': true,
      'mono-pago-estatus--pagado': e === 'Pagado',
      'mono-pago-estatus--pendiente': e === 'Pendiente',
      'mono-pago-estatus--cancelado': e === 'Cancelado',
    };
  }

  abrirModalAlta(): void {
    this.cargarCatalogoMetodosPago();
    this.mostrarModalPago = true;
    this.pagoMontoRaw = '';
    this.serviciosArrendatarioModalPago = [];
    this.pagoForm.reset({
      idArrendatario: null,
      idServicioArrendatario: null,
      concepto: '',
      fechaPago: '',
      monto: '',
      idMetodoPago: null,
      estatus: 'Pendiente' as PagoEstatusUi,
      comprobantePago: null,
      comprobantePagoNombre: '',
    });
    this.cdr.markForCheck();
    setTimeout(() => {
      const el = this.pagoComprobanteInput?.nativeElement;
      if (el) el.value = '';
      const montoEl = this.pagoMontoInput?.nativeElement;
      if (montoEl) montoEl.value = '';
    });
  }

  cerrarModalPago(): void {
    this.mostrarModalPago = false;
    this.cdr.markForCheck();
  }

  private onArrendatarioModalChange(idArrendatario: unknown): void {
    const id = Number(idArrendatario);
    this.pagoForm.patchValue(
      { idServicioArrendatario: null, concepto: '' },
      { emitEvent: false },
    );
    if (!Number.isFinite(id) || id <= 0) {
      this.serviciosArrendatarioModalPago = [];
      this.cdr.markForCheck();
      return;
    }
    this.cargarServiciosParaModalPago(Math.floor(id));
  }

  private cargarServiciosParaModalPago(idArrendatario: number): void {
    this.serviciosArrendatarioModalPago = [];
    this.serviciosArrendatarioModalPagoCargando = true;
    this.arrendatariosService
      .obtenerServiciosArrendatario(idArrendatario)
      .pipe(
        take(1),
        catchError((err) => {
          console.error('Error al cargar servicios del arrendatario:', err);
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'error',
            title: 'No se pudieron cargar los servicios',
            text: 'No se obtuvo la lista de servicios del arrendatario. Intenta de nuevo.',
            confirmButtonText: 'Entendido',
          });
          return of(null);
        }),
        finalize(() => {
          this.serviciosArrendatarioModalPagoCargando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe((resp) => {
        this.serviciosArrendatarioModalPago = extraerServiciosArrendatarioListaPago(resp).filter(
          (s) => !esServicioArrendatarioExcluidoHub(s.etiquetaTipoServicio),
        );
      });
  }

  onPagoServicioChange(): void {
    const raw = this.pagoForm?.get('idServicioArrendatario')?.value;
    if (raw === null || raw === undefined || raw === '') return;
    const numId = Number(raw);
    if (!Number.isFinite(numId) || numId === 0) return;
    const hit = this.serviciosArrendatarioModalPago.find((s) => s.id === numId);
    const etiqueta = String(hit?.etiquetaTipoServicio ?? '').trim();
    if (!etiqueta) return;
    const conceptoActual = String(this.pagoForm?.get('concepto')?.value ?? '').trim();
    if (conceptoActual) return;
    this.pagoForm?.patchValue({ concepto: etiqueta });
    this.cdr.markForCheck();
  }

  onPagoComprobanteFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.pagoForm?.patchValue({
      comprobantePago: file,
      comprobantePagoNombre: file?.name ?? '',
    });
    this.cdr.markForCheck();
  }

  guardarPagoDesdeModal(): void {
    if (!this.pagoForm) return;
    if (this.pagoForm.invalid) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Completa arrendatario, fecha, monto y comprobante.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const v = this.pagoForm.value as {
      idArrendatario: number | null;
      idServicioArrendatario: number | null;
      concepto: string;
      fechaPago: string;
      monto: string;
      idMetodoPago: number | null;
      estatus: PagoEstatusUi;
      comprobantePago: File | null;
    };

    const idArrendatario = Number(v.idArrendatario);
    if (!Number.isFinite(idArrendatario) || idArrendatario <= 0) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Selecciona un arrendatario',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const idSrvArr = Number(v.idServicioArrendatario);
    if (!Number.isFinite(idSrvArr) || idSrvArr <= 0) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Selecciona un servicio',
        text: 'Elige el servicio pagado (agua, luz, etc.).',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const montoN = parseMonedaNumerico(v.monto);
    if (!Number.isFinite(montoN)) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Monto inválido',
        text: 'Captura un monto válido.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const archivo = v.comprobantePago;
    if (!(archivo instanceof File)) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Comprobante obligatorio',
        text: 'El API requiere adjuntar el archivo del comprobante.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const fd = construirFormDataPagoArrendatario(
      Math.floor(idArrendatario),
      Math.floor(idSrvArr),
      v,
      montoN,
      archivo,
    );

    this.pagoGuardando = true;
    this.cdr.markForCheck();
    this.pagoArrendatarioService
      .registrarPago(fd)
      .pipe(
        finalize(() => {
          this.pagoGuardando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.cerrarModalPago();
          this.cargarPagosGrid();
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'success',
            title: '¡Operación Exitosa!',
            text: 'El pago y el comprobante se enviaron correctamente.',
            confirmButtonText: 'Listo',
          });
        },
        error: (err: unknown) => {
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'error',
            title: 'No se pudo registrar el pago',
            text: this.mensajeErrorHttp(err),
            confirmButtonText: 'Entendido',
          });
        },
      });
  }

  abrirModalPagoDetalle(row: PagoServicioHubGridRow): void {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;

    this.mostrarModalPagoDetalle = true;
    this.pagoDetalleModal = null;
    this.pagoDetalleModalError = null;
    this.pagoDetalleModalLoading = true;
    this.cdr.markForCheck();

    this.pagoArrendatarioService
      .obtenerPagoPorId(Math.floor(id))
      .pipe(
        take(1),
        finalize(() => {
          this.pagoDetalleModalLoading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          const item = extraerPagoDetalleApi(res);
          if (!item) {
            this.pagoDetalleModalError = 'No se encontró el pago.';
            return;
          }
          this.pagoDetalleModal = mapPagoApiToVistaDetalle(item, {
            resolverMetodo: (idMetodo: number) => this.etiquetaCatMetodoPagoPorId(idMetodo),
          });
          if (!this.pagoDetalleModal) {
            this.pagoDetalleModalError = 'No se pudo interpretar el pago.';
          }
        },
        error: () => {
          this.pagoDetalleModalError =
            'No se pudo cargar el pago. Verifique su conexión e intente de nuevo.';
        },
      });
  }

  cerrarModalPagoDetalle(): void {
    this.mostrarModalPagoDetalle = false;
    this.pagoDetalleModalLoading = false;
    this.pagoDetalleModalError = null;
    this.pagoDetalleModal = null;
    this.cdr.markForCheck();
  }

  verComprobantePagoDetalleModal(): void {
    const url = String(this.pagoDetalleModal?.urlComprobante ?? '').trim();
    if (!url) return;
    const titulo = this.pagoDetalleModal?.concepto ?? 'Comprobante';
    const previewUrl = urlPdfTarjetaInmueble(url, titulo) ?? url;
    this.docPreview?.abrir(previewUrl, titulo, 'Pagos de servicios');
  }

  async solicitarCambioEstatusPago(row: PagoServicioHubGridRow): Promise<void> {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;

    const estatusInicial = this.estatusPagoNumericoApiDesdeEtiqueta(row.estatus);
    const conceptoLabel = String(row.concepto ?? 'Pago').trim() || 'Pago';

    const result = await Swal.fire({
      title: '¡Actualizar estatus del pago!',
      html: this.htmlModalEstatusPago(estatusInicial, conceptoLabel),
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      customClass: { popup: 'swal-estatus-local' },
      background: '#141a21',
      color: '#ffffff',
      didOpen: () => this.inicializarSelectorEstatusPagoSwal(),
      preConfirm: () => {
        const activo = Swal.getPopup()?.querySelector('.swal-estatus-local__opt--active');
        const val = activo?.getAttribute('data-value');
        if (val == null || val === '') {
          Swal.showValidationMessage('Selecciona un estatus para el pago.');
          return false;
        }
        return Number(val);
      },
    });

    const nuevoRaw = result.value;
    if (!result.isConfirmed || nuevoRaw === false || nuevoRaw === undefined) return;
    const nuevoEstatus =
      typeof nuevoRaw === 'number' ? nuevoRaw : Number(String(nuevoRaw));
    if (!Number.isFinite(nuevoEstatus)) return;
    if (nuevoEstatus === estatusInicial) return;

    this.pagoArrendatarioService
      .actualizarEstatus(Math.floor(id), { estatus: nuevoEstatus })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.cargarPagosGrid();
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'success',
            title: '¡Operación Exitosa!',
            text: 'El estatus del pago se guardó correctamente.',
            confirmButtonText: 'Listo',
          });
        },
        error: (err: unknown) => {
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'error',
            title: 'No se pudo actualizar',
            text: this.mensajeErrorHttp(err),
            confirmButtonText: 'Entendido',
          });
        },
      });
  }

  etiquetaCatMetodoPago(item: CatMetodoPagoItem): string {
    const nombre = item.nombre;
    if (nombre != null && String(nombre).trim() !== '') return String(nombre).trim();
    return `Método ${item.id}`;
  }

  etiquetaCatMetodoPagoPorId(id: number | null | undefined): string {
    if (id == null || !Number.isFinite(Number(id))) return '—';
    const hit = this.listaCatMetodosPago.find((m) => m.id === Number(id));
    return hit ? this.etiquetaCatMetodoPago(hit) : `Método ${id}`;
  }

  private cargarCatalogoMetodosPago(): void {
    this.metodosPagoCargando = true;
    this.catMetodosPagoService.obtenerMetodosPagoPaginados(1, 100).subscribe({
      next: (res) => {
        this.listaCatMetodosPago = this.extraerFilasCatMetodosPago(res).filter(
          (m) => m.estatus == null || m.estatus === 1,
        );
        this.metodosPagoCargando = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.listaCatMetodosPago = [];
        this.metodosPagoCargando = false;
        this.cdr.markForCheck();
      },
    });
  }

  private extraerFilasCatMetodosPago(res: unknown): CatMetodoPagoItem[] {
    const r = res as { data?: unknown } | unknown[] | null;
    if (r == null) return [];
    let rows: unknown = Array.isArray(r) ? r : (r as { data?: unknown }).data;
    if (rows != null && typeof rows === 'object' && !Array.isArray(rows)) {
      const bag = rows as Record<string, unknown>;
      rows = bag['items'] ?? bag['rows'] ?? bag['content'] ?? bag['data'];
    }
    if (!Array.isArray(rows)) return [];
    return rows
      .map((item) => {
        const row = item as Record<string, unknown>;
        const id = Number(row['id'] ?? row['idCatMetodoPago']);
        if (!Number.isFinite(id)) return null;
        let estatus: number | undefined;
        if (typeof row['activo'] === 'boolean') {
          estatus = row['activo'] ? 1 : 0;
        } else if (row['estatus'] != null) {
          const n = Number(row['estatus']);
          estatus = n === 1 ? 1 : 0;
        }
        return {
          id,
          nombre: row['nombre'] != null ? String(row['nombre']) : undefined,
          estatus,
        } as CatMetodoPagoItem;
      })
      .filter((item): item is CatMetodoPagoItem => item != null);
  }

  private estatusPagoNumericoApiDesdeEtiqueta(estatus: PagoEstatusUi): number {
    if (estatus === 'Pagado') return 1;
    if (estatus === 'Cancelado') return 0;
    return 2;
  }

  private escapeHtmlSwal(texto: string): string {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private htmlModalEstatusPago(estatusSeleccionado: number, concepto: string): string {
    const conceptoEsc = this.escapeHtmlSwal(concepto);
    const opciones = OPCIONES_ESTATUS_PAGO_API.map((op: (typeof OPCIONES_ESTATUS_PAGO_API)[number]) => {
      const activa =
        op.value === estatusSeleccionado ? ' swal-estatus-local__opt--active' : '';
      const etiqueta = this.escapeHtmlSwal(op.label);
      return `<button type="button" class="swal-estatus-local__opt${activa}" data-value="${op.value}" aria-pressed="${op.value === estatusSeleccionado}">${etiqueta}</button>`;
    }).join('');

    return `
      <div class="swal-estatus-local__wrap">
        <div class="swal-estatus-local__icon" aria-hidden="true">
          <i class="fa fa-exchange"></i>
        </div>
        <p class="swal-estatus-local__local">Pago: <strong>${conceptoEsc}</strong></p>
        <p class="swal-estatus-local__hint">Elige el estado actual del pago</p>
        <div class="swal-estatus-local__options" role="listbox" aria-label="Estatus del pago">
          ${opciones}
        </div>
      </div>`;
  }

  private inicializarSelectorEstatusPagoSwal(): void {
    const popup = Swal.getPopup();
    const botones = popup?.querySelectorAll<HTMLButtonElement>('.swal-estatus-local__opt');
    if (!botones?.length) return;

    botones.forEach((btn) => {
      btn.addEventListener('click', () => {
        botones.forEach((b) => {
          b.classList.remove('swal-estatus-local__opt--active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('swal-estatus-local__opt--active');
        btn.setAttribute('aria-pressed', 'true');
      });
    });
  }

  private mensajeErrorHttp(err: unknown): string {
    const e = err as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (e?.error && typeof e.error === 'object' && typeof e.error.message === 'string') {
      return e.error.message;
    }
    if (typeof e?.error === 'string' && e.error) return e.error;
    if (typeof e?.message === 'string' && e.message) return e.message;
    return 'Ocurrió un error al enviar el pago. Intenta de nuevo.';
  }

  private indiceRawDesdeCursorEnInput(input: HTMLInputElement, cursor: number): number {
    return contarMontoSimbolosAntesCursor(input.value, cursor);
  }

  private puedeInsertarDigitoEnRaw(indice: number): boolean {
    const dot = this.pagoMontoRaw.indexOf('.');
    if (dot === -1) return true;
    if (indice <= dot) return true;
    return this.pagoMontoRaw.length - dot - 1 < 2;
  }

  private aplicarVistaMontoInput(input: HTMLInputElement, cursorEnRaw: number): void {
    const visible = formatearMonedaDesdeLimpia(this.pagoMontoRaw);
    input.value = visible;
    this.pagoForm.get('monto')?.setValue(this.pagoMontoRaw, { emitEvent: false });
    this.pagoForm.get('monto')?.updateValueAndValidity({ emitEvent: false });
    const pos = cursorMontoTrasFormato(
      visible,
      Math.max(0, Math.min(cursorEnRaw, this.pagoMontoRaw.length)),
    );
    requestAnimationFrame(() => input.setSelectionRange(pos, pos));
  }

  onMontoKeydown(ev: KeyboardEvent): void {
    const input = ev.target as HTMLInputElement | null;
    if (!input || !this.pagoForm) return;

    const nav = new Set([
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ]);
    if (nav.has(ev.key)) return;
    if (ev.ctrlKey || ev.metaKey) return;

    const cur = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? cur;
    const tieneSeleccion = cur !== end;

    if (ev.key === 'Backspace' || ev.key === 'Delete') {
      ev.preventDefault();
      if (tieneSeleccion) {
        const i0 = this.indiceRawDesdeCursorEnInput(input, Math.min(cur, end));
        const i1 = this.indiceRawDesdeCursorEnInput(input, Math.max(cur, end));
        this.pagoMontoRaw = this.pagoMontoRaw.slice(0, i0) + this.pagoMontoRaw.slice(i1);
        this.aplicarVistaMontoInput(input, i0);
        return;
      }
      if (ev.key === 'Backspace') {
        const idx = this.indiceRawDesdeCursorEnInput(input, cur);
        if (idx > 0) {
          this.pagoMontoRaw =
            this.pagoMontoRaw.slice(0, idx - 1) + this.pagoMontoRaw.slice(idx);
          this.aplicarVistaMontoInput(input, idx - 1);
        }
        return;
      }
      const idx = this.indiceRawDesdeCursorEnInput(input, cur);
      if (idx < this.pagoMontoRaw.length) {
        this.pagoMontoRaw =
          this.pagoMontoRaw.slice(0, idx) + this.pagoMontoRaw.slice(idx + 1);
        this.aplicarVistaMontoInput(input, idx);
      }
      return;
    }

    if (ev.key >= '0' && ev.key <= '9') {
      ev.preventDefault();
      if (tieneSeleccion) {
        const i0 = this.indiceRawDesdeCursorEnInput(input, Math.min(cur, end));
        const i1 = this.indiceRawDesdeCursorEnInput(input, Math.max(cur, end));
        if (!this.puedeInsertarDigitoEnRaw(i0)) return;
        const merged = this.pagoMontoRaw.slice(0, i0) + ev.key + this.pagoMontoRaw.slice(i1);
        this.pagoMontoRaw = extraerMontoRawDesdeDisplay(merged);
        this.aplicarVistaMontoInput(input, i0 + 1);
        return;
      }
      const idx = this.indiceRawDesdeCursorEnInput(input, cur);
      if (!this.puedeInsertarDigitoEnRaw(idx)) return;
      this.pagoMontoRaw =
        this.pagoMontoRaw.slice(0, idx) + ev.key + this.pagoMontoRaw.slice(idx);
      this.aplicarVistaMontoInput(input, idx + 1);
      return;
    }

    if (ev.key === '.' || ev.key === ',' || ev.key === 'Decimal') {
      ev.preventDefault();
      if (this.pagoMontoRaw.includes('.')) return;
      if (tieneSeleccion) {
        const i0 = this.indiceRawDesdeCursorEnInput(input, Math.min(cur, end));
        const i1 = this.indiceRawDesdeCursorEnInput(input, Math.max(cur, end));
        this.pagoMontoRaw =
          this.pagoMontoRaw.slice(0, i0) + '.' + this.pagoMontoRaw.slice(i1);
        this.aplicarVistaMontoInput(input, i0 + 1);
        return;
      }
      const idx = this.indiceRawDesdeCursorEnInput(input, cur);
      this.pagoMontoRaw =
        this.pagoMontoRaw.slice(0, idx) + '.' + this.pagoMontoRaw.slice(idx);
      this.aplicarVistaMontoInput(input, idx + 1);
      return;
    }

    ev.preventDefault();
  }

  onMontoPaste(ev: ClipboardEvent): void {
    ev.preventDefault();
    const input = ev.target as HTMLInputElement | null;
    if (!input || !this.pagoForm) return;

    const texto = ev.clipboardData?.getData('text') ?? '';
    const pegado = extraerMontoRawDesdeDisplay(texto);
    if (!pegado) return;

    const cur = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? cur;
    const i0 = this.indiceRawDesdeCursorEnInput(input, Math.min(cur, end));
    const i1 = this.indiceRawDesdeCursorEnInput(input, Math.max(cur, end));
    const merged = this.pagoMontoRaw.slice(0, i0) + pegado + this.pagoMontoRaw.slice(i1);
    this.pagoMontoRaw = extraerMontoRawDesdeDisplay(merged);
    this.aplicarVistaMontoInput(input, i0 + pegado.length);
  }

  onMontoBlur(): void {
    const input = this.pagoMontoInput?.nativeElement;
    const raw =
      this.pagoMontoRaw || String(this.pagoForm?.get('monto')?.value ?? '').trim();
    const n = parseMonedaNumerico(raw);
    if (!Number.isFinite(n)) {
      this.pagoMontoRaw = '';
      this.pagoForm?.get('monto')?.setValue('', { emitEvent: false });
      if (input) input.value = '';
      return;
    }
    this.pagoMontoRaw = String(n);
    this.pagoForm?.get('monto')?.setValue(this.pagoMontoRaw, { emitEvent: false });
    if (input) {
      input.value = formatMonedaDesdeNumero(n);
    }
  }
}
