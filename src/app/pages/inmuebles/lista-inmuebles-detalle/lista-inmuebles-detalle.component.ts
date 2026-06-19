import { HttpClient } from '@angular/common/http';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
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
  InmuebleZonaApi,
  contarLocalesInmueble,
  etiquetaEstatusLocal,
  localesDeZona,
  nombreArrendador,
  nombreServicio,
  OPCIONES_ESTATUS_LOCAL,
  urlFachadaLocal,
  urlPdfMiniatura,
} from '../inmuebles-list.mapper';

@Component({
  selector: 'app-lista-inmuebles-detalle',
  templateUrl: './lista-inmuebles-detalle.component.html',
  styleUrl: './lista-inmuebles-detalle.component.scss',
  standalone: false,
})
export class ListaInmueblesDetalleComponent implements OnInit, OnChanges {
  @Input({ required: true }) row!: InmuebleGridRow;

  /** Tras PATCH de estatus: el padre debe refrescar GET /inmuebles/paginated. */
  @Output() estatusLocalActualizado = new EventEmitter<void>();

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
  cargandoDetalleAnidado = false;
  private detallePorId: InmuebleApiItem | null = null;

  esImagenArchivo = esImagenArchivo;
  esPdfArchivo = esPdfArchivo;
  urlFachadaLocal = urlFachadaLocal;

  constructor(
    private sanitizer: DomSanitizer,
    private inmueblesService: InmueblesService,
    private toastr: ToastrService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.cargarDetalleCompletoPorId();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['row']) {
      this.detallePorId = null;
      this.cargarDetalleCompletoPorId();
    }
  }

  private cargarDetalleCompletoPorId(): void {
    const id = Number(this.row?.id);
    if (!Number.isFinite(id) || id <= 0) {
      this.detallePorId = this.row?.detalle ?? {};
      return;
    }

    this.cargandoDetalleAnidado = true;
    this.inmueblesService
      .obtenerInmueble(id)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          this.detallePorId = extraerInmuebleDetalleApi(resp);
          this.cargandoDetalleAnidado = false;
        },
        error: (err) => {
          console.error('Error al cargar detalle del inmueble:', err);
          this.detallePorId = this.row?.detalle ?? {};
          this.cargandoDetalleAnidado = false;
        },
      });
  }

  get item(): InmuebleApiItem {
    return this.detallePorId ?? this.row?.detalle ?? {};
  }

  get zonas() {
    return Array.isArray(this.item.zonas) ? this.item.zonas : [];
  }

  get zonasOrdenadas(): InmuebleZonaApi[] {
    return [...this.zonas].sort((a, b) => {
      const na = Number(a.numeroZona);
      const nb = Number(b.numeroZona);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {
        return na - nb;
      }
      const za = String(a.zonaPrincipal ?? '');
      const zb = String(b.zonaPrincipal ?? '');
      const cmp = za.localeCompare(zb, 'es');
      if (cmp !== 0) return cmp;
      return Number(a.id ?? 0) - Number(b.id ?? 0);
    });
  }

  get servicios() {
    return Array.isArray(this.item.servicios) ? this.item.servicios : [];
  }

  get archivos() {
    return Array.isArray(this.item.archivos) ? this.item.archivos : [];
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
    const q = this.filtroLocal.trim().toLowerCase();
    if (!q) return list;
    return list.filter((loc) => {
      const nom = String(loc.nombre ?? '').toLowerCase();
      const giro = String(loc.giro ?? '').toLowerCase();
      const est = etiquetaEstatusLocal(loc.estatus).toLowerCase();
      return nom.includes(q) || giro.includes(q) || est.includes(q);
    });
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
