import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { finalize } from 'rxjs/operators';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { HistoricoPagosRentaService } from 'src/app/services/moduleService/historico-pagos-renta.service';
import {
  extraerFilasRentRolApi,
  extraerMetaPaginacionRentRol,
  mapHistoricoPagoRentaToRentRolRow,
  RentRolRow,
} from './rent-rol-list.mapper';

@Component({
  selector: 'app-rent-rol',
  templateUrl: './rent-rol.component.html',
  styleUrl: './rent-rol.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class RentRolComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly REGISTROS_POR_PAGINA = 20;

  @ViewChild('kpiFloat') private kpiFloatRef?: ElementRef<HTMLElement>;
  @ViewChild('kpiSlot') private kpiSlotRef?: ElementRef<HTMLElement>;

  kpiAltura = 0;
  kpiFloatStyle: Record<string, string> = { visibility: 'hidden' };

  paginaActual$ = 1;
  totalRegistros = 0;
  totalPaginasApi = 1;
  cargando = false;

  fechaInicioFiltro = '';
  fechaFinFiltro = '';

  registros: RentRolRow[] = [];

  private scrollEl: HTMLElement | null = null;
  private shellResizeObserver: ResizeObserver | null = null;
  private rafId = 0;
  private readonly onScrollKpi = () => this.programarSyncKpi();
  private readonly onResizeKpi = () => this.programarSyncKpi();

  constructor(private historicoPagosRentaService: HistoricoPagosRentaService) {}

  get totalPaginas(): number {
    return this.totalPaginasApi;
  }

  get paginaInicio(): number {
    return (this.paginaActual$ - 1) * this.REGISTROS_POR_PAGINA;
  }

  get paginaFin(): number {
    return Math.min(this.paginaInicio + this.registros.length, this.totalRegistros);
  }

  get paginaActual(): RentRolRow[] {
    return this.registros;
  }

  get paginas(): number[] {
    const total = this.totalPaginas;
    const actual = this.paginaActual$;
    const delta = 2;
    const range: number[] = [];

    for (let i = Math.max(2, actual - delta); i <= Math.min(total - 1, actual + delta); i++) {
      range.push(i);
    }

    if (actual - delta > 2) range.unshift(-1);
    if (actual + delta < total - 1) range.push(-1);

    range.unshift(1);
    if (total > 1) range.push(total);

    return [...new Set(range)];
  }

  claseFilaRenta(r: RentRolRow): string {
    if (r.tieneIncrementoRenta) return 'row-estatus--incremento';
    if (r.pagada) return 'row-estatus--pagada';
    return 'row-estatus--neutral';
  }

  claseFilaMantenimiento(r: RentRolRow): string {
    if (r.tieneIncrementoMantenimiento) return 'row-estatus--incremento';
    if (r.pagada) return 'row-estatus--pagada';
    return 'row-estatus--neutral';
  }

  irPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas && p !== this.paginaActual$) {
      this.paginaActual$ = p;
      this.cargarRegistros();
      this.scrollEl?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  anterior(): void {
    this.irPagina(this.paginaActual$ - 1);
  }

  siguiente(): void {
    this.irPagina(this.paginaActual$ + 1);
  }

  irPrimera(): void {
    this.irPagina(1);
  }

  irUltima(): void {
    this.irPagina(this.totalPaginas);
  }

  get totalRenta(): number {
    return Math.round(this.registros.reduce((s, r) => s + r.renta.subTotal, 0) * 100) / 100;
  }

  get totalIvaRenta(): number {
    return Math.round(this.registros.reduce((s, r) => s + r.renta.iva, 0) * 100) / 100;
  }

  get totalRentaConIva(): number {
    return Math.round(this.registros.reduce((s, r) => s + r.renta.montoFinal, 0) * 100) / 100;
  }

  get totalMantto(): number {
    return Math.round(this.registros.reduce((s, r) => s + r.mantenimiento.subTotal, 0) * 100) / 100;
  }

  get totalIvaMantto(): number {
    return Math.round(this.registros.reduce((s, r) => s + r.mantenimiento.iva, 0) * 100) / 100;
  }

  get totalManttoConIva(): number {
    return Math.round(this.registros.reduce((s, r) => s + r.mantenimiento.montoFinal, 0) * 100) / 100;
  }

  get granTotal(): number {
    return Math.round((this.totalRentaConIva + this.totalManttoConIva) * 100) / 100;
  }

  ngOnInit(): void {
    const rango = this.rangoFechasPorDefecto();
    this.fechaInicioFiltro = rango.inicio;
    this.fechaFinFiltro = rango.fin;
    this.cargarRegistros();
  }

  ngAfterViewInit(): void {
    this.scrollEl = document.querySelector('.layout-content-scroll');

    const shell = this.kpiFloatRef?.nativeElement?.querySelector('.rr-kpi-shell');
    if (shell instanceof HTMLElement && typeof ResizeObserver !== 'undefined') {
      this.shellResizeObserver = new ResizeObserver(() => this.programarSyncKpi());
      this.shellResizeObserver.observe(shell);
    }

    this.scrollEl?.addEventListener('scroll', this.onScrollKpi, { passive: true });
    window.addEventListener('resize', this.onResizeKpi, { passive: true });
    setTimeout(() => this.syncKpiFloat());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    this.scrollEl?.removeEventListener('scroll', this.onScrollKpi);
    window.removeEventListener('resize', this.onResizeKpi);
    this.shellResizeObserver?.disconnect();
  }

  private programarSyncKpi(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => this.syncKpiFloat());
  }

  private syncKpiFloat(): void {
    const slot = this.kpiSlotRef?.nativeElement;
    const float = this.kpiFloatRef?.nativeElement;
    const scroll = this.scrollEl;
    if (!slot || !float || !scroll) return;

    const shell = float.querySelector('.rr-kpi-shell');
    const altura = shell instanceof HTMLElement ? shell.offsetHeight : 0;
    if (altura > 0) {
      this.kpiAltura = altura;
    }

    const scrollRect = scroll.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const topeFlotante = scrollRect.top;
    const top = Math.max(slotRect.top, topeFlotante);

    this.kpiFloatStyle = {
      position: 'fixed',
      top: `${top}px`,
      left: `${slotRect.left}px`,
      width: `${slotRect.width}px`,
      zIndex: '120',
      visibility: 'visible',
    };
  }

  private rangoFechasPorDefecto(): { inicio: string; fin: string } {
    const hoy = new Date();
    const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
    return {
      inicio: this.toIsoFecha(inicioAnio),
      fin: this.toIsoFecha(hoy),
    };
  }

  private toIsoFecha(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private cargarRegistros(): void {
    this.cargando = true;
    this.historicoPagosRentaService
      .obtenerHistoricoPaginado({
        page: this.paginaActual$,
        limit: this.REGISTROS_POR_PAGINA,
        fechaInicio: this.fechaInicioFiltro,
        fechaFin: this.fechaFinFiltro,
      })
      .pipe(
        finalize(() => {
          this.cargando = false;
          setTimeout(() => this.syncKpiFloat());
        }),
      )
      .subscribe({
        next: (resp) => {
          const rowsRaw = extraerFilasRentRolApi(resp);
          const meta = extraerMetaPaginacionRentRol(
            resp,
            this.paginaActual$,
            this.REGISTROS_POR_PAGINA,
          );
          this.totalRegistros = meta.total;
          this.totalPaginasApi = meta.totalPaginas;
          this.paginaActual$ = meta.page;
          this.registros = rowsRaw
            .map((item) => mapHistoricoPagoRentaToRentRolRow(item))
            .filter((r): r is RentRolRow => r != null);
        },
        error: (err) => {
          console.error('Error al cargar rent-rol:', err);
          this.registros = [];
          this.totalRegistros = 0;
          this.totalPaginasApi = 1;
        },
      });
  }
}
