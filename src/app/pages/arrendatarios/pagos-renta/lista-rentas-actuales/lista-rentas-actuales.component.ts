import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DxDataGridComponent } from 'devextreme-angular';
import CustomStore from 'devextreme/data/custom_store';
import { lastValueFrom } from 'rxjs';
import { finalize, take } from 'rxjs/operators';
import Swal from 'sweetalert2';
import {
  contractDimAnim,
  contractModalAnim,
  rentaResumenRevealAnim,
  routeAnimation,
} from 'src/app/pipe/module-open.animation';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import { FormulasService } from 'src/app/services/moduleService/formulas.service';
import {
  formatearFecha,
  formatearMoneda,
  nombreArrendador,
} from '../../../inmuebles/inmuebles-list.mapper';
import {
  etiquetaContratoArrendatarioApi,
  extraerFilasPaginadasApi,
  nombreArrendatarioDesdeApi,
  resolverIdArrendatarioApi,
} from '../../arrendatarios-list.mapper';
import {
  RentaActualPostPayload,
  RentaActualPutPayload,
  RentaActualService,
} from 'src/app/services/moduleService/renta-actual.service';
import {
  extraerFilasRentasActualApi,
  extraerRentaActualDetalleApi,
  mapRentaActualApiToGridRow,
  RentaActualGridRow,
} from './renta-actual-list.mapper';

interface SelectOpcion {
  id: number;
  label: string;
}

interface RentaModalResumenCampo {
  etiqueta: string;
  valor: string;
  dinero?: boolean;
}

interface RentaModalResumenVm {
  listo: boolean;
  mensajeVacio: string;
  pagoAFavorDe: string;
  arrendatario: string;
  campos: RentaModalResumenCampo[];
}

@Component({
  selector: 'app-lista-rentas-actuales',
  templateUrl: './lista-rentas-actuales.component.html',
  styleUrl: './lista-rentas-actuales.component.scss',
  standalone: false,
  animations: [routeAnimation, contractDimAnim, contractModalAnim, rentaResumenRevealAnim],
})
export class ListaRentasActualesComponent implements OnInit {
  embebidoEnHub = false;
  listaRentas!: InstanceType<typeof CustomStore>;
  showFilterRow = true;
  showHeaderFilter = true;
  loading = false;
  pageSize = 20;
  paginaActual = 1;
  totalRegistros = 0;
  totalPaginas = 0;
  paginaActualData: RentaActualGridRow[] = [];
  filtroActivo = '';
  mensajeAgrupar =
    'Arrastre un encabezado de columna aquí para agrupar por dicha columna';
  autoExpandAllGroups = true;

  mostrarModalRenta = false;
  rentaModalModo: 'alta' | 'edicion' = 'alta';
  rentaEditId: number | null = null;
  rentaGuardando = false;
  rentaModalCargando = false;
  rentaForm!: FormGroup;

  arrendatariosOpciones: SelectOpcion[] = [];
  contratosOpciones: SelectOpcion[] = [];
  formulasOpciones: SelectOpcion[] = [];
  private arrendatariosCatalogo: Record<string, unknown>[] = [];
  catalogosModalCargando = false;
  resumenRentaModal: RentaModalResumenVm = this.resumenRentaModalVacio();

  @ViewChild('gridContainer', { static: false })
  dataGrid!: DxDataGridComponent;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private rentaActualService: RentaActualService,
    private arrendatariosService: ArrendatariosService,
    private formulasService: FormulasService,
  ) {}

  ngOnInit(): void {
    this.embebidoEnHub = this.leerEmbebidoEnHub();
    this.inicializarFormulario();
    this.setupDataSource();
  }

  private inicializarFormulario(): void {
    this.rentaForm = this.fb.group({
      idArrendatario: [null, Validators.required],
      idContrato: [null, Validators.required],
      total: [null, Validators.required],
      idFormula: [null, Validators.required],
      montoFinal: [null, Validators.required],
      factorVariable: [null, Validators.required],
      ocupoFormula: [0, Validators.required],
    });
    this.rentaForm.get('idArrendatario')?.valueChanges.subscribe((id) => {
      this.sincronizarContratosPorArrendatario(id);
      this.actualizarResumenRentaModal();
    });
    this.rentaForm.valueChanges.subscribe(() => this.actualizarResumenRentaModal());
  }

  private resumenRentaModalVacio(): RentaModalResumenVm {
    return {
      listo: false,
      mensajeVacio:
        'Selecciona arrendatario y contrato para ver a quién corresponde este pago.',
      pagoAFavorDe: '',
      arrendatario: '',
      campos: [],
    };
  }

  trackByResumenCampo(_index: number, campo: RentaModalResumenCampo): string {
    return campo.etiqueta;
  }

  private actualizarResumenRentaModal(): void {
    this.resumenRentaModal = this.construirResumenRentaModal();
    this.cdr.markForCheck();
  }

  setupDataSource(): void {
    this.loading = true;
    this.listaRentas = new CustomStore({
      key: 'id',
      load: async (loadOptions: { take?: number; skip?: number }) => {
        const take = Number(loadOptions?.take) || this.pageSize || 20;
        const skip = Number(loadOptions?.skip) || 0;
        const page = Math.floor(skip / take) + 1;
        try {
          const resp = (await lastValueFrom(
            this.rentaActualService.obtenerRentasPaginadas(page, take),
          )) as Record<string, unknown>;
          this.loading = false;
          const rowsRaw = extraerFilasRentasActualApi(resp);
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
            .map((item) => mapRentaActualApiToGridRow(item))
            .filter((r): r is RentaActualGridRow => r != null);

          this.totalRegistros = totalRegistros;
          this.paginaActual = paginaActual;
          this.totalPaginas = totalPaginas;
          this.paginaActualData = dataTransformada;

          return { data: dataTransformada, totalCount: totalRegistros };
        } catch (err) {
          this.loading = false;
          console.error('Error al cargar rentas actuales:', err);
          return { data: [], totalCount: 0 };
        }
      },
    });

    function toNum(v: unknown): number | null {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
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
      grid?.option('dataSource', this.listaRentas);
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
        String(row.id),
      ];
      return extras.some((s) => String(s).toLowerCase().includes(texto));
    });
    grid?.option('dataSource', dataFiltrada);
  }

  limpiarVista(): void {
    const inst = this.dataGrid?.instance;
    if (!inst) return;
    inst.clearFilter();
    inst.clearGrouping();
    inst.pageIndex(0);
    inst.option('searchPanel.text', '');
    this.filtroActivo = '';
    inst.option('dataSource', this.listaRentas);
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

  abrirModalAlta(): void {
    this.rentaModalModo = 'alta';
    this.rentaEditId = null;
    this.rentaForm.reset({
      idArrendatario: null,
      idContrato: null,
      total: null,
      idFormula: null,
      montoFinal: null,
      factorVariable: null,
      ocupoFormula: 0,
    });
    this.rentaForm.get('idArrendatario')?.enable();
    this.rentaForm.get('idContrato')?.enable();
    this.contratosOpciones = [];
    this.resumenRentaModal = this.resumenRentaModalVacio();
    this.mostrarModalRenta = true;
    this.cargarCatalogosModal();
    this.cdr.markForCheck();
  }

  abrirModalEdicion(row: RentaActualGridRow): void {
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;
    this.rentaModalModo = 'edicion';
    this.rentaEditId = Math.floor(id);
    this.mostrarModalRenta = true;
    this.rentaModalCargando = true;
    this.rentaForm.reset();
    this.rentaForm.get('idArrendatario')?.disable();
    this.rentaForm.get('idContrato')?.disable();
    this.resumenRentaModal = this.resumenRentaModalVacio();
    this.cargarCatalogosModal();
    this.cdr.markForCheck();

    this.rentaActualService.obtenerRentaPorId(this.rentaEditId)
      .pipe(
        take(1),
        finalize(() => {
          this.rentaModalCargando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (resp) => {
          const det = extraerRentaActualDetalleApi(resp);
          if (!det) return;
          const ocupoRaw = det['ocupoFormula'] ?? det['ocupo_formula'];
          const ocupo =
            ocupoRaw === true || ocupoRaw === 1 || ocupoRaw === '1' ? 1 : 0;
          this.rentaForm.patchValue({
            idArrendatario: Number(det['idArrendatario']) || null,
            idContrato: Number(det['idContrato']) || null,
            total: Number(det['total']),
            idFormula: Number(det['idFormula']) || null,
            montoFinal: Number(det['montoFinal'] ?? det['monto_final']),
            factorVariable: Number(
              det['factorVariable'] ?? det['factor_variable'],
            ),
            ocupoFormula: ocupo,
          });
          this.actualizarResumenRentaModal();
        },
        error: (err) => {
          console.error(err);
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'error',
            title: 'No se pudo cargar la renta',
            text: this.mensajeErrorHttp(err),
            confirmButtonText: 'Entendido',
          });
          this.cerrarModalRenta();
        },
      });
  }

  cerrarModalRenta(): void {
    this.mostrarModalRenta = false;
    this.rentaEditId = null;
    this.resumenRentaModal = this.resumenRentaModalVacio();
    this.cdr.markForCheck();
  }

  private construirResumenRentaModal(): RentaModalResumenVm {
    const vacio =
      'Selecciona arrendatario y contrato para ver a quién corresponde este pago.';
    const raw = this.rentaForm?.getRawValue() ?? {};
    const idArr = Number(raw['idArrendatario']);
    const idCon = Number(raw['idContrato']);

    if (!Number.isFinite(idArr) || idArr <= 0) {
      return {
        listo: false,
        mensajeVacio: vacio,
        pagoAFavorDe: '',
        arrendatario: '',
        campos: [],
      };
    }

    const item = this.arrendatariosCatalogo.find(
      (r) => resolverIdArrendatarioApi(r) === Math.floor(idArr),
    );
    const arrendatarioNombre = item
      ? nombreArrendatarioDesdeApi(item)
      : this.etiquetaOpcion(this.arrendatariosOpciones, idArr);

    if (!Number.isFinite(idCon) || idCon <= 0) {
      return {
        listo: false,
        mensajeVacio: 'Selecciona un contrato para completar el resumen del pago.',
        pagoAFavorDe: item ? this.nombreArrendadorPago(item, null) : '',
        arrendatario: arrendatarioNombre || '—',
        campos: [],
      };
    }

    const contrato = this.buscarContratoEnCatalogo(Math.floor(idArr), Math.floor(idCon));
    const pagoAFavorDe = item
      ? this.nombreArrendadorPago(item, contrato)
      : 'Arrendador no disponible';
    const campos: RentaModalResumenCampo[] = [
      {
        etiqueta: 'Contrato',
        valor:
          (contrato && etiquetaContratoArrendatarioApi(contrato)) ||
          this.etiquetaOpcion(this.contratosOpciones, idCon),
      },
    ];

    const inm =
      contrato?.['inmueble'] != null && typeof contrato['inmueble'] === 'object'
        ? (contrato['inmueble'] as Record<string, unknown>)
        : null;
    const inmueble = inm ? String(inm['inmueble'] ?? '').trim() : '';
    const direccion = inm ? String(inm['direccionFiscal'] ?? '').trim() : '';
    if (inmueble) {
      campos.push({
        etiqueta: 'Inmueble',
        valor: direccion ? `${inmueble} · ${direccion}` : inmueble,
      });
    }

    const fi = formatearFecha(
      String(contrato?.['fechaInicioContrato'] ?? contrato?.['fechaInicio'] ?? ''),
    );
    const ff = formatearFecha(
      String(contrato?.['fechaTerminoContrato'] ?? contrato?.['fechaFin'] ?? ''),
    );
    if (fi && ff && fi !== '—' && ff !== '—') {
      campos.push({ etiqueta: 'Vigencia', valor: `${fi} – ${ff}` });
    }

    const moneda = String(contrato?.['moneda'] ?? 'MXN').trim() || 'MXN';
    this.agregarMontosContratoAlResumen(campos, contrato, moneda);

    const idFormula = Number(raw['idFormula']);
    if (Number.isFinite(idFormula) && idFormula > 0) {
      const formula = this.etiquetaOpcion(this.formulasOpciones, idFormula);
      if (formula) campos.push({ etiqueta: 'Fórmula', valor: formula });
    }

    const total = String(raw['total'] ?? '').trim();
    const montoFinal = String(raw['montoFinal'] ?? '').trim();
    if (total) {
      campos.push({
        etiqueta: 'Total a registrar',
        valor: this.esNumeroCaptura(total) ? formatearMoneda(total) : total,
        dinero: true,
      });
    }
    if (montoFinal) {
      campos.push({
        etiqueta: 'Monto final',
        valor: this.esNumeroCaptura(montoFinal) ? formatearMoneda(montoFinal) : montoFinal,
        dinero: true,
      });
    }

    const ocupo = Number(raw['ocupoFormula']) === 1 ? 'Sí' : 'No';
    campos.push({ etiqueta: 'Usó fórmula', valor: ocupo });

    return {
      listo: true,
      mensajeVacio: '',
      pagoAFavorDe,
      arrendatario: arrendatarioNombre || '—',
      campos,
    };
  }

  private agregarMontosContratoAlResumen(
    campos: RentaModalResumenCampo[],
    contrato: Record<string, unknown> | null,
    moneda: string,
  ): void {
    if (!contrato) return;

    const rentaContrato = formatearMoneda(
      contrato['rentaTotal'] ?? contrato['renta_total'] ?? contrato['subTotalRenta'],
    );
    if (rentaContrato && rentaContrato !== '—') {
      campos.push({
        etiqueta: 'Renta del contrato',
        valor: `${rentaContrato} ${moneda}`,
        dinero: true,
      });
    }
  }

  private nombreArrendadorPago(
    item: Record<string, unknown>,
    contrato: Record<string, unknown> | null,
  ): string {
    const arr = item['arrendador'];
    if (arr != null && typeof arr === 'object') {
      const nombre = nombreArrendador(arr as Record<string, unknown>);
      if (nombre && nombre !== '—') return nombre;
    }
    const inm = contrato?.['inmueble'];
    if (inm != null && typeof inm === 'object') {
      const arrInm = (inm as Record<string, unknown>)['arrendador'];
      if (arrInm != null && typeof arrInm === 'object') {
        const nombre = nombreArrendador(arrInm as Record<string, unknown>);
        if (nombre && nombre !== '—') return nombre;
      }
      const idInm = Number((inm as Record<string, unknown>)['idArrendador']);
      if (Number.isFinite(idInm) && idInm > 0) {
        return `Arrendador #${Math.trunc(idInm)}`;
      }
    }
    const id = Number(item['idArrendador']);
    if (Number.isFinite(id) && id > 0) return `Arrendador #${Math.trunc(id)}`;
    return 'Arrendador no indicado en el catálogo';
  }

  private buscarContratoEnCatalogo(
    idArrendatario: number,
    idContrato: number,
  ): Record<string, unknown> | null {
    const item = this.arrendatariosCatalogo.find(
      (r) => resolverIdArrendatarioApi(r) === idArrendatario,
    );
    const contratos = Array.isArray(item?.['contratos']) ? item['contratos'] : [];
    for (const raw of contratos) {
      if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const c = raw as Record<string, unknown>;
      const id = Number(c['id'] ?? c['idContrato']);
      if (id === idContrato) return c;
    }
    return null;
  }

  private etiquetaOpcion(opciones: SelectOpcion[], id: number): string {
    const hit = opciones.find((o) => o.id === Math.floor(id));
    return hit?.label?.trim() ?? '';
  }

  private esNumeroCaptura(v: string): boolean {
    const n = Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n);
  }

  textoPlaceholderContrato(): string {
    const idArr = Number(this.rentaForm?.get('idArrendatario')?.value);
    if (!Number.isFinite(idArr) || idArr <= 0) {
      return 'Seleccione arrendatario primero';
    }
    return this.contratosOpciones.length ? 'Seleccione contrato' : 'Sin contratos';
  }

  private cargarCatalogosModal(): void {
    this.catalogosModalCargando = true;
    void Promise.allSettled([
      lastValueFrom(this.arrendatariosService.obtenerArrendatariosPaginated(1, 300)),
      lastValueFrom(this.formulasService.obtenerFormulasData(1, 300)),
    ])
      .then((results) => {
        const [arrResult, formResult] = results;
        if (arrResult.status === 'fulfilled') {
          this.arrendatariosCatalogo = extraerFilasPaginadasApi(arrResult.value);
          this.arrendatariosOpciones = this.mapArrendatariosOpciones(
            this.arrendatariosCatalogo,
          );
          this.sincronizarContratosPorArrendatario(
            this.rentaForm.get('idArrendatario')?.value,
          );
        } else {
          console.error('Error arrendatarios modal renta:', arrResult.reason);
          this.arrendatariosCatalogo = [];
          this.arrendatariosOpciones = [];
          this.contratosOpciones = [];
        }
        if (formResult.status === 'fulfilled') {
          this.formulasOpciones = this.mapFormulasOpciones(formResult.value);
        } else {
          console.error('Error fórmulas modal renta:', formResult.reason);
          this.formulasOpciones = [];
        }
      })
      .finally(() => {
        this.catalogosModalCargando = false;
        this.actualizarResumenRentaModal();
      });
  }

  private sincronizarContratosPorArrendatario(idArrendatario: unknown): void {
    const id = Number(idArrendatario);
    const ctrlContrato = this.rentaForm.get('idContrato');
    if (!Number.isFinite(id) || id <= 0) {
      this.contratosOpciones = [];
      ctrlContrato?.setValue(null, { emitEvent: false });
      return;
    }
    const idBuscado = Math.floor(id);
    const item = this.arrendatariosCatalogo.find(
      (r) => resolverIdArrendatarioApi(r) === idBuscado,
    );
    const contratos = Array.isArray(item?.['contratos'])
      ? (item['contratos'] as unknown[])
      : [];
    this.contratosOpciones = contratos
      .map((raw) => {
        if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
        const c = raw as Record<string, unknown>;
        const estatus = c['estatus'];
        if (estatus != null && Number(estatus) !== 1) return null;
        const idContrato = Number(c['id'] ?? c['idContrato']);
        if (!Number.isFinite(idContrato) || idContrato <= 0) return null;
        return {
          id: Math.floor(idContrato),
          label: etiquetaContratoArrendatarioApi(c),
        };
      })
      .filter((x): x is SelectOpcion => x != null);

    const actual = Number(ctrlContrato?.value);
    const sigueValido = this.contratosOpciones.some((o) => o.id === actual);
    if (!sigueValido) {
      ctrlContrato?.setValue(null, { emitEvent: false });
    }
    this.actualizarResumenRentaModal();
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

  private mapFormulasOpciones(resp: unknown): SelectOpcion[] {
    const rows = extraerFilasPaginadasApi(resp);
    return rows
      .map((r) => {
        const estatus = r['estatus'];
        if (estatus != null && Number(estatus) !== 1) return null;
        const id = Number(r['id'] ?? r['idFormula']);
        if (!Number.isFinite(id) || id <= 0) return null;
        const nombre = String(r['nombre'] ?? '').trim();
        return { id: Math.floor(id), label: nombre || `Fórmula #${id}` };
      })
      .filter((x): x is SelectOpcion => x != null);
  }

  guardarRentaDesdeModal(): void {
    if (!this.rentaForm || this.rentaForm.invalid) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Completa los campos obligatorios del formulario.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const raw = this.rentaForm.getRawValue();
    const total = Number(raw.total);
    const montoFinal = Number(raw.montoFinal);
    const factorVariable = Number(raw.factorVariable);
    const idFormula = Number(raw.idFormula);
    const ocupoFormula = Number(raw.ocupoFormula) === 1 ? 1 : 0;

    if (
      !Number.isFinite(total) ||
      !Number.isFinite(montoFinal) ||
      !Number.isFinite(factorVariable) ||
      !Number.isFinite(idFormula)
    ) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Valores inválidos',
        text: 'Revisa total, monto final, factor variable y fórmula.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const putBody: RentaActualPutPayload = {
      total,
      idFormula: Math.floor(idFormula),
      montoFinal,
      factorVariable,
      ocupoFormula,
    };

    this.rentaGuardando = true;
    this.cdr.markForCheck();

    if (this.rentaModalModo === 'edicion' && this.rentaEditId != null) {
      this.rentaActualService.actualizarRenta(this.rentaEditId, putBody)
        .pipe(
          take(1),
          finalize(() => {
            this.rentaGuardando = false;
            this.cdr.markForCheck();
          }),
        )
        .subscribe({
          next: () => this.onRentaGuardadaOk('La renta se actualizó correctamente.'),
          error: (err) => this.onRentaGuardadaError(err),
        });
      return;
    }

    const idArrendatario = Number(raw.idArrendatario);
    const idContrato = Number(raw.idContrato);
    if (
      !Number.isFinite(idArrendatario) ||
      idArrendatario <= 0 ||
      !Number.isFinite(idContrato) ||
      idContrato <= 0
    ) {
      this.rentaGuardando = false;
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        icon: 'warning',
        title: 'Arrendatario y contrato',
        text: 'Selecciona arrendatario y contrato para registrar la renta.',
        confirmButtonText: 'Entendido',
      });
      this.cdr.markForCheck();
      return;
    }

    const postBody: RentaActualPostPayload = {
      idArrendatario: Math.floor(idArrendatario),
      idContrato: Math.floor(idContrato),
      ...putBody,
    };

    this.rentaActualService.registrarRenta(postBody)
      .pipe(
        take(1),
        finalize(() => {
          this.rentaGuardando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => this.onRentaGuardadaOk('La renta del mes se registró correctamente.'),
        error: (err) => this.onRentaGuardadaError(err),
      });
  }

  private onRentaGuardadaOk(texto: string): void {
    this.cerrarModalRenta();
    this.dataGrid?.instance?.refresh();
    void Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      icon: 'success',
      title: '¡Operación Exitosa!',
      text: texto,
      confirmButtonText: 'Listo',
    });
  }

  private onRentaGuardadaError(err: unknown): void {
    void Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      icon: 'error',
      title: 'No se pudo guardar',
      text: this.mensajeErrorHttp(err),
      confirmButtonText: 'Entendido',
    });
  }

  async marcarRentaPagada(row: RentaActualGridRow): Promise<void> {
    if (row?.pagada) return;
    const id = Number(row?.id);
    if (!Number.isFinite(id) || id <= 0) return;

    const periodo = row.mesLabel && row.mesLabel !== '—' ? row.mesLabel : 'este periodo';
    const result = await Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      icon: 'question',
      title: '¡Marcar Renta Como Pagada!',
      html: `Se registrara como pagada la renta de <strong>${row.arrendatarioLabel}</strong> (${periodo}).`,
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    this.rentaActualService.marcarComoPagada(Math.floor(id))
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.dataGrid?.instance?.refresh();
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'success',
            title: '¡Operación Exitosa!',
            text: 'La renta quedó marcada como pagada y se registró en el histórico.',
            confirmButtonText: 'Listo',
          });
        },
        error: (err) => {
          console.error('Error al marcar renta pagada:', err);
          void Swal.fire({
            background: '#141a21',
            color: '#ffffff',
            icon: 'error',
            title: 'No se pudo marcar como pagada',
            text: this.mensajeErrorHttp(err),
            confirmButtonText: 'Entendido',
          });
        },
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

  private mensajeErrorHttp(err: unknown): string {
    const e = err as {
      error?: string | { message?: string; mensaje?: string };
      message?: string;
    };
    const nested = e?.error;
    if (typeof nested === 'string' && nested.trim()) return nested;
    if (nested && typeof nested === 'object') {
      const msg = nested.message ?? nested.mensaje;
      if (msg != null && String(msg).trim()) return String(msg);
    }
    if (e?.message) return String(e.message);
    return 'Ocurrió un error al comunicarse con el servidor.';
  }
}
