import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnInit,
  ViewChild,
} from '@angular/core';
import { DxDataGridComponent } from 'devextreme-angular';
import { io, Socket } from 'socket.io-client';
import { ActivatedRoute, Router } from '@angular/router';

import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { InstalacionCentral } from 'src/app/services/moduleService/instalacionesCentral.service';
import { SocketService } from 'src/app/services/moduleService/socket.service';
import { environment } from 'src/environments/environment.prod';

@Component({
  selector: 'app-monitoreo-instalacion',
  templateUrl: './monitoreo-instalacion.component.html',
  styleUrl: './monitoreo-instalacion.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class MonitoreoInstalacionComponent implements OnInit {
  now = new Date();

  numeroSerie: string = '';

  hit = {
    genero: '',
    edad: null as number | null,
    estado: '',
    id: null as number | null,
  };
  hitFecha: Date | null = null;
  hitFechaLabel: string | null = null;

  totalPersonas = 0;
  totalHombres = 0;
  totalMujeres = 0;

  mensajeAgrupar =
    'Arrastre un encabezado de columna aquí para agrupar por esa columna';
  loading = false;
  loadingMessage = 'Cargando...';

  fechaInicio: Date = new Date();
  fechaFin: Date = new Date();

  ultimoHit: any = null;
  totalFiltrado = 0;

  private page = 1;
  private limit = 200;

  chartHits = [
    { grupo: 'Hombres', valor: 0, colors: 2 },
    { grupo: 'Mujeres', valor: 0, colors: 1 },
  ];

  chartEdadesAmbos = [
    { rango: '0 - 20', valor: 0, color: 1 },
    { rango: '21 - 40', valor: 0, color: 2 },
    { rango: '41 - 60', valor: 0, color: 3 },
    { rango: '61+', valor: 0, color: 4 },
  ];

  chartEdadesMujeres = [
    { rango: '0 - 20', valor: 0, color: 1 },
    { rango: '21 - 40', valor: 0, color: 2 },
    { rango: '41 - 60', valor: 0, color: 3 },
    { rango: '61+', valor: 0, color: 4 },
  ];

  chartEdadesHombres = [
    { rango: '0 - 20', valor: 0, color: 1 },
    { rango: '21 - 40', valor: 0, color: 2 },
    { rango: '41 - 60', valor: 0, color: 3 },
    { rango: '61+', valor: 0, color: 4 },
  ];

  hitsPorHora = [{ hora: '00:00', hombres: 0, mujeres: 0 }];

  registros: any[] = [];
  @ViewChild('gridRef', { static: false }) gridRef: DxDataGridComponent;

  private socket!: Socket;
  constructor(
    private incidencias: InstalacionCentral,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private route: ActivatedRoute,
    private router: Router
  ) { }  

  regresar(){
    window.history.back();
  }

  ngOnInit(): void {
    this.numeroSerie = this.route.snapshot.paramMap.get('numeroSerie') ?? '';

    if (!this.numeroSerie) {
      console.error('No se recibió numeroSerie en la ruta');
      return;
    }

    // Fecha fin: hoy a la hora actual
    this.fechaFin = new Date();
    
    // Fecha inicio: hoy a las 00:00:00
    this.fechaInicio = new Date();
    this.fechaInicio.setHours(0, 0, 0, 0);

    this.socket = io('https://springtelecom.mx/api/incidencias', {
      path: '/analiticaVideoAPI/socket.io',
      transports: ['polling'],
      upgrade: false,
      withCredentials: false,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Conectado al namespace /incidencias', this.socket.id);
      console.log('📡 Socket conectado, escuchando eventos...');
    });

    this.socket.on('connect_error', (e) => {
      console.error('❌ Error de conexión:', e);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Desconectado:', reason);
    });

    this.socket.on('nueva-incidencia', (incidencia) => {
      this.cargarHoy();
      this.cargarUltimoHit();
      this.consultar();
      console.log('🔔 Nueva incidencia recibida:', incidencia);
    });

    this.socket.onAny((eventName, ...args) => {
      console.log('📨 Evento recibido:', eventName, args);
    });

    this.cargarHoy();
    this.cargarUltimoHit();
    this.consultar();
  }

  private cargarUltimoHit(): void {
    if (!this.numeroSerie) return;

    this.incidencias.ultimoHit(this.numeroSerie).subscribe({
      next: (resp: any) => {
        const u = this.normalizeItem(resp);

        this.hit = {
          genero: u.genero,
          edad: u.edad,
          estado: u.estado,
          id: u.id,
        };
        this.hitFecha = u.fechaHora ?? null;
        this.hitFechaLabel = this.formatFechaLabel(u.fechaRaw);

        const newKey = this.hitKey(u);
        const isNew =
          this.currentHitKey !== null && newKey !== this.currentHitKey;
        this.currentHitKey = newKey;

        if (isNew) {
          this.activarHighlight(u.genero);
          this.playNewHitSound();
        }

        this.cdr.detectChanges();
      },
      error: () => { },
    });
  }

  consultar(): void {
    if (!this.numeroSerie) return;

    if (!this.fechaFin) {
      this.fechaFin = new Date();
    }
    if (!this.fechaInicio) {
      this.fechaInicio = new Date(this.fechaFin);
      this.fechaInicio.setDate(this.fechaFin.getDate() - 7);
    }

    const fi = this.fmt(this.fechaInicio);
    const ff = this.fmt(this.fechaFin);
    this.loading = true;
    this.incidencias
      .rangoPaginado(this.numeroSerie, fi, ff, this.page, this.limit)
      .subscribe({
        next: (resp: any) => {
          const items = this.pickArray(resp);
          const regs = items.map(this.normalizeItem);
          this.registros = regs;
          this.totalFiltrado = Number(resp?.total ?? regs.length);
          
          // Si el backend devuelve datos agregados, usarlos (como en cargarHoy)
          if (resp?.totales) {
            this.totalPersonas = Number(resp.totales.total ?? this.totalPersonas);
            this.totalHombres = Number(resp.totales.hombres ?? this.totalHombres);
            this.totalMujeres = Number(resp.totales.mujeres ?? this.totalMujeres);
            this.chartHits = [
              { grupo: 'Hombres', valor: this.totalHombres, colors: 2 },
              { grupo: 'Mujeres', valor: this.totalMujeres, colors: 1 },
            ];
          } else {
            // Si no hay totales del backend, recalcular desde registros
            this.recalcularDesdeRegistros(regs);
          }
          
          // Actualizar gráficas de edades si vienen del backend
          if (Array.isArray(resp?.edadesAmbos)) {
            this.chartEdadesAmbos = this.ensureEdadShape(resp.edadesAmbos);
          } else {
            // Si no vienen del backend, ya se calcularon en recalcularDesdeRegistros
          }
          
          if (Array.isArray(resp?.edadesMujeres)) {
            this.chartEdadesMujeres = this.ensureEdadShape(resp.edadesMujeres);
          }
          
          if (Array.isArray(resp?.edadesHombres)) {
            this.chartEdadesHombres = this.ensureEdadShape(resp.edadesHombres);
          }
          
          // Actualizar gráfica de hits por hora si viene del backend
          if (Array.isArray(resp?.hitsPorHora)) {
            this.hitsPorHora = this.normalizarHoras(resp.hitsPorHora);
          } else {
            // Si no viene del backend, ya se calculó en recalcularDesdeRegistros
          }
          
          // Si no hay datos agregados del backend, recalcular todo desde registros
          if (!resp?.totales && !Array.isArray(resp?.edadesAmbos) && !Array.isArray(resp?.hitsPorHora)) {
            this.recalcularDesdeRegistros(regs);
          }
        },
        error: () => { },
        complete: () => (this.loading = false),
      });
  }

  private cargarHoy(): void {
    if (!this.numeroSerie) return;

    this.loading = true;
    this.incidencias.hoy(this.numeroSerie).subscribe({
      next: (resp: any) => {
        const items = this.pickArray(resp);
        const regs = items.map(this.normalizeItem);
        this.registros = regs;
        this.totalFiltrado = Number(resp?.total ?? regs.length);
        this.recalcularDesdeRegistros(regs);

        if (resp?.totales) {
          this.totalPersonas = Number(resp.totales.total ?? this.totalPersonas);
          this.totalHombres = Number(resp.totales.hombres ?? this.totalHombres);
          this.totalMujeres = Number(resp.totales.mujeres ?? this.totalMujeres);
          this.chartHits = [
            { grupo: 'Hombres', valor: this.totalHombres, colors: 2 },
            { grupo: 'Mujeres', valor: this.totalMujeres, colors: 1 },
          ];
        }
        if (Array.isArray(resp?.hitsPorHora))
          this.hitsPorHora = this.normalizarHoras(resp.hitsPorHora);
        if (Array.isArray(resp?.edadesAmbos))
          this.chartEdadesAmbos = this.ensureEdadShape(resp.edadesAmbos);
        if (Array.isArray(resp?.edadesMujeres))
          this.chartEdadesMujeres = this.ensureEdadShape(resp.edadesMujeres);
        if (Array.isArray(resp?.edadesHombres))
          this.chartEdadesHombres = this.ensureEdadShape(resp.edadesHombres);
      },
      error: () => { },
      complete: () => (this.loading = false),
    });
  }

  colorEstado: 'default' | 'hombre' | 'mujer' = 'default';
  highlightActive = false;

  private highlightTimer: any;
  private currentHitKey: string | null = null;

  private hitKey(u: any): string {
    return `${u?.id ?? 'x'}-${u?.fechaRaw ?? ''}`;
  }

  private generoToEstado(g?: string | null): 'default' | 'hombre' | 'mujer' {
    const s = (g || '').trim().toLowerCase();
    if (s === 'hombre' || s === 'masculino') return 'hombre';
    if (s === 'mujer' || s === 'femenino') return 'mujer';
    return 'default';
  }

  private activarHighlight(genero?: string | null): void {
    clearTimeout(this.highlightTimer);
    this.colorEstado = this.generoToEstado(genero);
    this.highlightActive = this.colorEstado !== 'default';
    this.cdr.markForCheck();

    this.highlightTimer = setTimeout(() => {
      this.highlightActive = false;
      this.colorEstado = 'default';
      this.cdr.markForCheck();
    }, 5000);
  }

  private playNewHitSound(): void {
    try {
      const a = new Audio('assets/images/notificacaion.mp3');
      a.volume = 0.8;
      a.play().catch(() => { });
    } catch { }
  }


  /** Tooltip: Conteo de hits por hora (barras apiladas). */
  customizePoint = (p: any) => {
    if (p?.seriesName === 'Mujeres') return { color: '#f87171' };
    if (p?.seriesName === 'Hombres') return { color: '#0ea5e9' };
    switch (p?.data?.colors) {
      case 1:
        return { color: '#f87171' };
      case 2:
        return { color: '#0ea5e9' };
      default:
        return {};
    }
  };

  customizeEdadPoint = (p: any) => {
    const colorMap: any = {
      1: '#8e44ad',
      2: '#f39c12',
      3: '#16a085',
      4: '#c0392b',
    };
    return { color: colorMap[p.data.color] || '#7f8c8d' };
  };

  customizeEdadMujeresPoint = (p: any) => {
    const colorMap: any = {
      1: '#f87171',
      2: '#fb7185',
      3: '#fda4af',
      4: '#ef4444',
    };
    return { color: colorMap[p.data.color] || '#e1bee7' };
  };

  customizeEdadHombresPoint = (p: any) => {
    const colorMap: any = {
      1: '#06b6d4',
      2: '#0ea5e9',
      3: '#38bdf8',
      4: '#7dd3fc',
    };
    return { color: colorMap[p.data.color] || '#cfd8dc' };
  };

  pointClickHandler(e: any) {
    this.toggleVisibility(e?.target);
  }

  legendClickHandler(e: any) {
    const arg = e?.target;
    const cmp = e?.component;
    if (!arg || !cmp) return;
    const series = cmp.getAllSeries?.()[0];
    if (!series) return;
    const pts = series.getPointsByArg?.(arg) || [];
    const item = pts[0];
    if (item) this.toggleVisibility(item);
  }

  toggleVisibility(item: any) {
    if (!item?.isVisible || !item?.hide || !item?.show) return;
    item.isVisible() ? item.hide() : item.show();
  }

  edadText = (cellInfo: any) =>
    cellInfo?.value || cellInfo?.value === 0 ? `${cellInfo.value} Años` : '';

  private fmt(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private pickArray(resp: any): any[] {
    if (Array.isArray(resp)) return resp;
    if (Array.isArray(resp?.items)) return resp.items;
    if (Array.isArray(resp?.registros)) return resp.registros;
    if (Array.isArray(resp?.data)) return resp.data;
    return [];
  }

  private parseFecha(fecha: any): Date {
    if (fecha instanceof Date) return fecha;
    if (typeof fecha !== 'string') return new Date();
    const s = fecha.trim();
    const ts = Date.parse(s);
    if (!isNaN(ts)) return new Date(ts);
    const [dpart, tpart] = s.split(' ');
    const [ddS, mmS, yyS] = (dpart || '').split(/[\/\-]/);
    const dd = Number(ddS) || 1;
    const mm = (Number(mmS) || 1) - 1;
    const yyyy = Number(yyS) || new Date().getFullYear();
    let hh = 0,
      mi = 0,
      ss = 0;
    if (tpart) {
      const [hS, mS, sS] = tpart.split(':');
      hh = Number(hS) || 0;
      mi = Number(mS) || 0;
      ss = Number(sS) || 0;
    }
    return new Date(yyyy, mm, dd, hh, mi, ss);
  }

  private formatFechaLabel(fechaRaw: any): string | null {
    if (!fechaRaw) return null;
    const s = String(fechaRaw).trim();
    const [dpart, tpart = '00:00:00'] = s.split(' ');
    const [ddS, mmS, yyS] = dpart.split(/[\/\-]/);
    const dd = Number(ddS);
    const mm = Number(mmS);
    const yyyy = Number(yyS);
    const [hS, mS, sS] = tpart.split(':');
    if (!(dd && mm && yyyy)) return s;
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const hh = Number(hS || 0);
    const mi = Number(mS || 0);
    const ss = Number(sS || 0);
    const pad2 = (n: number) => String(n).padStart(2, '0');
    return `${pad2(dd)}-${meses[mm - 1]}-${yyyy} ${pad2(hh)}:${pad2(mi)}:${pad2(ss)}`;
  }

  private readonly ESTADOS_ANIMO = [
    'feliz', 'neutral', 'sorprendido', 'triste', 'molesto',
    'disgustado', 'asustado', 'despectivo',
  ] as const;

  private normalizeEstado(raw: string): string {
    const v = String(raw ?? '').trim().toLowerCase();
    if (!v) return '';
    const known = this.ESTADOS_ANIMO as readonly string[];
    const idx = known.indexOf(v);
    const base = idx >= 0 ? known[idx] : v;
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  private normalizeItem = (x: any) => {
    const g = String(x?.genero ?? '')
      .trim()
      .toLowerCase();
    const genero =
      g === 'hombre' ? 'Hombre' : g === 'mujer' ? 'Mujer' : x?.genero ?? '';
    const edad = x?.edad != null ? Number(x.edad) : null;
    const estado = this.normalizeEstado(x?.estado ?? x?.estadoAnimo ?? '');
    const id = x?.id != null ? Number(x.id) : null;
    const fechaRaw = (x?.fechaHora ?? x?.fecha ?? '').toString().trim();
    const fechaHora = fechaRaw ? this.parseFecha(fechaRaw) : null;
    return { genero, edad, estado, id, fechaRaw, fechaHora };
  };

  private recalcularDesdeRegistros(regs: any[]): void {
    this.totalPersonas = regs.length;
    this.totalHombres = regs.filter((r) => r.genero === 'Hombre').length;
    this.totalMujeres = regs.filter((r) => r.genero === 'Mujer').length;

    this.chartHits = [
      { grupo: 'Hombres', valor: this.totalHombres, colors: 2 },
      { grupo: 'Mujeres', valor: this.totalMujeres, colors: 1 },
    ];

    const ambos = { a: 0, b: 0, c: 0, d: 0 };
    const m = { a: 0, b: 0, c: 0, d: 0 };
    const h = { a: 0, b: 0, c: 0, d: 0 };

    for (const r of regs) {
      const bucket =
        r.edad <= 20 ? 'a' : r.edad <= 40 ? 'b' : r.edad <= 60 ? 'c' : 'd';
      if (bucket === 'a') ambos.a++;
      else if (bucket === 'b') ambos.b++;
      else if (bucket === 'c') ambos.c++;
      else ambos.d++;
      if (r.genero === 'Mujer') {
        if (bucket === 'a') m.a++;
        else if (bucket === 'b') m.b++;
        else if (bucket === 'c') m.c++;
        else m.d++;
      } else if (r.genero === 'Hombre') {
        if (bucket === 'a') h.a++;
        else if (bucket === 'b') h.b++;
        else if (bucket === 'c') h.c++;
        else h.d++;
      }
    }

    this.chartEdadesAmbos = [
      { rango: '0 - 20', valor: ambos.a, color: 1 },
      { rango: '21 - 40', valor: ambos.b, color: 2 },
      { rango: '41 - 60', valor: ambos.c, color: 3 },
      { rango: '61+', valor: ambos.d, color: 4 },
    ];

    this.chartEdadesMujeres = [
      { rango: '0 - 20', valor: m.a, color: 1 },
      { rango: '21 - 40', valor: m.b, color: 2 },
      { rango: '41 - 60', valor: m.c, color: 3 },
      { rango: '61+', valor: m.d, color: 4 },
    ];

    this.chartEdadesHombres = [
      { rango: '0 - 20', valor: h.a, color: 1 },
      { rango: '21 - 40', valor: h.b, color: 2 },
      { rango: '41 - 60', valor: h.c, color: 3 },
      { rango: '61+', valor: h.d, color: 4 },
    ];

    const mapaHoras: Record<string, { hombres: number; mujeres: number }> = {};
    for (const r of regs) {
      const d: Date =
        r.fechaHora instanceof Date
          ? r.fechaHora
          : this.parseFecha(r.fechaHora);
      const hh = String(d.getHours()).padStart(2, '0') + ':00';
      if (!mapaHoras[hh]) mapaHoras[hh] = { hombres: 0, mujeres: 0 };
      if (r.genero === 'Hombre') mapaHoras[hh].hombres++;
      else if (r.genero === 'Mujer') mapaHoras[hh].mujeres++;
    }
    const horas = Object.keys(mapaHoras).sort();
    this.hitsPorHora = horas.map((hh) => ({
      hora: hh,
      hombres: mapaHoras[hh].hombres,
      mujeres: mapaHoras[hh].mujeres,
    }));
  }

  private normalizarHoras(arr: any[]): any[] {
    return arr
      .map((x) => {
        const hora =
          typeof x?.hora === 'string'
            ? x.hora
            : x?.hour != null
              ? String(x.hour).padStart(2, '0') + ':00'
              : '00:00';
        const hombres = Number(x?.hombres ?? x?.male ?? 0);
        const mujeres = Number(x?.mujeres ?? x?.female ?? 0);
        return { hora, hombres, mujeres };
      })
      .sort((a, b) => a.hora.localeCompare(b.hora));
  }

  private ensureEdadShape(arr: any[]): any[] {
    const mapKey = (k: any) =>
      typeof k === 'number'
        ? k
        : (
          {
            '0-20': 1,
            '0 - 20': 1,
            '21-40': 2,
            '21 - 40': 2,
            '41-60': 3,
            '41 - 60': 3,
            '61+': 4,
          } as any
        )[k] || 1;
    return arr.map((x) => {
      const rango = x?.rango ?? x?.label ?? '';
      const valor = Number(x?.valor ?? x?.count ?? 0);
      const color = mapKey(x?.color ?? rango);
      return { rango, valor, color };
    });
  }

  onTooltipShown = (e: any) => {
    console.log('tooltipShown', e);
  };
  
  onTooltipHidden = (e: any) => {
    console.log('tooltipHidden', e);
  };
  
  customizeHitsTooltip = (arg: any) => {
    const etiqueta = arg?.argumentText ?? arg?.argument ?? '';
    const valor = arg?.valueText ?? `${arg?.value ?? 0}`;
    return { text: `${etiqueta}: ${valor}` };
  };

  customizeEdadTooltip = (arg: any) => {
    const etiqueta = arg?.argumentText ?? arg?.argument ?? '';
    const valor = arg?.valueText ?? `${arg?.value ?? 0}`;
    return { text: `${etiqueta}: ${valor}` };
  };

  customizeEdadMujeresTooltip = (arg: any) => {
    const etiqueta = arg?.argumentText ?? arg?.argument ?? '';
    const valor = arg?.valueText ?? `${arg?.value ?? 0}`;
    return { text: `Mujeres ${etiqueta}: ${valor} registros` };
  };

  customizeEdadHombresTooltip = (arg: any) => {
    const etiqueta = arg?.argumentText ?? arg?.argument ?? '';
    const valor = arg?.valueText ?? `${arg?.value ?? 0}`;
    return { text: `Hombres ${etiqueta}: ${valor} registros` };
  };

  customizeHitsPorHoraTooltip = (arg: any) => {
    const hora = arg?.argumentText ?? arg?.argument ?? '';
    const valor = arg?.valueText ?? `${arg?.value ?? 0}`;
    const genero = arg?.seriesName === 'Mujeres' ? 'Mujeres' : 'Hombres';
    return { text: `${genero} ${hora}: ${valor} registros` };
  };
  
}
