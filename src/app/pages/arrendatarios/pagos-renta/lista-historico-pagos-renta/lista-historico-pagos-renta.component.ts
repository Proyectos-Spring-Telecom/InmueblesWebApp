import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { finalize, take } from 'rxjs/operators';
import Swal from 'sweetalert2';
import {
  contractDimAnim,
  contractModalAnim,
  routeAnimation,
} from 'src/app/pipe/module-open.animation';
import { formatearFechaHora } from '../../../inmuebles/inmuebles-list.mapper';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import { HistoricoPagosRentaService } from 'src/app/services/moduleService/historico-pagos-renta.service';
import {
  etiquetaContratoArrendatarioApi,
  extraerFilasPaginadasApi,
  nombreArrendatarioDesdeApi,
  resolverIdArrendatarioApi,
} from '../../arrendatarios-list.mapper';
import {
  extraerFilasHistoricoPagosRentaApi,
  extraerHistoricoPagoRentaDetalleApi,
  HistoricoPagoRentaGridRow,
  mapHistoricoPagoRentaApiToGridRow,
} from './historico-pagos-renta-list.mapper';

interface SelectOpcion {
  id: number;
  label: string;
}

interface HistoricoDetalleCampo {
  etiqueta: string;
  valor: string;
  dinero?: boolean;
}

interface HistoricoDetalleVista {
  id: number;
  arrendatario: string;
  contrato: string;
  periodo: string;
  montoFinalFmt: string;
  desglose: {
    rentaFmt: string;
    mantenimientoFmt: string;
    muestraRenta: boolean;
    muestraMantenimiento: boolean;
  };
  campos: HistoricoDetalleCampo[];
}

@Component({
  selector: 'app-lista-historico-pagos-renta',
  templateUrl: './lista-historico-pagos-renta.component.html',
  styleUrl: './lista-historico-pagos-renta.component.scss',
  standalone: false,
  animations: [routeAnimation, contractDimAnim, contractModalAnim],
})
export class ListaHistoricoPagosRentaComponent implements OnInit {
  embebidoEnHub = false;
  listaHistorico!: InstanceType<typeof CustomStore>;
  showFilterRow = true;
  showHeaderFilter = true;
  loading = false;
  pageSize = 20;
  paginaActual = 1;
  totalRegistros = 0;
  totalPaginas = 0;
  paginaActualData: HistoricoPagoRentaGridRow[] = [];
  filtroActivo = '';
  mensajeAgrupar =
    'Arrastre un encabezado de columna aquí para agrupar por dicha columna';
  autoExpandAllGroups = true;

  fechaInicioFiltro = '';
  fechaFinFiltro = '';
  idArrendatarioFiltro: number | null = null;
  idContratoFiltro: number | null = null;
  arrendatariosOpciones: SelectOpcion[] = [];
  contratosOpciones: SelectOpcion[] = [];
  catalogosFiltroCargando = false;
  private arrendatariosCatalogo: Record<string, unknown>[] = [];

  mostrarModalDetalle = false;
  detalleModalCargando = false;
  detalleModalError = '';
  detalleHistoricoVista: HistoricoDetalleVista | null = null;

  @ViewChild('gridContainer', { static: false })
  dataGrid!: DxDataGridComponent;

  constructor(
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private historicoPagosRentaService: HistoricoPagosRentaService,
    private arrendatariosService: ArrendatariosService,
  ) {}

  ngOnInit(): void {
    this.embebidoEnHub = this.leerEmbebidoEnHub();
    const rango = this.rangoFechasPorDefecto();
    this.fechaInicioFiltro = rango.inicio;
    this.fechaFinFiltro = rango.fin;
    this.setupDataSource();
    this.cargarCatalogosFiltro();
  }

  private cargarCatalogosFiltro(): void {
    this.catalogosFiltroCargando = true;
    void lastValueFrom(this.arrendatariosService.obtenerArrendatariosPaginated(1, 300))
      .then((resp) => {
        this.arrendatariosCatalogo = extraerFilasPaginadasApi(resp);
        this.arrendatariosOpciones = this.arrendatariosCatalogo
          .map((r) => {
            const id = resolverIdArrendatarioApi(r);
            if (id == null) return null;
            const nombre = nombreArrendatarioDesdeApi(r);
            return { id, label: nombre || `Arrendatario #${id}` };
          })
          .filter((x): x is SelectOpcion => x != null);
        this.sincronizarContratosFiltro(this.idArrendatarioFiltro);
      })
      .catch((err) => console.error('Error catálogos filtro histórico:', err))
      .finally(() => {
        this.catalogosFiltroCargando = false;
        this.cdr.markForCheck();
      });
  }

  onArrendatarioFiltroChange(): void {
    this.sincronizarContratosFiltro(this.idArrendatarioFiltro);
    this.cdr.markForCheck();
  }

  private sincronizarContratosFiltro(idArrendatario: number | null): void {
    const id = Number(idArrendatario);
    if (!Number.isFinite(id) || id <= 0) {
      this.contratosOpciones = [];
      this.idContratoFiltro = null;
      return;
    }
    const item = this.arrendatariosCatalogo.find(
      (r) => resolverIdArrendatarioApi(r) === Math.floor(id),
    );
    const contratos = Array.isArray(item?.['contratos'])
      ? (item['contratos'] as unknown[])
      : [];
    this.contratosOpciones = contratos
      .map((raw) => {
        if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
        const c = raw as Record<string, unknown>;
        const idContrato = Number(c['id'] ?? c['idContrato']);
        if (!Number.isFinite(idContrato) || idContrato <= 0) return null;
        return {
          id: Math.floor(idContrato),
          label: etiquetaContratoArrendatarioApi(c),
        };
      })
      .filter((x): x is SelectOpcion => x != null);

    const actual = Number(this.idContratoFiltro);
    if (!this.contratosOpciones.some((o) => o.id === actual)) {
      this.idContratoFiltro = null;
    }
  }

  textoPlaceholderContratoFiltro(): string {
    const idArr = Number(this.idArrendatarioFiltro);
    if (!Number.isFinite(idArr) || idArr <= 0) {
      return 'Seleccione arrendatario primero';
    }
    return this.contratosOpciones.length ? 'Todos los contratos' : 'Sin contratos';
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

  setupDataSource(): void {
    this.loading = true;
    this.listaHistorico = new CustomStore({
      key: 'id',
      load: async (loadOptions: { take?: number; skip?: number }) => {
        const take = Number(loadOptions?.take) || this.pageSize || 20;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;
        try {
          const resp = (await lastValueFrom(
            this.historicoPagosRentaService.obtenerHistoricoPaginado({
              page,
              limit: take,
              fechaInicio: this.fechaInicioFiltro,
              fechaFin: this.fechaFinFiltro,
              idArrendatario: this.idArrendatarioFiltro,
              idContrato: this.idContratoFiltro,
            }),
          )) as Record<string, unknown>;
          this.loading = false;
          const rowsRaw = extraerFilasHistoricoPagosRentaApi(resp);
          const meta =
            resp?.['paginated'] != null && typeof resp['paginated'] === 'object'
              ? (resp['paginated'] as Record<string, unknown>)
              : {};
          const totalRegistros =
            toNum(meta['total']) ?? toNum(resp?.['total']) ?? rowsRaw.length;
          const paginaActual = toNum(meta['page']) ?? toNum(resp?.['page']) ?? page;
          const totalPaginas =
            toNum(meta['lastPage']) ??
            toNum(resp['pages']) ??
            Math.max(1, Math.ceil(totalRegistros / take));

          const dataTransformada = rowsRaw
            .map((item) => mapHistoricoPagoRentaApiToGridRow(item))
            .filter((r): r is HistoricoPagoRentaGridRow => r != null);

          this.totalRegistros = totalRegistros;
          this.paginaActual = paginaActual;
          this.totalPaginas = totalPaginas;
          this.paginaActualData = dataTransformada;

          return { data: dataTransformada, totalCount: totalRegistros };
        } catch (err) {
          this.loading = false;
          console.error('Error al cargar histórico de pagos de renta:', err);
          return { data: [], totalCount: 0 };
        }
      },
    });

    function toNum(v: unknown): number | null {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
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
    this.dataGrid?.instance?.pageIndex(0);
    this.dataGrid?.instance?.refresh();
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
      grid?.option('dataSource', this.listaHistorico);
      return;
    }
    this.filtroActivo = texto;
    const dataFiltrada = (this.paginaActualData || []).filter((row) => {
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
    grid?.option('dataSource', dataFiltrada);
  }

  limpiarVista(): void {
    const rango = this.rangoFechasPorDefecto();
    this.fechaInicioFiltro = rango.inicio;
    this.fechaFinFiltro = rango.fin;
    this.idArrendatarioFiltro = null;
    this.idContratoFiltro = null;
    this.sincronizarContratosFiltro(null);
    const inst = this.dataGrid?.instance;
    if (!inst) return;
    inst.clearFilter();
    inst.clearGrouping();
    inst.pageIndex(0);
    inst.option('searchPanel.text', '');
    this.filtroActivo = '';
    inst.option('dataSource', this.listaHistorico);
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

  verDetalleHistorico(row: HistoricoPagoRentaGridRow): void {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;

    this.mostrarModalDetalle = true;
    this.detalleModalCargando = true;
    this.detalleModalError = '';
    this.detalleHistoricoVista = this.construirVistaDetalle(row, row.detalle);
    this.cdr.markForCheck();

    this.historicoPagosRentaService.obtenerHistoricoPorId(Math.floor(id))
      .pipe(
        take(1),
        finalize(() => {
          this.detalleModalCargando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (resp) => {
          const det = extraerHistoricoPagoRentaDetalleApi(resp);
          const fila = (det && mapHistoricoPagoRentaApiToGridRow(det)) ?? row;
          this.detalleHistoricoVista = this.construirVistaDetalle(
            fila,
            det ?? row.detalle,
          );
        },
        error: (err) => {
          console.error(err);
          this.detalleModalError = this.mensajeErrorHttp(err);
        },
      });
  }

  cerrarModalDetalle(): void {
    this.mostrarModalDetalle = false;
    this.detalleModalCargando = false;
    this.detalleModalError = '';
    this.detalleHistoricoVista = null;
    this.cdr.markForCheck();
  }

  private construirVistaDetalle(
    row: HistoricoPagoRentaGridRow,
    det: Record<string, unknown>,
  ): HistoricoDetalleVista {
    const campos: HistoricoDetalleCampo[] = [
      { etiqueta: 'Periodo', valor: row.mesLabel || '—' },
      { etiqueta: 'Registro', valor: row.fhRegistroFmt || '—' },
      { etiqueta: 'Total', valor: row.totalFmt || '—', dinero: true },
      { etiqueta: 'Factor variable', valor: row.factorVariableFmt || '—' },
      { etiqueta: 'Fórmula', valor: row.formulaLabel || '—' },
      { etiqueta: 'Usó fórmula', valor: row.ocupoFormulaLabel || '—' },
    ];

    const fhPago = formatearFechaHora(String(det['fhPago'] ?? det['fechaPago'] ?? ''));
    if (fhPago) {
      campos.splice(2, 0, { etiqueta: 'Fecha de pago', valor: fhPago });
    }

    const idArr = det['idArrendatario'];
    const idCon = det['idContrato'] ?? det['id_contrato'];
    if (idArr != null) {
      campos.push({ etiqueta: 'ID arrendatario', valor: String(idArr) });
    }
    if (idCon != null) {
      campos.push({ etiqueta: 'ID contrato', valor: String(idCon) });
    }

    const desgloseVm = row.desgloseVm;

    return {
      id: row.id,
      arrendatario: row.arrendatarioLabel || '—',
      contrato: row.contratoLabel || '—',
      periodo: row.mesLabel || '—',
      montoFinalFmt: row.montoFinalFmt || '—',
      desglose: {
        rentaFmt: desgloseVm?.rentaFmt ?? '—',
        mantenimientoFmt: desgloseVm?.mantenimientoFmt ?? '—',
        muestraRenta: desgloseVm?.muestraRenta ?? false,
        muestraMantenimiento: desgloseVm?.muestraMantenimiento ?? false,
      },
      campos,
    };
  }

  private leerEmbebidoEnHub(): boolean {
    let actual: ActivatedRoute | null = this.route;
    while (actual) {
      if (actual.snapshot.data['hubEmbebido']) return true;
      actual = actual.parent;
    }
    return false;
  }

  private mensajeErrorHttp(err: unknown): string {
    const e = err as {
      error?: string | { message?: string; mensaje?: string };
      message?: string;
    };
    const body = e?.error;
    if (typeof body === 'string' && body.trim()) return body;
    if (body != null && typeof body === 'object') {
      const m = (body as { message?: string; mensaje?: string }).message ??
        (body as { message?: string; mensaje?: string }).mensaje;
      if (m) return String(m);
    }
    return e?.message?.trim() || 'Error de comunicación con el servidor.';
  }
}
