import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastrService } from 'ngx-toastr';
import { take } from 'rxjs';
import Swal from 'sweetalert2';
import { DocumentoPreviewComponent } from 'src/app/shared/documento-preview/documento-preview.component';
import { InmueblesService } from 'src/app/services/moduleService/inmuebles.service';
import {
  claseChipEstatusLocal,
  esImagenArchivo,
  esPdfArchivo,
  extraerInmuebleDetalleApi,
  formatearFecha,
  formatearMoneda,
  InmuebleApiItem,
  InmuebleGridRow,
  InmuebleLocalApi,
  InmuebleServicioApi,
  InmuebleZonaApi,
  contarLocalesInmueble,
  etiquetaEstatusLocal,
  localesDeZona,
  nombreArrendador,
  nombreServicio,
  esServicioRentaOMantenimiento,
  OPCIONES_ESTATUS_LOCAL,
  resolverGiroLocalApi,
  urlFachadaLocal,
  urlPdfMiniatura,
  zonaInmuebleActiva,
  archivoInmuebleActivo,
  servicioInmuebleActivo,
  esArchivoGaleriaInmuebleEliminable,
} from '../inmuebles-list.mapper';

@Component({
  selector: 'app-lista-inmuebles-detalle',
  templateUrl: './lista-inmuebles-detalle.component.html',
  styleUrl: './lista-inmuebles-detalle.component.scss',
  standalone: false,
})
export class ListaInmueblesDetalleComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) row!: InmuebleGridRow;

  /** Tras PATCH de estatus o DELETE de hijos: el padre debe refrescar el listado. */
  @Output() estatusLocalActualizado = new EventEmitter<void>();
  @Output() detalleModificado = new EventEmitter<void>();

  @ViewChild('docPreview') docPreview?: DocumentoPreviewComponent;

  private readonly swalToastDescargaError = Swal.mixin({
    toast: true,
    position: 'top-end',
    icon: 'error',
    showConfirmButton: false,
    timer: 5200,
    timerProgressBar: true,
    background: '#141a21',
    color: '#ffffff',
  });

  detalleTab = 0;
  filtroLocal = '';
  guardandoEstatusLocalId: number | null = null;
  eliminandoId: number | null = null;
  cargandoDetalleAnidado = false;
  cargandoTabPanel = false;
  private detallePorId: InmuebleApiItem | null = null;
  private tabLoadTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly tabLoadDelayMs = 300;

  esImagenArchivo = esImagenArchivo;
  esPdfArchivo = esPdfArchivo;
  urlFachadaLocal = urlFachadaLocal;

  /** Locales cuya URL de fachada falló al cargar. */
  private readonly fotosLocalesRotas = new Set<string>();

  constructor(
    private sanitizer: DomSanitizer,
    private inmueblesService: InmueblesService,
    private toastr: ToastrService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargarDetalleCompletoPorId();
  }

  fotoLocalRota(loc: InmuebleLocalApi): boolean {
    return this.fotosLocalesRotas.has(this.claveFotoLocal(loc));
  }

  onErrorFotoLocal(loc: InmuebleLocalApi): void {
    this.fotosLocalesRotas.add(this.claveFotoLocal(loc));
    this.cdr.markForCheck();
  }

  private claveFotoLocal(loc: InmuebleLocalApi): string {
    const id = Number(loc.id);
    if (Number.isFinite(id) && id > 0) return `loc-${Math.trunc(id)}`;
    return `loc-${String(loc.nombre ?? '')}`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['row']) {
      const prev = changes['row'].previousValue as InmuebleGridRow | undefined;
      const curr = changes['row'].currentValue as InmuebleGridRow | undefined;
      const mismoId =
        prev != null &&
        curr != null &&
        Number(prev.id) === Number(curr.id) &&
        Number.isFinite(Number(curr.id));
      // Misma fila tras refresh: no vaciar detalle (evita que reaparezcan soft-deletes).
      if (!mismoId) {
        this.detallePorId = null;
        this.detalleTab = 0;
        this.fotosLocalesRotas.clear();
      }
      this.cargarDetalleCompletoPorId();
    }
  }

  ngOnDestroy(): void {
    this.limpiarTimerTab();
  }

  get mostrarCargaPanel(): boolean {
    return this.cargandoDetalleAnidado || this.cargandoTabPanel;
  }

  get mensajeCargaPanel(): string {
    switch (this.detalleTab) {
      case 1:
        return 'Cargando servicios…';
      case 2:
        return 'Cargando documentos…';
      default:
        return 'Cargando zonas y locales…';
    }
  }

  cambiarTab(index: number): void {
    if (this.detalleTab === index && !this.mostrarCargaPanel) return;

    this.limpiarTimerTab();
    this.detalleTab = index;

    if (this.cargandoDetalleAnidado) return;

    this.iniciarCargaTabPanel();
  }

  tabEstaCargando(index: number): boolean {
    return this.mostrarCargaPanel && this.detalleTab === index;
  }

  private iniciarCargaTabPanel(): void {
    this.cargandoTabPanel = true;
    this.tabLoadTimer = setTimeout(() => {
      this.cargandoTabPanel = false;
      this.tabLoadTimer = null;
    }, this.tabLoadDelayMs);
  }

  private limpiarTimerTab(): void {
    if (this.tabLoadTimer != null) {
      clearTimeout(this.tabLoadTimer);
      this.tabLoadTimer = null;
    }
    this.cargandoTabPanel = false;
  }

  private cargarDetalleCompletoPorId(): void {
    const id = Number(this.row?.id);
    if (!Number.isFinite(id) || id <= 0) {
      this.detallePorId = this.row?.detalle ?? {};
      return;
    }

    this.limpiarTimerTab();
    this.cargandoDetalleAnidado = true;
    this.inmueblesService
      .obtenerInmueble(id)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          this.detallePorId = extraerInmuebleDetalleApi(resp);
          this.cargandoDetalleAnidado = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error al cargar detalle del inmueble:', err);
          this.detallePorId = this.row?.detalle ?? {};
          this.cargandoDetalleAnidado = false;
          this.cdr.markForCheck();
        },
      });
  }

  get item(): InmuebleApiItem {
    return this.detallePorId ?? this.row?.detalle ?? {};
  }

  get zonas() {
    const so = Array.isArray(this.item.zonas) ? this.item.zonas : [];
    return so.filter(zonaInmuebleActiva);
  }

  get zonasOrdenadas(): InmuebleZonaApi[] {
    return [...this.zonas].sort((a, b) => {
      const ida = Number(a.id ?? 0);
      const idb = Number(b.id ?? 0);
      if (Number.isFinite(ida) && Number.isFinite(idb) && ida !== idb) {
        return idb - ida;
      }
      const na = Number(a.numeroZona);
      const nb = Number(b.numeroZona);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {
        return nb - na;
      }
      return String(b.zonaPrincipal ?? '').localeCompare(String(a.zonaPrincipal ?? ''), 'es');
    });
  }

  get servicios() {
    const lista = Array.isArray(this.item.servicios) ? this.item.servicios : [];
    return lista.filter(servicioInmuebleActivo);
  }

  get archivos() {
    const lista = Array.isArray(this.item.archivos) ? this.item.archivos : [];
    return lista.filter(archivoInmuebleActivo);
  }

  nombreArrendador = nombreArrendador;
  nombreServicio = nombreServicio;
  formatearFecha = formatearFecha;
  formatearMoneda = formatearMoneda;
  localesDeZona = localesDeZona;
  etiquetaEstatusLocal = etiquetaEstatusLocal;
  claseChipEstatusLocal = claseChipEstatusLocal;

  totalLocales(): number {
    return contarLocalesInmueble(this.item);
  }

  localesZona(z: InmuebleZonaApi): InmuebleLocalApi[] {
    const list = localesDeZona(z);
    const q = this.filtroLocal.trim();
    if (!q) return list;
    return list.filter((loc) => this.localCoincideConFiltro(loc, q));
  }

  private localCoincideConFiltro(loc: InmuebleLocalApi, filtro: string): boolean {
    const q = this.normalizarTextoBusqueda(filtro);
    if (!q) return true;

    const tokens = this.tokensBusquedaLocal(loc).map((t) =>
      this.normalizarTextoBusqueda(t),
    );
    if (tokens.some((t) => t.includes(q))) return true;

    const qMonto = this.normalizarMontoBusqueda(filtro);
    if (qMonto && tokens.some((t) => this.normalizarMontoBusqueda(t).includes(qMonto))) {
      return true;
    }

    const qDigitos = this.soloDigitos(filtro);
    if (qDigitos.length >= 2) {
      return tokens.some((t) => this.soloDigitos(t).includes(qDigitos));
    }

    return false;
  }

  private normalizarTextoBusqueda(val: string): string {
    return val
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
  }

  private tokensBusquedaLocal(loc: InmuebleLocalApi): string[] {
    const out: string[] = [];
    const push = (v: unknown): void => {
      const s = String(v ?? '').trim();
      if (s) out.push(s);
    };
    const pushMonto = (monto: number | null): void => {
      if (monto == null || !Number.isFinite(monto)) return;
      push(monto);
      const fmt = formatearMoneda(monto);
      if (fmt !== '—') {
        out.push(fmt);
        out.push(fmt.replace(/\$/g, '').trim());
      }
    };

    push(loc.nombre);
    push(resolverGiroLocalApi(loc) ?? loc.giro);
    push(etiquetaEstatusLocal(loc.estatus));
    pushMonto(this.rentaLocal(loc));
    pushMonto(this.mantenimientoLocal(loc));
    pushMonto(this.totalLocal(loc));

    return out;
  }

  /** Si llega `mensualidadIva`, el IVA aplica a renta y mantenimiento. */
  private aplicaIvaLocal(loc: InmuebleLocalApi): boolean {
    return loc.mensualidadIva != null && String(loc.mensualidadIva).trim() !== '';
  }

  private parsearMontoLocal(val: unknown): number | null {
    if (val == null || String(val).trim() === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }

  /** Renta: con IVA → mensualidadIva; sin IVA → mensualidad. */
  rentaLocal(loc: InmuebleLocalApi): number | null {
    if (this.aplicaIvaLocal(loc)) {
      return this.parsearMontoLocal(loc.mensualidadIva);
    }
    return this.parsearMontoLocal(loc.mensualidad);
  }

  /**
   * Mantenimiento: con IVA → mantenimientoIva (o 0);
   * sin IVA → mantenimiento (o 0 si llega null).
   */
  mantenimientoLocal(loc: InmuebleLocalApi): number {
    if (this.aplicaIvaLocal(loc)) {
      return this.parsearMontoLocal(loc.mantenimientoIva) ?? 0;
    }
    return this.parsearMontoLocal(loc.mantenimiento) ?? 0;
  }

  totalLocal(loc: InmuebleLocalApi): number {
    return (this.rentaLocal(loc) ?? 0) + this.mantenimientoLocal(loc);
  }

  formatearMonedaRentaLocal(loc: InmuebleLocalApi): string {
    return formatearMoneda(this.rentaLocal(loc));
  }

  private normalizarMontoBusqueda(val: string): string {
    return val.trim().toLowerCase().replace(/[^\d.,]/g, '');
  }

  private soloDigitos(val: string): string {
    return val.replace(/\D/g, '');
  }

  totalLocalesVisibles(): number {
    return this.zonasOrdenadas.reduce(
      (s, z) => s + this.localesZona(z).length,
      0,
    );
  }

  zonaTieneLocalesVisibles(z: InmuebleZonaApi): boolean {
    return this.localesZona(z).length > 0;
  }

  superficieTotalZonas(): number {
    return this.zonas.reduce((s, z) => s + (Number(z.superficieZonaM2) || 0), 0);
  }

  superficieDisponibleTotal(): number {
    return this.zonas.reduce(
      (s, z) => s + (Number(z.superficieDisponibleM2) || 0),
      0,
    );
  }

  estaGuardandoEstatusLocal(loc: InmuebleLocalApi): boolean {
    const id = Number(loc.id);
    return (
      this.guardandoEstatusLocalId != null &&
      Number.isFinite(id) &&
      this.guardandoEstatusLocalId === id
    );
  }

  async cambiarEstatusLocal(loc: InmuebleLocalApi, event?: Event): Promise<void> {
    event?.stopPropagation();
    event?.preventDefault();

    const idLocal = Number(loc.id);
    if (!Number.isFinite(idLocal) || idLocal <= 0) {
      this.toastr.warning('Local sin identificador válido.', 'Inmuebles');
      return;
    }

    const estatusActual = Number(loc.estatus);
    const estatusInicial = Number.isFinite(estatusActual) ? estatusActual : 1;
    const nombreLocal = String(loc.nombre ?? 'Local').trim() || 'Local';

    const result = await Swal.fire({
      title: '¡Actualizar Estado Del Local!',
      html: this.htmlModalEstatusLocal(nombreLocal, estatusInicial),
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      customClass: { popup: 'swal-estatus-local' },
      didOpen: () => this.inicializarSelectorEstatusLocalSwal(),
      preConfirm: () => {
        const activo = Swal.getPopup()?.querySelector(
          '.swal-estatus-local__opt--active',
        );
        const val = activo?.getAttribute('data-value');
        if (val == null || val === '') {
          Swal.showValidationMessage('Selecciona un estado para el local.');
          return false;
        }
        return val;
      },
    });

    if (!result.isConfirmed || result.value == null || result.value === '') {
      return;
    }

    const nuevoEstatus = Number(result.value);
    if (!Number.isFinite(nuevoEstatus) || nuevoEstatus < 0 || nuevoEstatus > 3) {
      return;
    }

    if (nuevoEstatus === estatusActual) {
      return;
    }

    this.guardandoEstatusLocalId = idLocal;
    this.inmueblesService.actualizarEstatusLocal(idLocal, nuevoEstatus).subscribe({
      next: () => {
        this.guardandoEstatusLocalId = null;
        this.toastr.success(
          `Estado actualizado a ${etiquetaEstatusLocal(nuevoEstatus)}.`,
          'Local',
        );
        this.estatusLocalActualizado.emit();
      },
      error: (err) => {
        this.guardandoEstatusLocalId = null;
        console.error('Error al actualizar estatus del local:', err);
        this.toastr.error(
          'No se pudo actualizar el estatus del local.',
          'Inmuebles',
        );
      },
    });
  }

  idEntidad(raw: unknown): number | null {
    if (raw == null || typeof raw !== 'object') return null;
    const id = Number((raw as { id?: unknown }).id);
    return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
  }

  puedeEliminarArchivo(a: { id?: number; nombre?: string; url?: string }): boolean {
    return this.idEntidad(a) != null && esArchivoGaleriaInmuebleEliminable(a);
  }

  puedeEliminarServicioDetalle(s: InmuebleServicioApi | { id?: number }): boolean {
    if (this.idEntidad(s) == null) return false;
    return !esServicioRentaOMantenimiento(s as InmuebleServicioApi);
  }

  eliminarServicioDetalle(s: { id?: number; numeroContrato?: string }, ev?: Event): void {
    ev?.preventDefault();
    ev?.stopPropagation();
    if (!this.puedeEliminarServicioDetalle(s)) return;
    const id = this.idEntidad(s);
    if (id == null || this.eliminandoId != null) return;
    const nombre = this.nombreServicio(s as never);
    void Swal.fire({
      title: '¡Eliminar Servicio!',
      html: `¿Está seguro que requiere eliminar el servicio: <strong>${nombre}</strong>?`,
      icon: 'warning',
      background: '#141a21',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.isConfirmed && !result.value) return;
      this.eliminandoId = id;
      this.inmueblesService.eliminarServicioInmueble(id).subscribe({
        next: () => {
          this.eliminandoId = null;
          this.quitarServicioDeDetalleLocal(id);
          this.cargarDetalleCompletoPorId();
          this.detalleModificado.emit();
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Eliminado!',
            html: 'El servicio ha sido eliminado de forma exitosa.',
            icon: 'success',
            showCancelButton: false,
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
          });
        },
        error: () => {
          this.eliminandoId = null;
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Ops!',
            html: 'Error al intentar eliminar el servicio.',
            icon: 'error',
            showCancelButton: false,
          });
        },
      });
    });
  }

  eliminarZonaDetalle(z: InmuebleZonaApi, ev?: Event): void {
    ev?.preventDefault();
    ev?.stopPropagation();
    const id = this.idEntidad(z);
    if (id == null || this.eliminandoId != null) return;
    const nombre = String(z.zonaPrincipal ?? '').trim() || `Zona ${z.numeroZona ?? id}`;
    void Swal.fire({
      title: '¡Eliminar Zona!',
      html: `¿Está seguro que requiere eliminar la zona: <strong>${nombre}</strong>?`,
      icon: 'warning',
      background: '#141a21',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.isConfirmed && !result.value) return;
      this.eliminandoId = id;
      this.inmueblesService.eliminarZonaInmueble(id).subscribe({
        next: () => {
          this.eliminandoId = null;
          this.quitarZonaDeDetalleLocal(id);
          this.cargarDetalleCompletoPorId();
          this.detalleModificado.emit();
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Eliminado!',
            html: 'La zona ha sido eliminada de forma exitosa.',
            icon: 'success',
            showCancelButton: false,
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
          });
        },
        error: () => {
          this.eliminandoId = null;
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Ops!',
            html: 'Error al intentar eliminar la zona.',
            icon: 'error',
            showCancelButton: false,
          });
        },
      });
    });
  }

  private quitarServicioDeDetalleLocal(id: number): void {
    const base = { ...(this.detallePorId ?? this.row?.detalle ?? {}) } as InmuebleApiItem;
    const servicios = (Array.isArray(base.servicios) ? base.servicios : []).filter((s) => {
      const sid = Number(s.id ?? s.idServicioInmueble);
      return !(Number.isFinite(sid) && sid === id);
    });
    this.detallePorId = { ...base, servicios };
    this.cdr.markForCheck();
  }

  private quitarZonaDeDetalleLocal(id: number): void {
    const base = { ...(this.detallePorId ?? this.row?.detalle ?? {}) } as InmuebleApiItem;
    const zonas = (Array.isArray(base.zonas) ? base.zonas : []).filter((z) => {
      const zid = Number(z.id);
      return !(Number.isFinite(zid) && zid === id);
    });
    this.detallePorId = { ...base, zonas };
    this.cdr.markForCheck();
  }

  eliminarArchivoDetalle(a: { id?: number; nombre?: string; url?: string }, ev?: Event): void {
    ev?.preventDefault();
    ev?.stopPropagation();
    if (!this.puedeEliminarArchivo(a)) return;
    const id = this.idEntidad(a);
    if (id == null || this.eliminandoId != null) return;
    const nombre = String(a.nombre ?? '').trim() || 'Documento';
    void Swal.fire({
      title: '¡Eliminar Archivo!',
      html: `¿Está seguro que requiere eliminar el archivo: <strong>${nombre}</strong>?`,
      icon: 'warning',
      background: '#141a21',
      color: '#ffffff',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.isConfirmed && !result.value) return;
      this.eliminandoId = id;
      this.inmueblesService.eliminarArchivoInmueble(id).subscribe({
        next: () => {
          this.eliminandoId = null;
          this.cargarDetalleCompletoPorId();
          this.detalleModificado.emit();
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Eliminado!',
            html: 'El archivo ha sido eliminado de forma exitosa.',
            icon: 'success',
            showCancelButton: false,
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Confirmar',
          });
        },
        error: () => {
          this.eliminandoId = null;
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            title: '¡Ops!',
            html: 'Error al intentar eliminar el archivo.',
            icon: 'error',
            showCancelButton: false,
          });
        },
      });
    });
  }

  private escapeHtmlSwal(texto: string): string {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private htmlModalEstatusLocal(
    nombreLocal: string,
    estatusSeleccionado: number,
  ): string {
    const nombre = this.escapeHtmlSwal(nombreLocal);
    const opciones = OPCIONES_ESTATUS_LOCAL.map((op) => {
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
        <p class="swal-estatus-local__local">Local seleccionado: <strong>${nombre}</strong></p>
        <p class="swal-estatus-local__hint">Elige el nuevo estado</p>
        <div class="swal-estatus-local__options" role="listbox" aria-label="Estado del local">
          ${opciones}
        </div>
      </div>`;
  }

  private inicializarSelectorEstatusLocalSwal(): void {
    const popup = Swal.getPopup();
    const botones = popup?.querySelectorAll<HTMLButtonElement>(
      '.swal-estatus-local__opt',
    );
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

  urlVistaPreviaPdf(url?: string): SafeResourceUrl | null {
    if (!url?.trim() || !esPdfArchivo(url)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(urlPdfMiniatura(url));
  }

  /** Miniatura iframe para comprobantes no imagen (PDF u otros archivos embebibles). */
  urlVistaPreviaComprobante(url?: string): SafeResourceUrl | null {
    if (!url?.trim() || esImagenArchivo(url)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(urlPdfMiniatura(url));
  }

  iconoArchivo(url: string, nombre: string): string {
    if (esImagenArchivo(url, nombre)) return 'fa-file-image-o';
    if (esPdfArchivo(url, nombre)) return 'fa-file-pdf-o';
    return 'fa-file-o';
  }

  abrirDocumento(url: string | undefined, nombre: string): void {
    if (!url?.trim()) return;
    this.docPreview?.abrir(url, nombre, this.row.inmueble);
  }

  descargarDocumento(
    url: string | undefined,
    nombreFallback: string,
    ev?: Event,
  ): void {
    ev?.preventDefault();
    ev?.stopPropagation();
    const urlTrim = url?.trim();
    if (!urlTrim) return;
    const nombre = this.nombreParaDescarga(urlTrim, nombreFallback);
    this.http
      .get(urlTrim, { responseType: 'blob' })
      .pipe(take(1))
      .subscribe({
        next: (blob) => {
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = nombre;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(objectUrl);
        },
        error: () => {
          void this.swalToastDescargaError.fire({
            title: 'No se pudo descargar',
            text: 'No se obtuvo el archivo. Verifica la URL o el acceso al almacenamiento.',
          });
        },
      });
  }

  private nombreParaDescarga(url: string, fallback: string): string {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return decodeURIComponent(last);
    } catch {
      const seg = url.split('/').pop()?.split('?')[0]?.split('#')[0] ?? '';
      if (seg && seg.includes('.')) return decodeURIComponent(seg);
    }
    const ext = url.match(/\.(pdf|png|jpe?g|gif|webp|jfif)(\?|$|#)/i);
    if (ext) return `${fallback}.${ext[1].toLowerCase()}`;
    return fallback;
  }
}
