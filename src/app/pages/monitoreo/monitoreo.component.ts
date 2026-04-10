// monitoreo.component.ts
import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import {
  animate,
  query,
  stagger,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { AuthenticationService } from 'src/app/services/auth.service';
import { InstalacionCentral } from 'src/app/services/moduleService/instalacionesCentral.service';
import {
  LocalesPlanoContext,
  MesaCatalogo,
  MesaEstadoUi,
} from './locales-plano/pos-locales.models';

declare const google: any;

type ViewMode = 'centrales' | 'instalaciones';

/** Cliente agrupado con sus predios (oficinas centrales). */
interface ClienteMonitoreoGrupo {
  idCliente: number | string | null;
  nombreCliente: string;
  centrales: any[];
}

@Component({
  selector: 'app-monitoreo',
  templateUrl: './monitoreo.component.html',
  styleUrls: ['./monitoreo.component.scss'],
  standalone: false,
  animations: [
    routeAnimation,
    trigger('monitorModeHeader', [
      transition('* <=> *', [
        style({ opacity: 0.6, transform: 'translateY(-4px) scale(0.98)' }),
        animate(
          '180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' })
        ),
      ]),
    ]),
    trigger('monitorListSwap', [
      transition('* <=> *', [
        query(
          '.insta-item',
          [
            style({ opacity: 0, transform: 'translateY(10px) scale(0.98)' }),
            stagger(
              40,
              animate(
                '170ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                style({ opacity: 1, transform: 'translateY(0) scale(1)' })
              )
            ),
          ],
          { optional: true }
        ),
      ]),
    ]),
    trigger('monitorItemIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px) scale(0.98)' }),
        animate(
          '160ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' })
        ),
      ]),
    ]),
  ],
})
export class MonitoreoComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly PREVIEW_SERIE = 'preview-demo';
  listaInstalaciones: any[] = [];
  /** Lista izquierda: clientes con sus predios anidados. */
  listaClientes: ClienteMonitoreoGrupo[] = [];
  selectedClienteGrupo: ClienteMonitoreoGrupo | null = null;
  /** Predio cuyas instalaciones se pintan en el mapa (tras pulsar «Inmuebles» en la card). */
  selectedPredioParaMapa: any | null = null;

  selectedId?: number;
  viewMode: ViewMode = 'centrales';
  selectedCentral: any | null = null;

  /** Muestra el mapa; «Locales» en un inmueble lo oculta por completo (solo layout). */
  mapVisible = true;
  /** Contenido pendiente de definir cuando el mapa está oculto por «Locales». */
  vistaLocalesActiva = false;
  /** Contexto para la vista operativa tipo POS (plano de locales). */
  localesPlanoContext: LocalesPlanoContext | null = null;

  /** Solo rol 1 ve la lista de Clientes; el resto solo sus Instalaciones. */
  isRol1 = false;

  private map?: any;
  private markers: any[] = [];
  private infoWindow?: any;
  private resizeObserver?: ResizeObserver;
  private static mapsLoading?: Promise<void>;

  private currentInfoMarker?: any;
  private pinnedMarker?: any;
  private mapClickUnpinListener?: any;
  private hoverCloseTimer?: ReturnType<typeof setTimeout>;
  private isHoveringInfoWindow = false;
  private closingInfoForMarker?: any;

  private readonly apiKey = 'AIzaSyDuJ3IBZIs2mRbR4alTg7OZIsk0sXEJHhg';

  private readonly MAP_ID?: string = undefined;
  private readonly PIN_URL = 'assets/images/logos/markerInstalacion.png';
  private readonly CENTRAL_PIN_URL = 'assets/images/logos/markerCliente.png';

  get listaVisible(): any[] {
    if (this.viewMode === 'centrales') {
      return this.listaInstalaciones;
    }
    const c = this.selectedCentral;
    return Array.isArray(c?.instalaciones) ? c.instalaciones : [];
  }

  /** Inmuebles (locales) del cliente seleccionado, todos los predios, con referencia al predio padre. */
  get inmueblesDelCliente(): { instalacion: any; central: any }[] {
    const g = this.selectedClienteGrupo;
    if (!g?.centrales?.length) return [];
    const out: { instalacion: any; central: any }[] = [];
    for (const central of g.centrales) {
      const inst = Array.isArray(central?.instalaciones) ? central.instalaciones : [];
      for (const ins of inst) {
        out.push({ instalacion: ins, central });
      }
    }
    return out;
  }

  constructor(
    private insService: InstalacionCentral,
    private router: Router,
    private toastr: ToastrService,
    private auth: AuthenticationService
  ) {}

  private checkRol(): void {
    const u = this.auth.getUser();
    const rol = u?.rol != null ? Number(u.rol) : null;
    this.isRol1 = rol === 1;
  }

  ngOnInit(): void {
    this.checkRol();
    this.obtenerInstalacionesCentral();
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.cancelHoverClose();
    if (this.mapClickUnpinListener) {
      google.maps.event.removeListener(this.mapClickUnpinListener);
      this.mapClickUnpinListener = null;
    }
  }

  private pinIcon(url: string, width: number, height: number) {
    return {
      url,
      scaledSize: new google.maps.Size(width, height),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(width / 2, height)
    };
  }

  obtenerInstalacionesCentral() {
    this.insService.obtenerInstalacionCentral().subscribe((response: any) => {
      let data: any[] = response?.data ?? [];
      const u = this.auth.getUser();
      const idCliente = u?.idCliente != null ? u.idCliente : null;

      let rowsParaClientes = data;

      if (this.isRol1) {
        this.listaInstalaciones = data;
        this.viewMode = 'centrales';
        this.selectedCentral = null;
        this.selectedClienteGrupo = null;
        this.selectedPredioParaMapa = null;
      } else {
        const filtered = data.filter(
          (c: any) => c?.idCliente == idCliente || c?.id == idCliente
        );
        this.listaInstalaciones = filtered;
        rowsParaClientes = filtered;
        this.selectedCentral = filtered.length ? filtered[0] : null;
        this.viewMode = 'instalaciones';
      }

      this.rebuildListaClientes(rowsParaClientes);

      if (this.map) this.renderAccordingMode();
    });
  }

  private rebuildListaClientes(rows: any[]) {
    const byKey = new Map<string, ClienteMonitoreoGrupo>();
    for (const central of rows || []) {
      const idC = central?.idCliente ?? null;
      const key =
        idC != null && idC !== ''
          ? `id:${idC}`
          : `nom:${central?.nombreCliente ?? 'sin-nombre'}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          idCliente: idC,
          nombreCliente: central?.nombreCliente ?? 'Cliente',
          centrales: [],
        });
      }
      byKey.get(key)!.centrales.push(central);
    }
    this.listaClientes = Array.from(byKey.values());

    if (!this.isRol1 && this.listaClientes.length === 1) {
      this.selectCliente(this.listaClientes[0], false);
    }
  }

  selectCliente(grupo: ClienteMonitoreoGrupo, resetMap = true) {
    this.selectedClienteGrupo = grupo;
    this.selectedId = undefined;
    this.selectedPredioParaMapa = null;
    this.selectedCentral = null;
    this.vistaLocalesActiva = false;
    this.localesPlanoContext = null;
    if (resetMap) {
      this.mapVisible = true;
    }
    this.clearPin();
    if (this.map) {
      if (resetMap) {
        this.clearMarkers();
        this.map.setCenter({ lat: 19.432608, lng: -99.133209 });
        this.map.setZoom(12);
      }
    }
    this.renderAccordingMode();
  }

  /** Card predio: ver en mapa solo instalaciones de ese predio. */
  verInmueblesEnMapa(predio: any, event?: Event) {
    event?.stopPropagation();
    this.selectedPredioParaMapa = predio;
    this.selectedCentral = predio;
    this.mapVisible = true;
    this.vistaLocalesActiva = false;
    this.localesPlanoContext = null;
    this.clearPin();
    setTimeout(() => {
      google.maps.event?.trigger(this.map, 'resize');
      if (this.map) this.renderInstalacionesOnly();
    }, 0);
  }

  /** Card inmueble: vista operativa tipo POS / plano de locales. */
  abrirVistaLocales(_instalacion: any, central: any, event?: Event) {
    event?.stopPropagation();
    this.mapVisible = false;
    this.vistaLocalesActiva = true;
    this.localesPlanoContext = this.buildLocalesPlanoContext(central);
    this.clearPin();
  }

  private buildLocalesPlanoContext(central: any): LocalesPlanoContext {
    const mesas: MesaCatalogo[] = this.inmueblesDelCliente.map(
      ({ instalacion }) => {
        const id = Number(instalacion?.id) || 0;
        const ocupado = Number(instalacion?.estatus) === 1;
        const est: MesaEstadoUi = ocupado ? 'ocupado' : 'vacío';
        return {
          id,
          numero: String(
            instalacion?.nroPiso ?? instalacion?.id ?? '',
          ),
          nombre: `Local ${instalacion?.nombreDepartamento || instalacion?.id || id}`,
          meseroNombre: null,
          idPersonal: null,
          estado: est,
          logoUrl: 'assets/images/logos/markerInstalacion.png',
        };
      },
    );
    return {
      idSucursal: Number(central?.id) || 0,
      nombreSucursal:
        central?.nombreInstalacion || central?.nombre || 'Sucursal',
      mesas,
    };
  }

  onPedirComandaDesdeLocales(ids: number[]): void {
    this.toastr.info(
      `Locales seleccionados: ${ids.join(', ')}. Enlace al módulo Comanda pendiente.`,
      'Comanda',
    );
  }

  cerrarVistaLocalesYMostrarMapa() {
    this.vistaLocalesActiva = false;
    this.localesPlanoContext = null;
    this.mapVisible = true;
    setTimeout(() => {
      google.maps.event?.trigger(this.map, 'resize');
      this.renderAccordingMode();
    }, 0);
  }

  private async initMap() {
    await this.loadGoogleMaps();
    this.installInfoWindowSkin();

    const el = document.getElementById('map');
    if (!el) return;

    const center = { lat: 19.432608, lng: -99.133209 };

    let MapCtor: any;
    if (google.maps?.importLibrary) {
      const { Map } = await google.maps.importLibrary('maps');
      MapCtor = Map;
    } else {
      MapCtor = google.maps.Map;
    }

    const mapOptions: any = {
      center,
      zoom: 12,
      mapTypeId: 'roadmap',
      gestureHandling: 'greedy',
      fullscreenControl: true,
      streetViewControl: true,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
        { featureType: 'poi.park', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    };
    if (this.MAP_ID) mapOptions.mapId = this.MAP_ID;

    this.map = new MapCtor(el, mapOptions);
    this.infoWindow = new google.maps.InfoWindow({
      disableAutoPan: false,
      maxWidth: 300,
    });

    if (this.listaInstalaciones.length) this.renderAccordingMode();

    setTimeout(() => {
      google.maps.event?.trigger(this.map, 'resize');
      this.map?.setCenter(center);
    }, 0);

    if ('ResizeObserver' in window && el) {
      this.resizeObserver = new ResizeObserver(() => {
        google.maps.event?.trigger(this.map, 'resize');
      });
      this.resizeObserver.observe(el);
    }
  }

  private renderAccordingMode() {
    if (!this.map) return;
    if (!this.mapVisible) return;

    if (this.selectedPredioParaMapa) {
      this.renderInstalacionesOnly();
      return;
    }

    if (this.isRol1 && !this.selectedClienteGrupo) {
      this.renderCentrales();
      return;
    }

    if (
      !this.isRol1 &&
      this.selectedClienteGrupo &&
      this.selectedCentral &&
      !this.selectedPredioParaMapa
    ) {
      this.renderInstalacionesOnly();
      return;
    }

    this.clearMarkers();
    this.map.setCenter({ lat: 19.432608, lng: -99.133209 });
    this.map.setZoom(12);
  }

  private renderCentrales() {
    this.clearMarkers();

    const bounds = new google.maps.LatLngBounds();
    let hasAny = false;

    for (const c of this.listaInstalaciones) {
      const lat = Number(c.lat);
      const lng = Number(c.lng);
      if (!isFinite(lat) || !isFinite(lng)) continue;

      const pos = { lat, lng };

      const marker = new google.maps.Marker({
        map: this.map,
        position: pos,
        title: c.nombreCliente || 'Central',
        icon: this.pinIcon(this.CENTRAL_PIN_URL, 40, 60),
      });

      marker.addListener('mouseover', () => {
        this.cancelHoverClose();
        this.showHover(marker, this.buildInfoHtml(c));
      });
      marker.addListener('mouseout', () => this.hideHover(marker));
      marker.addListener('click', () =>
        this.togglePin(marker, this.buildInfoHtml(c), { central: c })
      );

      this.markers.push(marker);
      bounds.extend(pos);
      hasAny = true;
    }

    if (hasAny) this.fitBoundsNice(bounds);
  }

  private renderInstalacionesOnly() {
    this.clearMarkers();

    const c = this.selectedPredioParaMapa ?? this.selectedCentral;
    const childs = Array.isArray(c?.instalaciones) ? c.instalaciones : [];

    const bounds = new google.maps.LatLngBounds();
    let hasAny = false;

    for (const ins of childs) {
      const lat = Number(ins.lat);
      const lng = Number(ins.lng);
      if (!isFinite(lat) || !isFinite(lng)) continue;

      const pos = { lat, lng };

      const marker = new google.maps.Marker({
        map: this.map,
        position: pos,
        title: c?.nombreCliente
          ? `${c.nombreCliente} - Instalación`
          : 'Instalación',
        icon: this.pinIcon(this.PIN_URL, 40, 60),
      });

      marker.addListener('mouseover', () => {
        this.cancelHoverClose();
        this.showHover(marker, this.buildInfoHtmlInstalacion(c, ins));
      });
      marker.addListener('mouseout', () => this.hideHover(marker));
      marker.addListener('click', () =>
        this.togglePin(marker, this.buildInfoHtmlInstalacion(c, ins), {
          central: c,
          instalacion: ins,
        })
      );

      this.markers.push(marker);
      bounds.extend(pos);
      hasAny = true;
    }

    if (hasAny) this.fitBoundsNice(bounds);
  }

  goToCentrales() {
    this.viewMode = 'centrales';
    this.selectedCentral = null;
    this.selectedClienteGrupo = null;
    this.selectedPredioParaMapa = null;
    this.mapVisible = true;
    this.vistaLocalesActiva = false;
    this.localesPlanoContext = null;
    this.clearPin();
    this.renderAccordingMode();
  }

  goToInstalaciones() {
    if (!this.selectedCentral) return;
    this.viewMode = 'instalaciones';
    this.clearPin();
    this.renderAccordingMode();
  }

  verInstalacionesDeCentral(central: any) {
    this.verInmueblesEnMapa(central);
  }

  private showHover(marker: any, html: string) {
    if (this.pinnedMarker) return;
    this.cancelHoverClose();
    this.openInfo(marker, html, undefined, false);
  }

  private hideHover(marker: any) {
    if (this.pinnedMarker) return;
    this.scheduleHoverClose(marker);
  }

  private togglePin(marker: any, html: string, payload?: any) {
    if (this.pinnedMarker === marker) {
      this.clearPin();
      return;
    }
    this.clearPin();
    this.pinnedMarker = marker;
    this.openInfo(marker, html, payload, true);
    this.mapClickUnpinListener = this.map?.addListener('click', () => {
      this.clearPin();
    });
  }

  private clearPin() {
    if (this.mapClickUnpinListener) {
      google.maps.event.removeListener(this.mapClickUnpinListener);
      this.mapClickUnpinListener = null;
    }
    this.pinnedMarker = null;
    this.cancelHoverClose();
    this.isHoveringInfoWindow = false;
    this.animateInfoClose(this.currentInfoMarker, true);
  }

  private scheduleHoverClose(marker: any): void {
    this.cancelHoverClose();
    this.hoverCloseTimer = setTimeout(() => {
      if (this.pinnedMarker || this.isHoveringInfoWindow) return;
      this.animateInfoClose(marker, false);
    }, 180);
  }

  private cancelHoverClose(): void {
    if (!this.hoverCloseTimer) return;
    clearTimeout(this.hoverCloseTimer);
    this.hoverCloseTimer = undefined;
  }

  private animateInfoClose(marker: any, force = false): void {
    if (!marker || this.currentInfoMarker !== marker) return;
    if (this.closingInfoForMarker === marker) return;

    const root: HTMLElement | null = document.querySelector('.gm-style-iw');
    const infoCard: HTMLElement | null = root?.querySelector('.iw-card') as HTMLElement;

    if (!infoCard || force) {
      this.infoWindow?.close();
      this.currentInfoMarker = undefined;
      this.closingInfoForMarker = undefined;
      return;
    }

    this.closingInfoForMarker = marker;
    infoCard.classList.remove('iw-enter');
    infoCard.classList.add('iw-leave');

    setTimeout(() => {
      if (this.currentInfoMarker === marker) {
        this.infoWindow?.close();
        this.currentInfoMarker = undefined;
      }
      this.closingInfoForMarker = undefined;
    }, 120);
  }

  private fitBoundsNice(bounds: any) {
    this.map.fitBounds(bounds);
    const listener = google.maps.event.addListenerOnce(
      this.map,
      'bounds_changed',
      () => {
        const z = this.map.getZoom();
        if (z > 16) this.map.setZoom(16);
        google.maps.event.removeListener(listener);
      }
    );
  }

  private clearMarkers() {
    this.markers.forEach((m) => m.setMap?.(null));
    this.markers = [];
  }

  selectPredioCard(predio: any) {
    this.selectedId = predio?.id;
  }

  selectInstalacion(
    payload: { instalacion: any; central: any },
    indexEnMapa: number
  ) {
    if (!this.mapVisible) return;
    const { instalacion: ins, central: c } = payload;
    if (
      this.selectedPredioParaMapa &&
      this.selectedPredioParaMapa.id !== c?.id
    ) {
      this.verInmueblesEnMapa(c);
    }
    const lat = Number(ins.lat);
    const lng = Number(ins.lng);
    if (!isFinite(lat) || !isFinite(lng)) return;
    const pos = { lat, lng };
    this.map?.panTo(pos);
    this.map?.setZoom(Math.max(this.map?.getZoom() ?? 12, 15));
    const marker = this.markers[indexEnMapa];
    if (marker) {
      this.togglePin(marker, this.buildInfoHtmlInstalacion(c, ins), {
        central: c,
        instalacion: ins,
      });
    }
  }

  /** Índice del marcador en el mapa actual para una instalación (mismo orden que renderInstalacionesOnly). */
  indiceMarcadorInmueble(central: any, ins: any): number {
    const mapCentral = this.selectedPredioParaMapa ?? this.selectedCentral;
    if (!mapCentral || mapCentral.id !== central?.id) return -1;
    const childs = Array.isArray(central?.instalaciones) ? central.instalaciones : [];
    return childs.indexOf(ins);
  }

  onCentrarInmueble(row: { instalacion: any; central: any }, event?: Event) {
    event?.stopPropagation();
    const run = () => {
      const idx = this.indiceMarcadorInmueble(row.central, row.instalacion);
      if (idx >= 0) this.selectInstalacion(row, idx);
    };
    if (!this.mapVisible) {
      this.verInmueblesEnMapa(row.central);
      setTimeout(run, 120);
      return;
    }
    if (this.selectedPredioParaMapa?.id !== row.central?.id) {
      this.verInmueblesEnMapa(row.central);
      setTimeout(run, 120);
      return;
    }
    run();
  }

  private openInfo(marker: any, html: string, payload?: any, pinned = false) {
    this.infoWindow?.setContent(html);
    this.infoWindow?.open(this.map, marker);
    this.currentInfoMarker = marker;
    this.isHoveringInfoWindow = false;

    google.maps.event.addListenerOnce(this.infoWindow, 'domready', () => {
      const root: HTMLElement | null = document.querySelector('.gm-style-iw');
      const infoCard: HTMLElement | null = root?.querySelector(
        '.iw-card'
      ) as HTMLElement;
      const btnClose: HTMLElement | null = root?.querySelector(
        '.iw-close'
      ) as HTMLElement;
      const btnAction: HTMLElement | null = root?.querySelector(
        '.iw-action'
      ) as HTMLElement;
      const btnDetailAction: HTMLElement | null = root?.querySelector(
        '.iw-detail-action'
      ) as HTMLElement;

      if (!pinned) {
        infoCard?.addEventListener('mouseenter', () => {
          this.isHoveringInfoWindow = true;
          this.cancelHoverClose();
        });
        infoCard?.addEventListener('mouseleave', () => {
          this.isHoveringInfoWindow = false;
          this.scheduleHoverClose(marker);
        });
      }

      btnClose?.addEventListener('click', () => {
        if (pinned) this.clearPin();
        else this.hideHover(marker);
      });
      btnAction?.addEventListener('click', () => this.onInfoAction(payload));
      btnDetailAction?.addEventListener('click', () =>
        this.onPredioDetalleAction(payload?.central)
      );
    });
  }

  onInfoAction(payload: any) {
    const numeroSerie =
      payload?.instalacion?.equipo?.numeroSerie ??
      payload?.instalacion?.numeroSerie;
    this.router.navigate([
      '/monitoreo',
      'instalacion',
      numeroSerie || this.PREVIEW_SERIE,
    ], {
      queryParams: { origen: 'inmueble' },
    });
  }

  onPredioDetalleAction(central: any) {
    const numeroSerie = this.getFirstNumeroSerieFromCentral(central);
    this.router.navigate([
      '/monitoreo',
      'instalacion',
      numeroSerie || this.PREVIEW_SERIE,
    ], {
      queryParams: { origen: 'predio' },
    });
  }

  private getFirstNumeroSerieFromCentral(central: any): string | null {
    const instalaciones = Array.isArray(central?.instalaciones)
      ? central.instalaciones
      : [];
    for (const ins of instalaciones) {
      const numeroSerie = ins?.equipo?.numeroSerie ?? ins?.numeroSerie;
      if (numeroSerie) return String(numeroSerie);
    }
    return null;
  }

  private static iwStylesInstalled = false;

  private installInfoWindowSkin(): void {
    if (MonitoreoComponent.iwStylesInstalled) return;
    const css = `
      .gm-style-iw, .gm-style-iw.gm-style-iw-c {
        background: #151f35 !important;
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
      }
        .gm-style .gm-style-iw-tc::after {
            background: #151f35;
            -webkit-clip-path: polygon(0 0, 50% 100%, 100% 0);
            clip-path: polygon(0 0, 50% 100%, 100% 0);
            content: "";
            height: 12px;
            left: 0;
            position: absolute;
            top: -1px;
            width: 25px;
        }
      .gm-style-iw-d { padding: 0 !important; overflow: visible !important; }
      .gm-style .gm-style-iw-t::after { background: transparent !important; box-shadow: none !important; }
      .gm-style-iw-tc { padding: 0 !important; margin: 0 !important; }
      .gm-ui-hover-effect { display: none !important; }

      .iw-card {
        transform-origin: 50% 100%;
        will-change: transform, opacity, filter;
      }
      .iw-card.iw-enter {
        animation: iwEnter 140ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }
      .iw-card.iw-leave {
        animation: iwLeave 120ms ease-in both;
      }
      @keyframes iwEnter {
        0% { opacity: 0; transform: translateY(8px) scale(0.94); filter: blur(2px); }
        100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
      }
      @keyframes iwLeave {
        0% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        100% { opacity: 0; transform: translateY(6px) scale(0.95); filter: blur(1.5px); }
      }
    `;
    const style = document.createElement('style');
    style.setAttribute('data-iw-skin', 'true');
    style.textContent = css;
    document.head.appendChild(style);
    MonitoreoComponent.iwStylesInstalled = true;
  }

  private buildInfoHtml(item: any): string {
    const name = item?.nombre ?? item?.nombreInstalacion ?? 'Instalación';
    const dir = item?.direccion ?? '';

    return `
    <div class="iw-card iw-enter" style="
      background:#151f35; color:#e5e7eb;
      padding:0px 18px 16px;
      border-radius:12px; min-width:260px; max-width:320px; line-height:1.25rem;
      box-shadow:0 12px 28px rgba(0,0,0,.20);
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px;">
        <h6 style="margin:0;font-size:1rem;color:#fff;">${name}</h6>
        <button class="iw-close" aria-label="Cerrar" style="background:transparent;border:0;cursor:pointer;color:#fff;font-size:18px;line-height:1;width:28px;height:28px;border-radius:8px;">✕</button>
      </div>
      <div style="display:flex;gap:.5rem;align-items:flex-start;color:#c6cfde;">
        <span style="margin-top:4px;width:8px;height:8px;border-radius:999px;background:var(--mat-sys-primary,#681330);display:inline-block;flex:0 0 8px;"></span>
        <span>${dir}</span>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:10px;">
        <button class="iw-detail-action" style="
          background:#681330; color:#fff; border:0; cursor:pointer;
          border-radius:10px; padding:8px 12px; font-size:.85rem;
        ">
          Detalle
        </button>
      </div>
    </div>
  `;
  }

  private buildInfoHtmlInstalacion(c: any, ins: any): string {
    const estatusOk = Number(ins?.estatus) === 1;

    const numeroSerie = ins?.equipo?.numeroSerie ?? ins?.numeroSerie ?? '—';

    const fhRegFmt = this.formatDate(ins?.fhRegistro);
    const fhActFmt = this.formatDate(ins?.fechaActualizacion);
    const direccion = c?.direccion ?? '—';

    const nroPisoHtml = (ins?.nroPiso !== null && ins?.nroPiso !== undefined) 
      ? `<div><strong>Número de Piso:</strong> ${ins.nroPiso}</div>` 
      : '';
    const nombreDepartamentoHtml = ins?.nombreDepartamento 
      ? `<div><strong>Departamento:</strong> ${ins.nombreDepartamento}</div>` 
      : '';

    return `
    <div class="iw-card iw-enter" style="
      background:#151f35; color:#e5e7eb;
      padding:0px 18px 16px;
      border-radius:12px; min-width:260px; max-width:320px; line-height:1.25rem;
      box-shadow:0 12px 28px rgba(0,0,0,.20);
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px;">
        <h6 style="margin:0;font-size:1rem;color:#fff;">Equipo: ${numeroSerie}</h6>
        <button class="iw-close" aria-label="Cerrar" style="background:transparent;border:0;cursor:pointer;color:#fff;font-size:18px;line-height:1;width:28px;height:28px;border-radius:8px;">✕</button>
      </div>
      <hr style="border:none;height:1px;background:rgba(255,255,255,.10);margin:6px 0;" />
      <div style="display:grid;grid-template-columns:1fr;gap:4px;font-size:.85rem;color:#c6cfde;">
        ${nroPisoHtml}
        ${nombreDepartamentoHtml}
        <div><strong>Cliente:</strong> ${c?.nombreCliente ?? '—'}</div>
        <div>
          <strong>Estatus:</strong>
          <span style="
            display:inline-block;padding:2px 8px;margin-left:6px;border-radius:999px;
            background:${estatusOk ? '#16a34a' : '#ef4444'}; color:#fff; font-size:.78rem;">
            ${estatusOk ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <div><strong>Registro:</strong> ${fhRegFmt}</div>
        <div><strong>Actualización:</strong> ${fhActFmt}</div>
      </div>
      <div style="display:flex;gap:.5rem;align-items:flex-start;color:#c6cfde;margin-top:8px;">
        <span style="margin-top:4px;width:8px;height:8px;border-radius:999px;background:#681330;display:inline-block;flex:0 0 8px;"></span>
        <span>${direccion}</span>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:10px;">
        <button class="iw-action" style="
          background:#681330; color:#fff; border:0; cursor:pointer;
          border-radius:10px; padding:8px 12px; font-size:.85rem;
        ">
          Incidencias
        </button>
      </div>
    </div>
  `;
  }


  private formatDate(value: any): string {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  }

  private loadGoogleMaps(): Promise<void> {
    if ((window as any).google?.maps) return Promise.resolve();
    if (MonitoreoComponent.mapsLoading) return MonitoreoComponent.mapsLoading;

    MonitoreoComponent.mapsLoading = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        this.apiKey
      )}&v=weekly&libraries=marker,places`;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () =>
        reject(new Error('No se pudo cargar Google Maps JS API'));
      document.head.appendChild(s);
    });

    return MonitoreoComponent.mapsLoading;
  }
}
