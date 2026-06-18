import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { catchError, lastValueFrom, of } from 'rxjs';
import { finalize, take } from 'rxjs/operators';
import Swal from 'sweetalert2';
import {
  contractDimAnim,
  contractModalAnim,
  routeAnimation,
} from 'src/app/pipe/module-open.animation';
import {
  CatMetodoPagoItem,
  CatMetodosPagoService,
} from 'src/app/services/moduleService/cat-metodos-pago.service';
import { PagoArrendatarioService } from 'src/app/services/moduleService/pago-arrendatario.service';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import { DocumentoPreviewComponent } from 'src/app/shared/documento-preview/documento-preview.component';
import {
  contarMontoSimbolosAntesCursor,
  cursorMontoTrasFormato,
  extraerMontoRawDesdeDisplay,
  formatMonedaDesdeNumero,
  formatearMonedaDesdeLimpia,
  parseMonedaNumerico,
} from 'src/app/shared/valor-miles-format';
import {
  extraerMetaPaginadaRegistroServicios,
  mapRegistroServiciosPagosApi,
  rangoFechasRegistroPorDefecto,
  RegistroServicioPagoGridRow,
} from 'src/app/shared/registro-servicios-pagos/registro-servicios-pagos.mapper';
import {
  extraerFilasPaginadasApi,
  nombreArrendatarioDesdeApi,
  resolverIdArrendatarioApi,
} from '../../arrendatarios/arrendatarios-list.mapper';
import { esServicioArrendatarioExcluidoHub } from '../../arrendatarios/pagos-servicios/pago-servicio-actual-list.mapper';
import {
  extraerServiciosArrendatarioListaPago,
  ServicioArrendatarioListaPago,
} from '../../monitoreo/monitoreo-arrendatario-detalle.mapper';
import { urlPdfTarjetaInmueble } from '../../monitoreo/monitoreo-inmueble.mapper';
import {
  construirFormDataPagoArrendatario,
  extraerPagoDetalleApi,
  mapPagoApiToVistaDetalle,
  OPCIONES_ESTATUS_PAGO_API,
  PagoEstatusUi,
  VistaPagoDetalleModal,
} from '../../monitoreo/monitoreo-pagos.mapper';

interface SelectOpcion {
  id: number;
  label: string;
}

@Component({
  selector: 'app-lista-registro-servicios-arrendatarios',
  templateUrl: './lista-registro-servicios-arrendatarios.component.html',
  styleUrl: './lista-registro-servicios-arrendatarios.component.scss',
  standalone: false,
  animations: [routeAnimation, contractDimAnim, contractModalAnim],
})
export class ListaRegistroServiciosArrendatariosComponent implements OnInit {
  readonly etiquetaComprobanteFormatos = 'PDF · PNG · JPG';

  listaPagos!: InstanceType<typeof CustomStore>;
  showFilterRow = true;
  showHeaderFilter = true;
  loading = false;
  pageSize = 20;
  paginaActual = 1;
  totalRegistros = 0;
  totalPaginas = 0;
  paginaActualData: RegistroServicioPagoGridRow[] = [];
  filtroActivo = '';
  mensajeAgrupar =
    'Arrastre un encabezado de columna aquí para agrupar por dicha columna';

  fechaInicioFiltro = '';
  fechaFinFiltro = '';
  idArrendatarioFiltro: number | null = null;
  arrendatariosOpciones: SelectOpcion[] = [];
  catalogosFiltroCargando = false;

  listaCatMetodosPago: CatMetodoPagoItem[] = [];
  metodosPagoCargando = false;

  mostrarModalPago = false;
  pagoGuardando = false;
  pagoForm!: FormGroup;
  pagoMontoRaw = '';
  serviciosArrendatarioModalPago: ServicioArrendatarioListaPago[] = [];
  serviciosArrendatarioModalPagoCargando = false;

  mostrarModalDetalle = false;
  detalleModalCargando = false;
  detalleModalError: string | null = null;
  detallePagoVista: VistaPagoDetalleModal | null = null;

  @ViewChild('gridContainer', { static: false })
  dataGrid!: DxDataGridComponent;

  @ViewChild('docPreview', { static: false })
  docPreview?: DocumentoPreviewComponent;

  @ViewChild('pagoMontoInput', { static: false })
  pagoMontoInput?: ElementRef<HTMLInputElement>;

  @ViewChild('pagoComprobanteInput', { static: false })
  pagoComprobanteInput?: ElementRef<HTMLInputElement>;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private pagoArrendatarioService: PagoArrendatarioService,
    private arrendatariosService: ArrendatariosService,
    private catMetodosPagoService: CatMetodosPagoService,
  ) {}

  ngOnInit(): void {
    const rango = rangoFechasRegistroPorDefecto();
    this.fechaInicioFiltro = rango.inicio;
    this.fechaFinFiltro = rango.fin;
    this.initPagoForm();
    this.cargarCatalogoMetodosPago();
    this.cargarCatalogoArrendatarios();
    this.setupDataSource();
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

  private cargarCatalogoMetodosPago(): void {
    this.metodosPagoCargando = true;
    this.catMetodosPagoService.obtenerMetodosPagoPaginados(1, 100).subscribe({
      next: (res) => {
        const rows = Array.isArray((res as { data?: unknown })?.data)
          ? ((res as { data: CatMetodoPagoItem[] }).data)
          : Array.isArray(res)
            ? (res as CatMetodoPagoItem[])
            : [];
        this.listaCatMetodosPago = rows.filter(
          (m) => m.estatus == null || m.estatus === 1,
        );
        this.metodosPagoCargando = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.listaCatMetodosPago = [];
        this.metodosPagoCargando = false;
      },
    });
  }

  private cargarCatalogoArrendatarios(): void {
    this.catalogosFiltroCargando = true;
    void lastValueFrom(this.arrendatariosService.obtenerArrendatariosPaginated(1, 300))
      .then((resp) => {
        this.arrendatariosOpciones = extraerFilasPaginadasApi(resp)
          .map((r) => {
            const id = resolverIdArrendatarioApi(r);
            if (id == null) return null;
            const nombre = nombreArrendatarioDesdeApi(r);
            return { id, label: nombre || `Arrendatario #${id}` };
          })
          .filter((x): x is SelectOpcion => x != null);
      })
      .catch((err) => console.error('Error catálogo arrendatarios:', err))
      .finally(() => {
        this.catalogosFiltroCargando = false;
        this.cdr.markForCheck();
      });
  }

  private etiquetaCatMetodoPagoPorId(id: number): string {
    const hit = this.listaCatMetodosPago.find((m) => Number(m.id) === id);
    return String(hit?.nombre ?? '').trim();
  }

  setupDataSource(): void {
    this.loading = true;
    this.listaPagos = new CustomStore({
      key: 'id',
      load: async (loadOptions: { take?: number; skip?: number }) => {
        const take = Number(loadOptions?.take) || this.pageSize || 20;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;
        try {
          const resp = await lastValueFrom(
            this.pagoArrendatarioService.obtenerPagosPaginados({
              page,
              limit: take,
              fechaInicio: this.fechaInicioFiltro,
              fechaFin: this.fechaFinFiltro,
              idArrendatario: this.idArrendatarioFiltro,
            }),
          );
          this.loading = false;
          const meta = extraerMetaPaginadaRegistroServicios(resp);
          const dataTransformada = mapRegistroServiciosPagosApi(
            resp,
            'arrendatario',
            (idMet) => this.etiquetaCatMetodoPagoPorId(idMet),
          );
          this.totalRegistros = meta.total || dataTransformada.length;
          this.paginaActual = meta.page || page;
          this.totalPaginas = meta.lastPage || Math.max(1, Math.ceil(this.totalRegistros / take));
          this.paginaActualData = dataTransformada;
          return { data: dataTransformada, totalCount: this.totalRegistros };
        } catch (err) {
          this.loading = false;
          console.error('Error al cargar pagos de servicios del arrendatario:', err);
          return { data: [], totalCount: 0 };
        }
      },
    });
  }

  aplicarFiltros(): void {
    if (!this.fechaInicioFiltro?.trim() || !this.fechaFinFiltro?.trim()) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Fechas obligatorias',
        text: 'Indica fecha inicial y fecha final.',
        confirmButtonText: 'Entendido',
      });
      return;
    }
    if (this.fechaInicioFiltro > this.fechaFinFiltro) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Rango inválido',
        text: 'La fecha inicial no puede ser posterior a la final.',
        confirmButtonText: 'Entendido',
      });
      return;
    }
    this.dataGrid?.instance?.refresh();
  }

  limpiarVista(): void {
    const rango = rangoFechasRegistroPorDefecto();
    this.fechaInicioFiltro = rango.inicio;
    this.fechaFinFiltro = rango.fin;
    this.idArrendatarioFiltro = null;
    const inst = this.dataGrid?.instance;
    if (!inst) return;
    inst.clearFilter();
    inst.clearGrouping();
    inst.pageIndex(0);
    inst.option('searchPanel.text', '');
    this.filtroActivo = '';
    inst.refresh();
  }

  onPageIndexChanged(e: any): void {
    this.paginaActual = e.component.pageIndex() + 1;
    e.component.refresh();
  }

  onGridOptionChanged(e: any): void {
    if (e.fullName !== 'searchPanel.text') return;
    const grid = this.dataGrid?.instance;
    const texto = (e.value ?? '').toString().trim().toLowerCase();
    if (!texto) {
      this.filtroActivo = '';
      grid?.option('dataSource', this.listaPagos);
      return;
    }
    this.filtroActivo = texto;
    const dataFiltrada = (this.paginaActualData || []).filter((row) =>
      [
        row.concepto,
        row.entidadLabel,
        row.metodo,
        row.estatus,
        row.fechaPagoFmt,
        row.montoFmt,
      ].some((v) => String(v ?? '').toLowerCase().includes(texto)),
    );
    grid?.option('dataSource', dataFiltrada);
  }

  formatoMoneda(e: { value?: unknown }): string {
    if (!e?.value) return '$0.00';
    return (
      '$' +
      Number(e.value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  clasesEstatusPago(estatus: unknown): Record<string, boolean> {
    const e = String(estatus ?? '');
    return {
      'reg-srv-pago-estatus': true,
      'reg-srv-pago-estatus--pagado': e === 'Pagado',
      'reg-srv-pago-estatus--pendiente': e === 'Pendiente',
      'reg-srv-pago-estatus--cancelado': e === 'Cancelado',
    };
  }

  abrirModalDetalle(row: RegistroServicioPagoGridRow): void {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;
    this.mostrarModalDetalle = true;
    this.detallePagoVista = null;
    this.detalleModalError = null;
    this.detalleModalCargando = true;
    this.cdr.markForCheck();

    this.pagoArrendatarioService
      .obtenerPagoPorId(Math.floor(id))
      .pipe(
        take(1),
        finalize(() => {
          this.detalleModalCargando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          const item = extraerPagoDetalleApi(res);
          if (!item) {
            this.detalleModalError = 'No se encontró el pago.';
            return;
          }
          this.detallePagoVista = mapPagoApiToVistaDetalle(item, {
            resolverMetodo: (idMet) => this.etiquetaCatMetodoPagoPorId(idMet),
          });
          if (!this.detallePagoVista) {
            this.detalleModalError = 'No se pudo interpretar el pago.';
          }
        },
        error: () => {
          this.detalleModalError =
            'No se pudo cargar el pago. Verifique su conexión e intente de nuevo.';
        },
      });
  }

  cerrarModalDetalle(): void {
    this.mostrarModalDetalle = false;
    this.detalleModalCargando = false;
    this.detalleModalError = null;
    this.detallePagoVista = null;
    this.cdr.markForCheck();
  }

  verComprobanteDetalle(): void {
    const url = String(this.detallePagoVista?.urlComprobante ?? '').trim();
    if (!url) return;
    const titulo = this.detallePagoVista?.concepto ?? 'Comprobante';
    const previewUrl = urlPdfTarjetaInmueble(url, titulo) ?? url;
    this.docPreview?.abrir(previewUrl, titulo, 'Servicios arrendatarios');
  }

  async solicitarCambioEstatus(row: RegistroServicioPagoGridRow): Promise<void> {
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
    const nuevoEstatus = typeof nuevoRaw === 'number' ? nuevoRaw : Number(String(nuevoRaw));
    if (!Number.isFinite(nuevoEstatus) || nuevoEstatus === estatusInicial) return;

    this.pagoArrendatarioService
      .actualizarEstatus(Math.floor(id), { estatus: nuevoEstatus })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.dataGrid?.instance?.refresh();
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
          console.error(err);
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'error',
            title: 'No se pudo actualizar',
            text: 'Ocurrió un error al guardar el estatus.',
            confirmButtonText: 'Entendido',
          });
        },
      });
  }

  private estatusPagoNumericoApiDesdeEtiqueta(etiqueta: PagoEstatusUi): number {
    if (etiqueta === 'Pagado') return 1;
    if (etiqueta === 'Cancelado') return 0;
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
    const opciones = OPCIONES_ESTATUS_PAGO_API.map((op) => {
      const activa = op.value === estatusSeleccionado ? ' swal-estatus-local__opt--active' : '';
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

  abrirModalPago(): void {
    this.cargarCatalogoMetodosPago();
    this.mostrarModalPago = true;
    this.pagoMontoRaw = '';
    this.serviciosArrendatarioModalPago = [];
    const idArrendatarioInicial = this.idArrendatarioFiltro;
    this.pagoForm.reset({
      idArrendatario: idArrendatarioInicial,
      idServicioArrendatario: null,
      concepto: '',
      fechaPago: '',
      monto: '',
      idMetodoPago: null,
      estatus: 'Pendiente' as PagoEstatusUi,
      comprobantePago: null,
      comprobantePagoNombre: '',
    });
    if (idArrendatarioInicial != null) {
      this.cargarServiciosParaModalPago(idArrendatarioInicial);
    }
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
          this.dataGrid?.instance?.refresh();
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

  etiquetaCatMetodoPago(item: CatMetodoPagoItem): string {
    const nombre = item.nombre;
    if (nombre != null && String(nombre).trim() !== '') return String(nombre).trim();
    return `Método ${item.id}`;
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
