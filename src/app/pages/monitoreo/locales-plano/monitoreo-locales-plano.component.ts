import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { AuthenticationService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';
import {
  FiltroEstadoMesa,
  LocalesPlanoContext,
  MesaCatalogo,
  MesaDragPayload,
  MesaEnZonaPersist,
  MesaSinZonaPersist,
  PlanoLayoutJson,
  ZonaVm,
} from './pos-locales.models';
import { LayoutRepositoryService } from './layout-repository.service';
import { SyncDragDropLayoutService } from './sync-drag-drop-layout.service';

const ZONA_HEADER = 32;
const MESA_DEF_ANCHO = 56;
const MESA_DEF_ALTO = 56;
const DRAG_THRESHOLD = 6;
const ZOOM_STEP = 1.25;

@Component({
  selector: 'app-monitoreo-locales-plano',
  templateUrl: './monitoreo-locales-plano.component.html',
  styleUrls: ['./monitoreo-locales-plano.component.scss'],
  standalone: false,
})
export class MonitoreoLocalesPlanoComponent
  implements OnInit, OnChanges, AfterViewInit, OnDestroy
{
  @Input() context: LocalesPlanoContext | null = null;
  @Output() cerrar = new EventEmitter<void>();
  @Output() pedirComanda = new EventEmitter<number[]>();

  @ViewChild('planoScroll', { static: false })
  planoScroll?: ElementRef<HTMLDivElement>;

  readonly ZONA_HEADER = ZONA_HEADER;
  private mesaTamanoW = MESA_DEF_ANCHO;
  private mesaTamanoH = MESA_DEF_ALTO;

  mesasCatalogo: MesaCatalogo[] = [];
  idSucursal = 0;
  nombreSucursal = '';

  zonas: ZonaVm[] = [];
  mesasSinZona: MesaSinZonaPersist[] = [];
  contenidoAncho = 1600;
  contenidoAlto = 1000;
  planoZoom = 1;

  filtroEstado: FiltroEstadoMesa = 'TODOS';
  /** '__all__' | '__sz__' | zona.id */
  tabZonaActiva: string | number = '__all__';

  selectedIds = new Set<number>();
  mesaSeleccionada: MesaCatalogo | null = null;

  pin = '';
  readonly pinMax = 6;
  nombreMeseroSesion = '';

  idUsuarioLog: number | string | null = null;

  loading = true;
  saveState: 'idle' | 'saving' | 'ok' | 'error' = 'idle';
  private saveOkTimer?: ReturnType<typeof setTimeout>;

  pendingZonaNueva: ZonaVm | null = null;
  private nextZonaTempId = -1;

  private panActive = false;
  private panDidMove = false;
  private panStartX = 0;
  private panStartY = 0;
  private panStartSl = 0;
  private panStartSt = 0;
  private rafPan?: number;

  private mesaDragActive: {
    idMesa: number;
    zonaId: number | null;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null = null;

  private resizeActive: {
    zona: ZonaVm;
    handle: string;
    startX: number;
    startY: number;
    orig: Pick<ZonaVm, 'x' | 'y' | 'w' | 'h'>;
  } | null = null;

  private zonaHeaderDrag: { zona: ZonaVm; sx: number; sy: number; ox: number; oy: number } | null =
    null;

  private wheelHandler = (e: WheelEvent) => this.onDocumentWheel(e);
  private pointerMoveHandler = (e: PointerEvent) => this.onWindowPointerMove(e);
  private pointerUpHandler = (e: PointerEvent) => this.onWindowPointerUp(e);

  constructor(
    private layoutRepo: LayoutRepositoryService,
    private syncLayout: SyncDragDropLayoutService,
    private auth: AuthenticationService,
  ) {}

  ngOnInit(): void {
    const u = this.auth.getUser();
    this.idUsuarioLog = u?.id != null ? u.id : null;
    const nom = [u?.nombre, u?.apellidoPaterno].filter(Boolean).join(' ').trim();
    this.nombreMeseroSesion = nom || u?.userName || 'Usuario';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['context'] && this.context) {
      this.applyContext();
    }
  }

  ngAfterViewInit(): void {
    document.addEventListener('wheel', this.wheelHandler, { passive: false, capture: true });
    window.addEventListener('pointermove', this.pointerMoveHandler);
    window.addEventListener('pointerup', this.pointerUpHandler);
    window.addEventListener('pointercancel', this.pointerUpHandler);
  }

  ngOnDestroy(): void {
    document.removeEventListener('wheel', this.wheelHandler, { capture: true } as any);
    window.removeEventListener('pointermove', this.pointerMoveHandler);
    window.removeEventListener('pointerup', this.pointerUpHandler);
    window.removeEventListener('pointercancel', this.pointerUpHandler);
    this.syncLayout.cancelPending();
    if (this.saveOkTimer) clearTimeout(this.saveOkTimer);
    if (this.rafPan) cancelAnimationFrame(this.rafPan);
  }

  private applyContext(): void {
    if (!this.context) return;
    this.idSucursal = this.context.idSucursal || 0;
    this.nombreSucursal = this.context.nombreSucursal || 'Sucursal';
    this.mesasCatalogo = [...(this.context.mesas || [])];
    this.loadLayout();
  }

  private loadLayout(): void {
    this.loading = true;
    this.layoutRepo.getLayout(this.idSucursal).subscribe({
      next: (layout) => {
        this.hydrateFromLayout(layout);
        this.syncLayout.setLastGoodState(this.construirJsonPlano());
        this.loading = false;
      },
      error: () => {
        this.hydrateFromLayout({
          zonas: [],
          mesasSinZona: [],
          ancho: 1600,
          alto: 1000,
          zoom: 1,
          mesaTamano: { ancho: MESA_DEF_ANCHO, alto: MESA_DEF_ALTO },
        });
        this.loading = false;
      },
    });
  }

  private hydrateFromLayout(L: PlanoLayoutJson): void {
    this.zonas = (L.zonas || []).map((z) => ({ ...z, mesas: [...(z.mesas || [])] }));
    this.mesasSinZona = [...(L.mesasSinZona || [])];
    this.contenidoAncho = L.ancho || 1600;
    this.contenidoAlto = L.alto || 1000;
    this.planoZoom =
      typeof L.zoom === 'number' && L.zoom >= 0.1 && L.zoom <= 10 ? L.zoom : 1;
    if (L.mesaTamano?.ancho) this.mesaTamanoW = L.mesaTamano.ancho;
    if (L.mesaTamano?.alto) this.mesaTamanoH = L.mesaTamano.alto;
  }

  get mesaAnchoUi(): number {
    return this.mesaTamanoW;
  }
  get mesaAltoUi(): number {
    return this.mesaTamanoH;
  }

  get idsEnPlano(): Set<number> {
    const s = new Set<number>();
    for (const z of this.zonas) {
      for (const m of z.mesas) s.add(m.idMesa);
    }
    for (const m of this.mesasSinZona) s.add(m.idMesa);
    return s;
  }

  getZonaTabList(): { key: string | number; label: string }[] {
    const tabs: { key: string | number; label: string }[] = [
      { key: '__all__', label: 'Todas' },
    ];
    for (const z of this.zonas) {
      tabs.push({ key: z.id, label: z.nombre });
    }
    tabs.push({ key: '__sz__', label: 'Sin zona' });
    return tabs;
  }

  getZonaDeMesaEnDiagrama(idMesa: number): ZonaVm | null {
    for (const z of this.zonas) {
      for (const m of z.mesas) {
        if (m.idMesa !== idMesa) continue;
        const cx = z.x + m.x + this.mesaAnchoUi / 2;
        const cy = z.y + ZONA_HEADER + m.y + this.mesaAltoUi / 2;
        const bodyTop = z.y + ZONA_HEADER;
        const bodyBottom = z.y + z.h;
        const bodyLeft = z.x;
        const bodyRight = z.x + z.w;
        if (
          cx >= bodyLeft &&
          cx <= bodyRight &&
          cy >= bodyTop &&
          cy <= bodyBottom
        ) {
          return z;
        }
      }
    }
    return null;
  }

  mesaEnFiltro(m: MesaCatalogo): boolean {
    if (this.filtroEstado === 'TODOS') return true;
    if (this.filtroEstado === 'VACIOS') return m.estado === 'vacío';
    if (this.filtroEstado === 'OCUPADOS') return m.estado === 'ocupado';
    if (this.filtroEstado === 'EN_PAGO') return m.estado === 'en_pago';
    return true;
  }

  mesaEnTabZona(m: MesaCatalogo): boolean {
    if (this.tabZonaActiva === '__all__') return true;
    if (this.tabZonaActiva === '__sz__') {
      return this.mesasSinZona.some((s) => s.idMesa === m.id);
    }
    const zid = this.tabZonaActiva;
    const z = this.zonas.find((x) => x.id === zid);
    if (!z) return true;
    return z.mesas.some((mm) => mm.idMesa === m.id);
  }

  get mesasListaFiltradas(): MesaCatalogo[] {
    return this.mesasCatalogo.filter(
      (m) => this.mesaEnFiltro(m) && this.mesaEnTabZona(m),
    );
  }

  puedeSeleccionar(m: MesaCatalogo): boolean {
    if (m.idPersonal == null) return true;
    return String(m.idPersonal) === String(this.idUsuarioLog);
  }

  toggleSeleccionMesa(m: MesaCatalogo, ev?: Event): void {
    if (!this.puedeSeleccionar(m)) {
      Swal.fire({
        title: 'Mesa no disponible',
        text: 'Asignada a otro usuario.',
        icon: 'info',
        background: '#141a21',
        color: '#fff',
      });
      return;
    }
    if (this.selectedIds.has(m.id)) this.selectedIds.delete(m.id);
    else this.selectedIds.add(m.id);
    this.syncMesaSeleccionadaLegacy();
    this.scrollToMesaCard(m.id);
  }

  private syncMesaSeleccionadaLegacy(): void {
    if (this.selectedIds.size === 1) {
      const id = [...this.selectedIds][0];
      this.mesaSeleccionada = this.mesasCatalogo.find((x) => x.id === id) ?? null;
    } else {
      this.mesaSeleccionada = null;
    }
  }

  isSelected(id: number): boolean {
    return this.selectedIds.has(id);
  }

  private scrollToMesaCard(id: number): void {
    const el = document.getElementById(`mesa-card-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  mesaLineaMesero(m: MesaCatalogo): string {
    if (this.isSelected(m.id)) return this.nombreMeseroSesion;
    return m.meseroNombre || '—';
  }

  onMesaDragStart(ev: DragEvent, m: MesaCatalogo): void {
    const payload: MesaDragPayload = {
      id: m.id,
      numero: m.numero,
      meseroNombre: m.meseroNombre ?? null,
      fromSinZona: false,
    };
    ev.dataTransfer?.setData('application/json', JSON.stringify(payload));
    ev.dataTransfer?.setDragImage?.(ev.target as Element, 20, 20);
  }

  onSinZonaDragStart(ev: DragEvent, row: MesaSinZonaPersist): void {
    const cat = this.mesasCatalogo.find((c) => c.id === row.idMesa);
    const payload: MesaDragPayload = {
      id: row.idMesa,
      numero: cat?.numero ?? String(row.idMesa),
      meseroNombre: cat?.meseroNombre ?? null,
      fromSinZona: true,
    };
    ev.dataTransfer?.setData('application/json', JSON.stringify(payload));
  }

  onPlanoDragOver(ev: DragEvent): void {
    ev.preventDefault();
    ev.dataTransfer!.dropEffect = 'copy';
  }

  onZonaBodyDrop(ev: DragEvent, zona: ZonaVm): void {
    ev.preventDefault();
    let payload: MesaDragPayload | null = null;
    try {
      payload = JSON.parse(ev.dataTransfer?.getData('application/json') || 'null');
    } catch {
      return;
    }
    if (!payload?.id) return;
    const pos = this.eventToContentCoords(ev);
    if (pos == null) return;
    const bodyLeft = zona.x;
    const bodyTop = zona.y + ZONA_HEADER;
    const relX = pos.x - bodyLeft;
    const relY = pos.y - bodyTop;
    if (relX < 0 || relY < 0 || relX > zona.w - this.mesaAnchoUi || relY > zona.h - ZONA_HEADER - this.mesaAltoUi) {
      return;
    }
    this.colocarMesaEnZona(payload, zona, relX, relY);
    this.schedulePersist();
  }

  private eventToContentCoords(ev: DragEvent): { x: number; y: number } | null {
    const scroll = this.planoScroll?.nativeElement;
    if (!scroll) return null;
    const rect = scroll.getBoundingClientRect();
    const xInScroll = ev.clientX - rect.left + scroll.scrollLeft;
    const yInScroll = ev.clientY - rect.top + scroll.scrollTop;
    const x = xInScroll / this.planoZoom;
    const y = yInScroll / this.planoZoom;
    return { x, y };
  }

  private colocarMesaEnZona(
    payload: MesaDragPayload,
    zona: ZonaVm,
    relX: number,
    relY: number,
  ): void {
    const id = payload.id;
    if (!payload.fromSinZona && this.idsEnPlano.has(id)) return;
    this.quitarMesaDeTodo(id);
    zona.mesas.push({
      idMesa: id,
      x: Math.max(0, relX),
      y: Math.max(0, relY),
    });
  }

  private quitarMesaDeTodo(idMesa: number): void {
    for (const z of this.zonas) {
      z.mesas = z.mesas.filter((m) => m.idMesa !== idMesa);
    }
    this.mesasSinZona = this.mesasSinZona.filter((m) => m.idMesa !== idMesa);
  }

  retirarMesaPlanoConfirm(zona: ZonaVm, m: MesaEnZonaPersist): void {
    Swal.fire({
      title: '¿Retirar del plano?',
      icon: 'warning',
      showCancelButton: true,
      background: '#141a21',
      color: '#fff',
      confirmButtonText: 'Sí',
      cancelButtonText: 'No',
    }).then((r) => {
      if (!r.isConfirmed) return;
      zona.mesas = zona.mesas.filter((x) => x.idMesa !== m.idMesa);
      this.mesasSinZona.push({
        idMesa: m.idMesa,
        x: (this.mesasSinZona.length % 6) * 72,
        y: 0,
      });
      this.schedulePersist();
    });
  }

  onMesaPlanoPointerDown(
    ev: PointerEvent,
    zona: ZonaVm,
    m: MesaEnZonaPersist,
  ): void {
    ev.stopPropagation();
    if ((ev.target as HTMLElement).closest('.mesa-plano-btn-retirar')) return;
    this.mesaDragActive = {
      idMesa: m.idMesa,
      zonaId: zona.id,
      startX: ev.clientX,
      startY: ev.clientY,
      origX: m.x,
      origY: m.y,
      moved: false,
    };
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
  }

  onMesaPlanoClick(zona: ZonaVm, m: MesaEnZonaPersist): void {
    if (this.mesaDragActive?.moved) return;
    const cat = this.mesasCatalogo.find((c) => c.id === m.idMesa);
    if (cat) this.toggleSeleccionMesa(cat);
  }

  private onWindowPointerMove(ev: PointerEvent): void {
    if (this.panActive && this.planoScroll) {
      const dx = ev.clientX - this.panStartX;
      const dy = ev.clientY - this.panStartY;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.panDidMove = true;
      const run = () => {
        this.planoScroll!.nativeElement.scrollLeft = this.panStartSl - dx;
        this.planoScroll!.nativeElement.scrollTop = this.panStartSt - dy;
        this.expandCanvasIfNeeded();
        this.rafPan = undefined;
      };
      if (this.rafPan) cancelAnimationFrame(this.rafPan);
      this.rafPan = requestAnimationFrame(run);
      return;
    }
    if (this.zonaHeaderDrag) {
      const dx = (ev.clientX - this.zonaHeaderDrag.sx) / this.planoZoom;
      const dy = (ev.clientY - this.zonaHeaderDrag.sy) / this.planoZoom;
      this.zonaHeaderDrag.zona.x = this.zonaHeaderDrag.ox + dx;
      this.zonaHeaderDrag.zona.y = this.zonaHeaderDrag.oy + dy;
      return;
    }
    if (this.resizeActive) {
      this.applyResize(ev);
      return;
    }
    if (this.mesaDragActive) {
      const dx = (ev.clientX - this.mesaDragActive.startX) / this.planoZoom;
      const dy = (ev.clientY - this.mesaDragActive.startY) / this.planoZoom;
      if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
        this.mesaDragActive.moved = true;
      }
      const z = this.zonas.find((x) => x.id === this.mesaDragActive!.zonaId);
      if (!z) return;
      const m = z.mesas.find((x) => x.idMesa === this.mesaDragActive!.idMesa);
      if (!m) return;
      m.x = Math.max(0, this.mesaDragActive.origX + dx);
      m.y = Math.max(0, this.mesaDragActive.origY + dy);
    }
  }

  private onWindowPointerUp(_ev: PointerEvent): void {
    if (this.resizeActive) {
      this.schedulePersist();
    }
    if (this.zonaHeaderDrag) {
      this.schedulePersist();
    }
    if (this.mesaDragActive?.moved) {
      const z = this.zonas.find((x) => x.id === this.mesaDragActive!.zonaId);
      const m = z?.mesas.find((x) => x.idMesa === this.mesaDragActive!.idMesa);
      if (z && m && !this.mesaDentroCuerpoZona(z, m)) {
        m.x = this.mesaDragActive.origX;
        m.y = this.mesaDragActive.origY;
        Swal.fire({
          title: 'Posición no válida',
          text: 'El local debe quedar dentro del área de la zona.',
          icon: 'warning',
          background: '#141a21',
          color: '#fff',
        });
      } else if (this.mesaDragActive?.moved) {
        this.schedulePersist();
      }
    }
    this.mesaDragActive = null;
    if (this.panActive && this.panDidMove) {
      this.schedulePersist();
    }
    this.panActive = false;
    this.panDidMove = false;
    this.zonaHeaderDrag = null;
    this.resizeActive = null;
  }

  private mesaDentroCuerpoZona(z: ZonaVm, m: MesaEnZonaPersist): boolean {
    const pad = 2;
    const left = z.x + pad;
    const top = z.y + ZONA_HEADER + pad;
    const right = z.x + z.w - this.mesaAnchoUi - pad;
    const bottom = z.y + z.h - this.mesaAltoUi - pad;
    const x2 = z.x + m.x + this.mesaAnchoUi;
    const y2 = z.y + ZONA_HEADER + m.y + this.mesaAltoUi;
    return (
      z.x + m.x >= left &&
      z.y + ZONA_HEADER + m.y >= top &&
      x2 <= z.x + z.w - pad &&
      y2 <= z.y + z.h - pad
    );
  }

  onFondoPointerDown(ev: PointerEvent): void {
    const t = ev.target as HTMLElement;
    if (
      t.closest('.zona-diagrama') ||
      t.closest('.mesa-plano') ||
      t.closest('.pos-zoom-bar') ||
      t.closest('.sin-zona-strip')
    ) {
      return;
    }
    this.panActive = true;
    this.panDidMove = false;
    this.panStartX = ev.clientX;
    this.panStartY = ev.clientY;
    this.panStartSl = this.planoScroll?.nativeElement.scrollLeft ?? 0;
    this.panStartSt = this.planoScroll?.nativeElement.scrollTop ?? 0;
  }

  private expandCanvasIfNeeded(): void {
    const el = this.planoScroll?.nativeElement;
    if (!el) return;
    const margin = 160;
    if (el.scrollLeft < margin) {
      const add = margin - el.scrollLeft;
      this.contenidoAncho += add;
      el.scrollLeft += add;
    }
    if (el.scrollTop < margin) {
      const add = margin - el.scrollTop;
      this.contenidoAlto += add;
      el.scrollTop += add;
    }
  }

  onZonaHeaderPointerDown(ev: PointerEvent, zona: ZonaVm): void {
    if ((ev.target as HTMLElement).closest('.zona-btn-x')) return;
    if ((ev.target as HTMLElement).closest('.zona-nombre-input')) return;
    ev.stopPropagation();
    this.zonaHeaderDrag = {
      zona,
      sx: ev.clientX,
      sy: ev.clientY,
      ox: zona.x,
      oy: zona.y,
    };
  }

  startResize(ev: PointerEvent, zona: ZonaVm, handle: string): void {
    ev.stopPropagation();
    this.resizeActive = {
      zona,
      handle,
      startX: ev.clientX,
      startY: ev.clientY,
      orig: { x: zona.x, y: zona.y, w: zona.w, h: zona.h },
    };
  }

  private applyResize(ev: PointerEvent): void {
    const r = this.resizeActive;
    if (!r) return;
    const dx = (ev.clientX - r.startX) / this.planoZoom;
    const dy = (ev.clientY - r.startY) / this.planoZoom;
    const z = r.zona;
    const o = r.orig;
    let { x, y, w, h } = o;
    const hdl = r.handle;
    if (hdl.includes('e')) w = Math.max(120, o.w + dx);
    if (hdl.includes('s')) h = Math.max(80, o.h + dy);
    if (hdl.includes('w')) {
      const nw = Math.max(120, o.w - dx);
      x = o.x + (o.w - nw);
      w = nw;
    }
    if (hdl.includes('n')) {
      const nh = Math.max(80, o.h - dy);
      y = o.y + (o.h - nh);
      h = nh;
    }
    z.x = x;
    z.y = y;
    z.w = w;
    z.h = h;
  }

  onDocumentWheel(ev: WheelEvent): void {
    const scroll = this.planoScroll?.nativeElement;
    if (!scroll || !scroll.contains(ev.target as Node)) return;
    ev.preventDefault();
    const factor = ev.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    this.planoZoom = Math.min(10, Math.max(0.1, this.planoZoom * factor));
    this.schedulePersist();
  }

  zoomIn(): void {
    this.planoZoom = Math.min(10, this.planoZoom * ZOOM_STEP);
    this.schedulePersist();
  }

  zoomOut(): void {
    this.planoZoom = Math.max(0.1, this.planoZoom / ZOOM_STEP);
    this.schedulePersist();
  }

  nuevaZona(): void {
    Swal.fire({
      title: 'Nombre de zona',
      input: 'text',
      background: '#141a21',
      color: '#fff',
      showCancelButton: true,
      confirmButtonText: 'Crear',
      cancelButtonText: 'Cancelar',
      inputValidator: (v) => (!v?.trim() ? 'Nombre requerido' : null),
    }).then((r) => {
      if (!r.isConfirmed || !r.value?.trim()) return;
      const nombre = this.nombreZonaUnico(r.value.trim());
      const z: ZonaVm = {
        id: this.nextZonaTempId--,
        x: 120,
        y: 120,
        w: 320,
        h: 240,
        nombre,
        mesas: [],
      };
      this.zonas.push(z);
      this.schedulePersist();
    });
  }

  private nombreZonaUnico(base: string): string {
    const nombres = new Set(this.zonas.map((z) => z.nombre.toLowerCase()));
    let n = base;
    let i = 2;
    while (nombres.has(n.toLowerCase())) {
      n = `${base} (${i})`;
      i++;
    }
    return n;
  }

  eliminarZona(z: ZonaVm): void {
    Swal.fire({
      title: '¿Eliminar zona?',
      text: z.nombre,
      icon: 'warning',
      showCancelButton: true,
      background: '#141a21',
      color: '#fff',
    }).then((r) => {
      if (!r.isConfirmed) return;
      for (const m of z.mesas) {
        this.mesasSinZona.push({
          idMesa: m.idMesa,
          x: (this.mesasSinZona.length % 6) * 72,
          y: 0,
        });
      }
      this.zonas = this.zonas.filter((x) => x.id !== z.id);
      this.schedulePersist();
    });
  }

  guardarNombreZonaDesdeModel(z: ZonaVm): void {
    const v = (z.nombre || '').trim();
    if (!v) return;
    z.nombre = this.nombreZonaUnicoExcluyendo(v, z.id);
    this.schedulePersist();
  }

  private nombreZonaUnicoExcluyendo(base: string, excludeId: number): string {
    const otros = this.zonas.filter((x) => x.id !== excludeId).map((x) => x.nombre.toLowerCase());
    let n = base;
    let i = 2;
    while (otros.includes(n.toLowerCase())) {
      n = `${base} (${i})`;
      i++;
    }
    return n;
  }

  construirJsonPlano(): PlanoLayoutJson {
    return {
      zonas: this.zonas.map((z) => ({
        id: z.id,
        x: z.x,
        y: z.y,
        w: z.w,
        h: z.h,
        nombre: z.nombre,
        mesas: z.mesas.map((m) => ({ idMesa: m.idMesa, x: m.x, y: m.y })),
      })),
      mesasSinZona: this.mesasSinZona.map((m) => ({ ...m })),
      ancho: this.contenidoAncho,
      alto: this.contenidoAlto,
      zoom: this.planoZoom,
      mesaTamano: { ancho: this.mesaTamanoW, alto: this.mesaTamanoH },
    };
  }

  private schedulePersist(): void {
    const snapshot = this.construirJsonPlano();
    this.saveState = 'saving';
    if (!this.idSucursal) {
      this.syncLayout.setLastGoodState(snapshot);
      this.saveState = 'ok';
      if (this.saveOkTimer) clearTimeout(this.saveOkTimer);
      this.saveOkTimer = setTimeout(() => {
        this.saveState = 'idle';
      }, 1200);
      return;
    }
    this.syncLayout.scheduleSave(this.idSucursal, snapshot, {
      onSuccess: () => {
        this.saveState = 'ok';
        if (this.saveOkTimer) clearTimeout(this.saveOkTimer);
        this.saveOkTimer = setTimeout(() => {
          this.saveState = 'idle';
        }, 2000);
      },
      onRollback: () => {
        const good = this.syncLayout.lastGoodState;
        if (good) this.hydrateFromLayout(good);
        this.saveState = 'error';
      },
      onError: () => {
        this.saveState = 'error';
      },
    });
  }

  get bloquearBotonesCambioMeseroYMesa(): boolean {
    for (const id of this.selectedIds) {
      const m = this.mesasCatalogo.find((x) => x.id === id);
      if (m?.estado === 'en_pago') return true;
    }
    return false;
  }

  get comandaDisabled(): boolean {
    return (
      this.selectedIds.size === 0 || this.bloquearBotonesCambioMeseroYMesa
    );
  }

  onComanda(): void {
    if (this.comandaDisabled) return;
    this.pedirComanda.emit([...this.selectedIds]);
  }

  onPinDigit(d: string): void {
    if (this.pin.length >= this.pinMax) return;
    this.pin += d;
  }

  onPinClear(): void {
    this.pin = '';
  }

  onSalir(): void {
    this.cerrar.emit();
  }

  trackZona(_i: number, z: ZonaVm): number {
    return z.id;
  }

  trackMesaZona(_i: number, m: MesaEnZonaPersist): number {
    return m.idMesa;
  }

  logoMesa(idMesa: number): string {
    return (
      this.mesasCatalogo.find((c) => c.id === idMesa)?.logoUrl ||
      'assets/images/logos/markerInstalacion.png'
    );
  }

  nombreMesa(idMesa: number): string {
    return (
      this.mesasCatalogo.find((c) => c.id === idMesa)?.nombre ||
      String(idMesa)
    );
  }

  get pinDisplay(): string {
    return this.pin.padEnd(this.pinMax, '·');
  }
}
