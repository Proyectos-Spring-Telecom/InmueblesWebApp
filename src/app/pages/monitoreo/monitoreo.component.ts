// monitoreo.component.ts
import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { AuthenticationService } from 'src/app/services/auth.service';
import { InstalacionCentral } from 'src/app/services/moduleService/instalacionesCentral.service';

declare const google: any;

type ViewMode = 'centrales' | 'instalaciones';

@Component({
  selector: 'app-monitoreo',
  templateUrl: './monitoreo.component.html',
  styleUrls: ['./monitoreo.component.scss'],
  standalone: false,
  animations: [routeAnimation],
})
export class MonitoreoComponent implements OnInit, AfterViewInit, OnDestroy {
  listaInstalaciones: any[] = [];
  selectedId?: number;
  viewMode: ViewMode = 'centrales';
  selectedCentral: any | null = null;

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

  private readonly apiKey = 'AIzaSyDuJ3IBZIs2mRbR4alTg7OZIsk0sXEJHhg';

  private readonly MAP_ID?: string = undefined;
  private readonly PIN_URL = '/assets/images/logos/markerInstalacion.png';
  private readonly CENTRAL_PIN_URL = '/assets/images/logos/markerCliente.png';

  get listaVisible(): any[] {
    if (this.viewMode === 'centrales') {
      return this.listaInstalaciones;
    }
    const c = this.selectedCentral;
    return Array.isArray(c?.instalaciones) ? c.instalaciones : [];
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

      if (this.isRol1) {
        this.listaInstalaciones = data;
        this.viewMode = 'centrales';
        this.selectedCentral = null;
      } else {
        const filtered = data.filter(
          (c: any) => c?.idCliente == idCliente || c?.id == idCliente
        );
        this.listaInstalaciones = filtered;
        this.selectedCentral = filtered.length ? filtered[0] : null;
        this.viewMode = 'instalaciones';
      }

      if (this.map) this.renderAccordingMode();
    });
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
    if (this.viewMode === 'centrales') {
      this.renderCentrales();
    } else {
      this.renderInstalacionesOnly();
    }
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

      marker.addListener('mouseover', () =>
        this.showHover(marker, this.buildInfoHtml(c))
      );
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

    const c = this.selectedCentral;
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

      marker.addListener('mouseover', () =>
        this.showHover(marker, this.buildInfoHtmlInstalacion(c, ins))
      );
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
    this.selectedCentral = central;
    this.viewMode = 'instalaciones';
    this.clearPin();
    this.renderAccordingMode();
  }

  private showHover(marker: any, html: string) {
    if (this.pinnedMarker) return;
    this.openInfo(marker, html, undefined, false);
  }

  private hideHover(marker: any) {
    if (this.pinnedMarker) return;
    if (this.currentInfoMarker === marker) {
      this.infoWindow?.close();
      this.currentInfoMarker = undefined;
    }
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
    this.infoWindow?.close();
    this.currentInfoMarker = undefined;
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

  selectInstalacion(item: any, index: number) {
    if (this.viewMode === 'centrales') {
      this.selectedId = item.id;
      this.selectedCentral = item;
      const lat = Number(item.lat);
      const lng = Number(item.lng);
      if (isFinite(lat) && isFinite(lng)) {
        const pos = { lat, lng };
        this.map?.panTo(pos);
        this.map?.setZoom(Math.max(this.map?.getZoom() ?? 12, 15));
        const marker = this.markers[index];
        if (marker) {
          this.togglePin(marker, this.buildInfoHtml(item), { central: item });
        }
      }
      return;
    }

    const ins = this.selectedCentral?.instalaciones?.[index];
    if (ins) {
      const lat = Number(ins.lat);
      const lng = Number(ins.lng);
      if (isFinite(lat) && isFinite(lng)) {
        const pos = { lat, lng };
        this.map?.panTo(pos);
        this.map?.setZoom(Math.max(this.map?.getZoom() ?? 12, 15));
        const marker = this.markers[index];
        if (marker) {
          this.togglePin(
            marker,
            this.buildInfoHtmlInstalacion(this.selectedCentral, ins),
            { central: this.selectedCentral, instalacion: ins }
          );
        }
      }
    }
  }

  private openInfo(marker: any, html: string, payload?: any, pinned = false) {
    this.infoWindow?.setContent(html);
    this.infoWindow?.open(this.map, marker);
    this.currentInfoMarker = marker;

    google.maps.event.addListenerOnce(this.infoWindow, 'domready', () => {
      const root: HTMLElement | null = document.querySelector('.gm-style-iw');
      const btnClose: HTMLElement | null = root?.querySelector(
        '.iw-close'
      ) as HTMLElement;
      const btnAction: HTMLElement | null = root?.querySelector(
        '.iw-action'
      ) as HTMLElement;

      btnClose?.addEventListener('click', () => {
        if (pinned) this.clearPin();
        else this.hideHover(marker);
      });
      btnAction?.addEventListener('click', () => this.onInfoAction(payload));
    });
  }

  onInfoAction(payload: any) {
    const numeroSerie =
      payload?.instalacion?.equipo?.numeroSerie ??
      payload?.instalacion?.numeroSerie;

    if (!numeroSerie) {
      return;
    }

    this.router.navigate(['/monitoreo', 'instalacion', numeroSerie]);
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
    `;
    const style = document.createElement('style');
    style.setAttribute('data-iw-skin', 'true');
    style.textContent = css;
    document.head.appendChild(style);
    MonitoreoComponent.iwStylesInstalled = true;
  }

  private buildInfoHtml(item: any): string {
    const name = item?.nombre ?? item?.nombreInstalacion ?? 'Instalación';
    const enc = item?.nombreEncargado ?? '';
    const dir = item?.direccion ?? '';

    return `
    <div style="
      background:#151f35; color:#e5e7eb;
      padding:0px 18px 16px;
      border-radius:12px; min-width:260px; max-width:320px; line-height:1.25rem;
      box-shadow:0 12px 28px rgba(0,0,0,.20);
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px;">
        <h6 style="margin:0;font-size:1rem;font-weight:700;color:#fff;">${name}</h6>
        <button class="iw-close" aria-label="Cerrar" style="background:transparent;border:0;cursor:pointer;color:#fff;font-size:18px;line-height:1;width:28px;height:28px;border-radius:8px;">✕</button>
      </div>
      <div style="color:#c6cfde;margin:0 0 4px;font-size:.875rem;">
        Encargado: <strong>${enc}</strong>
      </div>
      <div style="display:flex;gap:.5rem;align-items:flex-start;color:#c6cfde;">
        <span style="margin-top:4px;width:8px;height:8px;border-radius:999px;background:var(--mat-sys-primary,#681330);display:inline-block;flex:0 0 8px;"></span>
        <span>${dir}</span>
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
    <div style="
      background:#151f35; color:#e5e7eb;
      padding:0px 18px 16px;
      border-radius:12px; min-width:260px; max-width:320px; line-height:1.25rem;
      box-shadow:0 12px 28px rgba(0,0,0,.20);
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px;">
        <h6 style="margin:0;font-size:1rem;font-weight:700;color:#fff;">Equipo: ${numeroSerie}</h6>
        <button class="iw-close" aria-label="Cerrar" style="background:transparent;border:0;cursor:pointer;color:#fff;font-size:18px;line-height:1;width:28px;height:28px;border-radius:8px;">✕</button>
      </div>
      <hr style="border:none;height:1px;background:rgba(255,255,255,.10);margin:6px 0;" />
      <div style="display:grid;grid-template-columns:1fr;gap:4px;font-size:.85rem;color:#c6cfde;">
        ${nroPisoHtml}
        ${nombreDepartamentoHtml}
        <div><strong>Encargado:</strong> ${c?.nombreEncargado ?? '—'}</div>
        <div><strong>Cliente:</strong> ${c?.nombreCliente ?? '—'}</div>
        <div>
          <strong>Estatus:</strong>
          <span style="
            display:inline-block;padding:2px 8px;margin-left:6px;border-radius:999px;
            background:${estatusOk ? '#16a34a' : '#ef4444'}; color:#fff; font-weight:600; font-size:.78rem;">
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
          border-radius:10px; padding:8px 12px; font-size:.85rem; font-weight:600;
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
