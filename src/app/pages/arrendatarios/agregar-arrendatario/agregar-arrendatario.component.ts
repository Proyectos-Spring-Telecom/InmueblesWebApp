import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, debounceTime, finalize, forkJoin, of, Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { DocumentoPreviewComponent } from 'src/app/shared/documento-preview/documento-preview.component';
import { ArrendatariosService } from 'src/app/services/moduleService/arrendatarios.service';
import {
  CatServicioItem,
  CatServiciosService,
} from 'src/app/services/moduleService/cat-servicios.service';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { InmueblesService } from 'src/app/services/moduleService/inmuebles.service';
import { PdfOcrService } from 'src/app/services/moduleService/pdf-ocr.service';
import {
  extraerConstanciaDeRespuestaOcr,
  mapearConstanciaAArrendatario,
} from 'src/app/shared/constancia-fiscal-ocr.mapper';
import {
  ARRENDATARIOS_FORM_DEMO,
  INMUEBLES_ARRENDATARIOS_DEMO,
} from '../arrendatarios-demo.data';
import { extraerArrendatarioDetalleApi } from '../arrendatarios-list.mapper';
import {
  fechaParaInputDate,
  separarArchivosInmueble,
  type InmuebleArchivoApi,
  type SlotDocumentoInmueble,
} from '../../inmuebles/inmuebles-list.mapper';

@Component({
  selector: 'app-agregar-arrendatario',
  templateUrl: './agregar-arrendatario.component.html',
  styleUrl: './agregar-arrendatario.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarArrendatarioComponent implements OnInit, OnDestroy {
  private readonly swalToastOcrExito = Swal.mixin({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title: 'Información aplicada en formulario.',
    showConfirmButton: false,
    timer: 4200,
    timerProgressBar: true,
    background: '#141a21',
    color: '#ffffff',
  });

  public title = 'Agregar Arrendatario';
  public submitButton: string = 'Guardar';
  public arrendatarioForm: FormGroup;
  /** Id del arrendatario en modo edición (ruta), no confundir con `idArrendador` del formulario. */
  public idArrendatario?: number;
  /** Carga del GET `/arrendatarios/{id}` en curso. */
  cargandoDetalle = false;
  public listaClientes: { id: number; nombre?: string; apellidoPaterno?: string; apellidoMaterno?: string }[] = [];
  public listaInmuebles: { id: number; etiqueta: string }[] = [];
  public listaLocalesLibres: { id: number; etiqueta: string }[] = [];
  cargandoLocalesLibres = false;
  public listaCatServicios: CatServicioItem[] = [];
  loadingSubmit = false;
  mostrarModalMapa = false;
  /** Índice del slot de galería para animación de entrada (una vez). */
  indiceGaleriaAnimando: number | null = null;
  private readonly mapaCentroCuernavaca = { lat: 18.9186, lng: -99.2341 };
  private readonly mapaZoomCuernavaca = 11;
  private map: unknown = null;
  private marker: unknown = null;
  private latSeleccionada: number | null = null;
  private lngSeleccionada: number | null = null;
  private readonly apiKey = 'AIzaSyDuJ3IBZIs2mRbR4alTg7OZIsk0sXEJHhg';
  private readonly pinUrl = 'assets/images/logos/marker_spring.webp';
  readonly acceptPdfImagenes = 'application/pdf,image/png,image/jpeg,image/jpg';
  readonly etiquetaPdfImagenes = 'PDF · PNG · JPG · JPEG';
  readonly acceptSoloPdf = 'application/pdf';
  readonly etiquetaSoloPdf = 'PDF';
  readonly acceptSoloImagenes = 'image/png,image/jpeg,image/jpg';
  readonly etiquetaSoloImagenes = 'PNG · JPG · JPEG';
  imagenLicenciaNombre: string | null = null;
  imagenLicenciaUrl: string | null = null;
  archivoEscrituraNombre: string | null = null;
  archivoEscrituraUrl: string | null = null;
  boletaPredialNombre: string | null = null;
  boletaPredialUrl: string | null = null;
  reciboAguaServiciosNombre: string | null = null;
  imagenPlanoNombre: string | null = null;
  contratoRentaNombre: string | null = null;
  constanciaFiscalNombre: string | null = null;
  constanciaRepLegalNombre: string | null = null;
  comprobanteDomicilioNombre: string | null = null;
  ineRepresentanteNombre: string | null = null;
  imagenPlanoUrl: string | null = null;
  contratoRentaUrl: string | null = null;
  constanciaFiscalUrl: string | null = null;
  constanciaRepLegalUrl: string | null = null;
  comprobanteDomicilioUrl: string | null = null;
  ineRepresentanteUrl: string | null = null;
  resaltarAutocargaContrato = false;
  resaltarAutocargaDocs = false;
  autocargaCsfPendiente = false;
  private procesandoConstanciaOcr = false;
  private promptAutocargaMostrado = false;
  private readonly debounceLogMs = 400;
  private formValueLogSub?: Subscription;
  private idInmuebleChangeSub?: Subscription;

  @ViewChild('imagenPlanoInput') imagenPlanoInput?: ElementRef<HTMLInputElement>;
  @ViewChild('contratoRentaInput') contratoRentaInput?: ElementRef<HTMLInputElement>;
  @ViewChild('constanciaFiscalInput') constanciaFiscalInput?: ElementRef<HTMLInputElement>;
  @ViewChild('constanciaRepLegalInput') constanciaRepLegalInput?: ElementRef<HTMLInputElement>;
  @ViewChild('comprobanteDomicilioInput') comprobanteDomicilioInput?: ElementRef<HTMLInputElement>;
  @ViewChild('ineRepresentanteInput') ineRepresentanteInput?: ElementRef<HTMLInputElement>;
  @ViewChild('docPreview') docPreview?: DocumentoPreviewComponent;
  @ViewChild('autocargaCsfCardArrendatario') autocargaCsfCardArrendatario?: ElementRef<HTMLElement>;
  @ViewChild('topFormularioArrendatario') topFormularioArrendatario?: ElementRef<HTMLElement>;
  @ViewChild('inicioFormularioArrendatario') inicioFormularioArrendatario?: ElementRef<HTMLElement>;
  @ViewChild('docsSectionArrendatario') docsSectionArrendatario?: ElementRef<HTMLElement>;
  constructor(
    private fb: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private clientesService: ClientesService,
    private catServiciosService: CatServiciosService,
    private inmueblesService: InmueblesService,
    private arrendatariosService: ArrendatariosService,
    private pdfOcrService: PdfOcrService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.initTipoPersonaLogic();
    this.initContratoInmuebleLocalLogic();
    this.formValueLogSub = this.arrendatarioForm.valueChanges
      .pipe(debounceTime(this.debounceLogMs))
      .subscribe(() => {
        // Mismo criterio que `agregar-inmueble`: log tras pausa de escritura (incluye valores actuales).
        console.log('[agregar-arrendatario] valor del formulario (tras pausa de escritura)', {
          value: this.arrendatarioForm.getRawValue(),
        });
      });

    forkJoin({
      clientes: this.clientesService.obtenerClientes().pipe(catchError(() => of(null))),
      catServicios: this.catServiciosService
        .obtenerServiciosPaginados(1, 30)
        .pipe(catchError(() => of(null))),
      inmuebles: this.inmueblesService
        .obtenerInmueblesData(1, 200)
        .pipe(catchError(() => of(null))),
    }).subscribe(({ clientes, catServicios, inmuebles }) => {
      this.asignarListaClientes(clientes);
      this.asignarListaInmuebles(inmuebles);
      if (catServicios != null) {
        this.listaCatServicios = this.extraerFilasCatServicios(catServicios);
      } else {
        this.listaCatServicios = [];
      }
      this.syncServiciosIdsDesdeCatalogo();
    });

    const stateData = history.state?.arrendatario;
    if (stateData && stateData.idLocal) {
      this.idArrendatario = Number(stateData.idLocal);
      this.title = 'Actualizar Arrendatario';
      this.submitButton = 'Actualizar';
      this.cargarDesdeGrid(stateData);
      return;
    }
    this.activatedRoute.params.subscribe((params) => {
      const raw = params['id'] ?? params['idArrendatario'];
      const id = raw != null && String(raw).trim() !== '' ? Number(raw) : Number.NaN;
      this.idArrendatario = Number.isFinite(id) && id > 0 ? Math.trunc(id) : undefined;
      if (this.idArrendatario != null) {
        this.title = 'Actualizar Arrendatario';
        this.submitButton = 'Actualizar';
        this.cargarArrendatarioParaEdicionDesdeApi(this.idArrendatario);
      } else {
        this.mostrarPromptAutocargaContrato();
      }
    });
  }

  ngOnDestroy(): void {
    this.formValueLogSub?.unsubscribe();
    this.idInmuebleChangeSub?.unsubscribe();
  }

  private mostrarPromptAutocargaContrato(): void {
    if (this.promptAutocargaMostrado) return;
    this.promptAutocargaMostrado = true;
    void Swal.fire({
      background: '#141a21',
      color: '#ffffff',
      icon: 'question',
      title: '¿Quieres Intentar Completar El Formulario Con Un Archivo?',
      text: 'Te llevaremos a la sección de Constancia de Situación Fiscal para subir el PDF y extraer algunos datos.',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, Llevarme',
      cancelButtonText: 'No, Continuar Manualmente',
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.autocargaCsfPendiente = true;
      this.enfocarAutocargaCsf();
    });
  }

  private scrollSuaveAElemento(
    elemento: HTMLElement | undefined,
    block: ScrollLogicalPosition,
  ): void {
    if (!elemento) return;
    setTimeout(() => {
      elemento.scrollIntoView({ behavior: 'smooth', block });
    }, 120);
  }

  private enfocarAutocargaCsf(): void {
    const csfCard = this.autocargaCsfCardArrendatario?.nativeElement;
    if (csfCard) {
      this.scrollSuaveAElemento(csfCard, 'center');
      this.resaltarAutocargaContrato = true;
      return;
    }
    const docs = this.docsSectionArrendatario?.nativeElement;
    if (!docs) return;
    this.scrollSuaveAElemento(docs, 'center');
    this.resaltarAutocargaDocs = true;
  }

  private scrollArribaTrasOcrExitoso(): void {
    const arriba =
      this.topFormularioArrendatario?.nativeElement ??
      this.inicioFormularioArrendatario?.nativeElement;
    this.scrollSuaveAElemento(arriba, 'start');
  }

  /** Quita resaltados tras OCR; mantiene autocarga activa para reemplazar el PDF. */
  private finalizarAutocargaCsf(): void {
    this.resaltarAutocargaContrato = false;
    this.resaltarAutocargaDocs = false;
  }

  private esArchivoPdf(file: File): boolean {
    const tipo = (file.type || '').toLowerCase();
    if (tipo === 'application/pdf') return true;
    return /\.pdf$/i.test(file.name || '');
  }

  private aplicarDatosConstanciaAlFormulario(
    patch: ReturnType<typeof mapearConstanciaAArrendatario>,
  ): void {
    const valores: Record<string, unknown> = {};
    if (patch.nombreInmueble) valores['arrendatario'] = patch.nombreInmueble;
    if (patch.direccionInmueble) valores['direccionFiscal'] = patch.direccionInmueble;
    if (patch.tipoPersona != null) valores['tipoPersona'] = patch.tipoPersona;

    if (Object.keys(valores).length === 0) return;

    this.arrendatarioForm.patchValue(valores);
    if (valores['tipoPersona'] != null) {
      this.aplicarValidadoresTipoPersona(valores['tipoPersona']);
    }
  }

  private mensajeErrorOcrHttp(err: unknown): string {
    const e = err as {
      error?: { message?: string };
      message?: string;
      status?: number;
    };
    const delApi = String(e?.error?.message ?? '').trim();
    if (delApi) return delApi;
    const generico = String(e?.message ?? '').trim();
    if (generico && !generico.startsWith('Http failure')) return generico;
    if (e?.status) return `El servidor respondió con el código ${e.status}.`;
    return 'No fue posible conectar con el servicio de lectura del PDF.';
  }

  private escapeHtmlSwal(texto: string): string {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private mostrarAlertaOcrFallido(detalleError: string): void {
    const detalle = detalleError.trim() || 'No se obtuvo un detalle del error.';
    void Swal.fire({
      title: 'No pudimos leer la constancia automáticamente',
      html: `
        <p style="margin:0 0 0.75rem;text-align:left;"><strong>Qué ocurrió:</strong> ${this.escapeHtmlSwal(detalle)}</p>
        <p style="margin:0;text-align:left;">
          Tu PDF de la constancia <strong>sigue adjunto</strong> en el formulario y se enviará al guardar como siempre.
          Por favor, continúa capturando los datos <strong>a mano</strong>; cuando termines, podrás guardar con normalidad.
        </p>
      `,
      icon: 'info',
      confirmButtonText: 'Entendido, continuaré manualmente',
      confirmButtonColor: '#3085d6',
      background: '#141a21',
      color: '#ffffff',
    });
  }

  private completarOcrConstanciaExitoso(
    constancia: NonNullable<ReturnType<typeof extraerConstanciaDeRespuestaOcr>>,
  ): void {
    Swal.close();
    this.aplicarDatosConstanciaAlFormulario(mapearConstanciaAArrendatario(constancia));
    this.finalizarAutocargaCsf();
    this.cdr.detectChanges();
    this.scrollArribaTrasOcrExitoso();
    void this.swalToastOcrExito.fire();
  }

  private procesarConstanciaFiscalOcr(file: File): void {
    if (this.procesandoConstanciaOcr) return;
    this.procesandoConstanciaOcr = true;

    void Swal.fire({
      title: 'Leyendo constancia fiscal…',
      text: 'Extrayendo datos del PDF, por favor espera.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      background: '#141a21',
      color: '#ffffff',
      didOpen: () => {
        Swal.showLoading();
      },
    });

    this.pdfOcrService
      .extraerConstanciaFiscal(file)
      .pipe(
        finalize(() => {
          this.procesandoConstanciaOcr = false;
        }),
      )
      .subscribe({
        next: (res) => {
          const constancia = extraerConstanciaDeRespuestaOcr(res);
          if (String(res?.status ?? '').toLowerCase() !== 'success' || !constancia) {
            Swal.close();
            this.finalizarAutocargaCsf();
            this.mostrarAlertaOcrFallido(
              res?.message ||
                'El servicio no devolvió información usable de la constancia fiscal.',
            );
            return;
          }
          this.completarOcrConstanciaExitoso(constancia);
        },
        error: (err) => {
          Swal.close();
          this.finalizarAutocargaCsf();
          this.mostrarAlertaOcrFallido(this.mensajeErrorOcrHttp(err));
        },
      });
  }

  private initForm(): void {
    this.arrendatarioForm = this.fb.group({
      arrendatario: ['', Validators.required],
      tipoPersona: [null as number | null, Validators.required],
      renta: ['', Validators.required],
      direccionFiscal: [''],
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required],
      idArrendador: [null as number | null, Validators.required],
      /** Sin selector en UI; puede venir de demos u otras rutas. */
      estatusInmueble: [null as string | null],
      tiempoRenta: ['', Validators.required],
      representanteLegal: ['', Validators.required],
      telefonoRepresentante: ['', Validators.required],
      correoRepresentante: ['', [Validators.required, Validators.email]],
      /** Opcional según Swagger: `contratoArrendatario` es opcional. */
      idInmueble: [null as number | null],
      idLocal: [{ value: null as number | null, disabled: true }],
      lat: [''],
      lng: [''],
      fechaInicioContrato: [''],
      fechaTerminoContrato: [''],
      tipoMoneda: ['MXN'],
      metrosRentados: [''],
      costoPorM2: [''],
      pctMantenimiento: [''],
      mesesDeposito: [''],
      montoDeposito: [''],
      mesesAdelanto: [''],
      montoAdelanto: [''],
      anosForzososArrendador: [''],
      anosForzososArrendatario: [''],
      subtotalRenta: [''],
      ivaRenta: [''],
      rentaTotal: [''],
      subtotalMantenimiento: [''],
      ivaMantenimiento: [''],
      mantenimientoTotal: [''],
      observaciones: [''],
      documentoPlano: [null],
      documentoContratoRenta: [null],
      documentoConstanciaFiscal: [null],
      constanciaSituacionFiscalRepresentanteLegal: [null],
      documentoComprobanteDomicilio: [null],
      ineRepresentanteLegal: [null],
      galeriaImagenes: this.fb.array([this.crearGaleriaImagenFormGroup()]),
      /** Dos filas por defecto: Renta y Mantenimiento (`syncServiciosIdsDesdeCatalogo`). */
      servicios: this.fb.array([this.crearServicioFormGroup(), this.crearServicioFormGroup()]),
      pagos: this.fb.array([]),
      socios: this.fb.array([this.crearSocioFormGroup()]),
      locales: this.fb.array([this.crearLocalFormGroup()]),
    });
  }

  private initTipoPersonaLogic(): void {
    const ctrl = this.arrendatarioForm.get('tipoPersona');
    if (!ctrl) return;
    this.aplicarValidadoresTipoPersona(ctrl.value);
    ctrl.valueChanges.subscribe((v) => this.aplicarValidadoresTipoPersona(v));
  }

  private initContratoInmuebleLocalLogic(): void {
    const ctrl = this.arrendatarioForm.get('idInmueble');
    if (!ctrl) return;
    this.idInmuebleChangeSub = ctrl.valueChanges.subscribe((raw) => {
      this.arrendatarioForm.patchValue({ idLocal: null }, { emitEvent: false });
      const id =
        raw != null && String(raw).trim() !== '' ? Number(raw) : Number.NaN;
      if (Number.isFinite(id) && id > 0) {
        this.cargarLocalesLibres(Math.trunc(id));
        return;
      }
      this.listaLocalesLibres = [];
      this.actualizarEstadoControlIdLocal();
    });
  }

  private cargarLocalesLibres(idInmueble: number, idLocalPreservar?: number | null): void {
    this.cargandoLocalesLibres = true;
    this.listaLocalesLibres = [];
    this.actualizarEstadoControlIdLocal();
    this.inmueblesService
      .obtenerLocalesLibres(idInmueble)
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          this.cargandoLocalesLibres = false;
          this.actualizarEstadoControlIdLocal();
          this.cdr.markForCheck();
        }),
      )
      .subscribe((res) => {
        this.asignarListaLocalesLibres(res);
        const preserve =
          idLocalPreservar != null && Number.isFinite(Number(idLocalPreservar))
            ? Math.trunc(Number(idLocalPreservar))
            : null;
        if (
          preserve != null &&
          this.listaLocalesLibres.some((l) => l.id === preserve)
        ) {
          this.arrendatarioForm.patchValue({ idLocal: preserve }, { emitEvent: false });
        }
        this.actualizarEstadoControlIdLocal();
      });
  }

  private actualizarEstadoControlIdLocal(): void {
    const ctrl = this.arrendatarioForm.get('idLocal');
    if (!ctrl) return;
    const idInm = Number(this.arrendatarioForm.get('idInmueble')?.value);
    const puedeElegir =
      Number.isFinite(idInm) &&
      idInm > 0 &&
      !this.cargandoLocalesLibres &&
      this.listaLocalesLibres.length > 0;
    if (puedeElegir) {
      ctrl.enable({ emitEvent: false });
    } else {
      ctrl.disable({ emitEvent: false });
    }
  }

  private asignarListaLocalesLibres(res: unknown): void {
    if (res == null) {
      this.listaLocalesLibres = [];
      return;
    }
    let rows: unknown = res;
    if (typeof res === 'object' && !Array.isArray(res)) {
      const bag = res as Record<string, unknown>;
      rows = bag['data'] ?? bag['locales'] ?? bag['items'] ?? bag['content'];
    }
    if (!Array.isArray(rows)) {
      this.listaLocalesLibres = [];
      return;
    }
    const items = rows
      .map((raw) => {
        const row = raw as Record<string, unknown>;
        const id = Number(row['id'] ?? row['idLocal']);
        if (!Number.isFinite(id) || id <= 0) return null;
        return { id: Math.trunc(id), etiqueta: this.etiquetaLocalLibre(row) };
      })
      .filter((x): x is { id: number; etiqueta: string } => x != null);
    items.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
    this.listaLocalesLibres = items;
  }

  private etiquetaLocalLibre(row: Record<string, unknown>): string {
    const idRef = row['id'] ?? row['idLocal'];
    const nombre = String(row['nombre'] ?? row['nombreLocal'] ?? '').trim();
    const mensualidadRaw = row['mensualidad'];
    const mensualidad =
      mensualidadRaw != null && String(mensualidadRaw).trim() !== ''
        ? String(mensualidadRaw).trim()
        : '';
    const zonaObj = row['zona'];
    const zonaPrincipal =
      zonaObj != null && typeof zonaObj === 'object'
        ? String((zonaObj as Record<string, unknown>)['zonaPrincipal'] ?? '').trim()
        : String(row['zonaPrincipal'] ?? row['nivel'] ?? '').trim();
    const parts = [
      nombre || (idRef != null ? `Local ${idRef}` : 'Local'),
      mensualidad,
      zonaPrincipal,
    ].filter(Boolean);
    return parts.join(' — ');
  }

  private aplicarValidadoresTipoPersona(_raw: unknown): void {
    // Documentos del arrendatario: mismos para física y moral; sin validación por tipo.
  }

  onTipoPersonaChange(_event: Event): void {
    const raw = this.arrendatarioForm.get('tipoPersona')?.value;
    const value =
      raw === null || raw === undefined || raw === '' ? null : Number(raw);
    this.arrendatarioForm.get('tipoPersona')?.setValue(value, { emitEvent: true });
  }

  esPersonaFisica(): boolean {
    return Number(this.arrendatarioForm?.get('tipoPersona')?.value) === 1;
  }

  esPersonaMoral(): boolean {
    return Number(this.arrendatarioForm?.get('tipoPersona')?.value) === 2;
  }

  /** Campos alineados con Swagger `socios[]`: nombre, rfc y tres archivos por socio. */
  private crearSocioFormGroup(): FormGroup {
    return this.fb.group({
      nombre: [''],
      rfc: [''],
      constanciaFiscalArchivo: [null],
      comprobanteDomicilioArchivo: [null],
      identificacionOficialArchivo: [null],
    });
  }

  private crearGaleriaImagenFormGroup(): FormGroup {
    return this.fb.group({
      archivo: [null],
      nombre: [''],
      url: [''],
    });
  }

  private crearServicioFormGroup(): FormGroup {
    return this.fb.group({
      idTipoServicio: [null as number | null],
      servicioNumeroContrato: [''],
      servicioFechaPago: [''],
      servicioUltimoDiaPago: [''],
      servicioComprobantePago: [null],
      servicioComprobantePagoNombre: [''],
      servicioComprobantePagoUrl: [''],
    });
  }

  private crearPagoFormGroup(): FormGroup {
    return this.fb.group({
      pagoConcepto: [''],
      pagoFecha: [''],
      pagoMonto: [''],
    });
  }

  private crearLocalFormGroup(): FormGroup {
    return this.fb.group({
      nombreLocal: ['', Validators.required],
      estadoLocal: [''],
      mensualidadLocalMxn: [''],
      zonaLocal: [''],
      ocupanteLocal: [''],
      giroLocal: [''],
      medidaLocal: [''],
      contratoHastaLocal: [''],
      archivoContratoLocal: [''],
      numeroContratoLocal: [''],
      tipoModificacionContratoLocal: [''],
      arrendadorLocal: [''],
      arrendatarioLocal: [''],
      fechaInicioContratoLocal: [''],
      fechaTerminoContratoLocal: [''],
      tipoMonedaLocal: [''],
      metrosRentadosLocal: [''],
      costoPorM2Local: [''],
      pctMantenimientoLocal: [''],
      mesesDepositoLocal: [''],
      montoDepositoLocal: [''],
      mesesAdelantoLocal: [''],
      montoAdelantoLocal: [''],
      anosForzososArrendadorLocal: [''],
      anosForzososArrendatarioLocal: [''],
      subtotalRentaLocal: [''],
      ivaRentaLocal: [''],
      rentaTotalLocal: [''],
      subtotalMantenimientoLocal: [''],
      ivaMantenimientoLocal: [''],
      mantenimientoTotalLocal: [''],
      observacionesContratoLocal: [''],
    });
  }

  get localesFormArray(): FormArray {
    return this.arrendatarioForm.get('locales') as FormArray;
  }

  get galeriaImagenesFormArray(): FormArray {
    return this.arrendatarioForm.get('galeriaImagenes') as FormArray;
  }

  galeriaGrupo(index: number): FormGroup {
    return this.galeriaImagenesFormArray.at(index) as FormGroup;
  }

  get serviciosFormArray(): FormArray {
    return this.arrendatarioForm.get('servicios') as FormArray;
  }

  get pagosFormArray(): FormArray {
    return this.arrendatarioForm.get('pagos') as FormArray;
  }

  get sociosFormArray(): FormArray {
    return this.arrendatarioForm.get('socios') as FormArray;
  }

  get primerNombreSocio(): string {
    const raw = this.sociosFormArray?.at(0)?.get('nombre')?.value;
    if (raw == null) return '';
    return String(raw).trim();
  }

  nombreSocioEnIndice(index: number): string {
    const raw = this.sociosFormArray?.at(index)?.get('nombre')?.value;
    if (raw == null) return '';
    return String(raw).trim();
  }

  agregarSocio(): void {
    this.sociosFormArray.push(this.crearSocioFormGroup());
  }

  eliminarSocio(index: number): void {
    if (this.sociosFormArray.length === 1) return;
    this.sociosFormArray.removeAt(index);
  }

  openSocioFilePicker(input: HTMLInputElement): void {
    input.click();
  }

  onSocioFileSelected(
    event: Event,
    index: number,
    field: 'constanciaFiscalArchivo' | 'comprobanteDomicilioArchivo' | 'identificacionOficialArchivo',
  ): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const group = this.sociosFormArray.at(index) as FormGroup;
    group.patchValue({ [field]: file });
    if (input) input.value = '';
  }

  private abrirModalMapaParaGuardar(): void {
    this.latSeleccionada = null;
    this.lngSeleccionada = null;
    this.mostrarModalMapa = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      void this.loadGoogleMaps()
        .then(() => this.initMapaArrendatarioModal())
        .catch((err) => console.error('No se pudo cargar Google Maps', err));
    }, 100);
  }

  cancelarModalMapa(): void {
    this.latSeleccionada = null;
    this.lngSeleccionada = null;
    this.limpiarEstadoMapaModal();
  }

  private limpiarEstadoMapaModal(): void {
    this.mostrarModalMapa = false;
    this.map = null;
    this.marker = null;
  }

  confirmarUbicacionMapa(): void {
    if (this.latSeleccionada == null || this.lngSeleccionada == null) {
      void Swal.fire({
        background: '#141a21',
        color: '#ffffff',
        title: 'Selecciona una ubicación',
        text: 'Debes hacer clic en el mapa para marcar latitud y longitud antes de guardar.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
      });
      return;
    }
    this.arrendatarioForm.patchValue({
      lat: this.latSeleccionada,
      lng: this.lngSeleccionada,
    });
    this.limpiarEstadoMapaModal();
    this.ejecutarGuardadoArrendatario();
  }

  private loadGoogleMaps(): Promise<void> {
    return new Promise((resolve, reject) => {
      const w = window as Window & { google?: { maps?: unknown } };
      if (w.google?.maps) {
        resolve();
        return;
      }
      const existingScript = document.querySelector('script[data-gmaps="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', (e) => reject(e));
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}`;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-gmaps', 'true');
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  private initMapaArrendatarioModal(): void {
    const mapElement = document.getElementById('mapArrendatario');
    if (!mapElement) return;
    const w = window as Window & {
      google?: {
        maps: {
          Map: new (node: HTMLElement, opts: object) => unknown;
          Marker: new (opts: object) => { setMap?: (m: unknown) => void };
          Size: new (a: number, b: number) => unknown;
          Point: new (a: number, b: number) => unknown;
        };
      };
    };
    if (!w.google?.maps) return;

    const latFromForm = Number(this.arrendatarioForm.get('lat')?.value);
    const lngFromForm = Number(this.arrendatarioForm.get('lng')?.value);
    const tieneCoordsGuardadas =
      Number.isFinite(latFromForm) &&
      Number.isFinite(lngFromForm) &&
      (latFromForm !== 0 || lngFromForm !== 0);
    const tieneSeleccionActual = this.latSeleccionada != null && this.lngSeleccionada != null;

    let lat: number;
    let lng: number;
    let zoom: number;
    if (tieneSeleccionActual) {
      lat = this.latSeleccionada!;
      lng = this.lngSeleccionada!;
      zoom = 14;
    } else if (tieneCoordsGuardadas) {
      lat = latFromForm;
      lng = lngFromForm;
      zoom = 14;
    } else {
      lat = this.mapaCentroCuernavaca.lat;
      lng = this.mapaCentroCuernavaca.lng;
      zoom = this.mapaZoomCuernavaca;
    }

    const g = w.google.maps;
    this.map = new g.Map(mapElement, {
      center: { lat, lng },
      zoom,
    });

    if (this.latSeleccionada != null && this.lngSeleccionada != null) {
      this.actualizarMarcadorMapa({ lat: this.latSeleccionada, lng: this.lngSeleccionada });
    } else if (tieneCoordsGuardadas) {
      this.latSeleccionada = latFromForm;
      this.lngSeleccionada = lngFromForm;
      this.actualizarMarcadorMapa({ lat: latFromForm, lng: lngFromForm });
    }

    (this.map as { addListener?: (ev: string, fn: (e: { latLng: { lat: () => number; lng: () => number } }) => void) => void })?.addListener?.(
      'click',
      (e: { latLng: { lat: () => number; lng: () => number } }) => {
        const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        this.latSeleccionada = p.lat;
        this.lngSeleccionada = p.lng;
        this.actualizarMarcadorMapa(p);
      },
    );
  }

  private actualizarMarcadorMapa(pos: { lat: number; lng: number }): void {
    const w = window as Window & {
      google?: {
        maps: {
          Marker: new (opts: object) => { setMap?: (m: unknown) => void };
          Size: new (a: number, b: number) => unknown;
          Point: new (a: number, b: number) => unknown;
        };
      };
    };
    if (!this.map || !w.google?.maps) return;
    const g = w.google.maps;
    const marker = this.marker as { setMap?: (m: null) => void } | null;
    if (marker?.setMap) marker.setMap(null);
    this.marker = new g.Marker({
      position: pos,
      map: this.map,
      icon: {
        url: this.pinUrl,
        scaledSize: new g.Size(70, 70),
        anchor: new g.Point(35, 70),
      },
    });
    (this.map as { panTo?: (p: { lat: number; lng: number }) => void })?.panTo?.(pos);
  }

  private tieneCoordenadasEnFormulario(): boolean {
    const lat = Number(this.arrendatarioForm.get('lat')?.value);
    const lng = Number(this.arrendatarioForm.get('lng')?.value);
    return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  }

  agregarServicio(): void {
    this.serviciosFormArray.push(this.crearServicioFormGroup());
  }

  etiquetaCatServicio(item: CatServicioItem): string {
    const nombre = item.nombre ?? item.servicio ?? item.descripcion;
    if (nombre != null && String(nombre).trim() !== '') return String(nombre).trim();
    return `Servicio ${item.id}`;
  }

  eliminarServicio(index: number): void {
    if (this.serviciosFormArray.length <= 1) return;
    this.serviciosFormArray.removeAt(index);
  }

  agregarPago(): void {
    this.pagosFormArray.push(this.crearPagoFormGroup());
  }

  eliminarPago(index: number): void {
    if (this.pagosFormArray.length === 1) return;
    this.pagosFormArray.removeAt(index);
  }

  onServicioPagoFileSelected(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const group = this.serviciosFormArray.at(index) as FormGroup;
    group.patchValue({
      servicioComprobantePago: file,
      servicioComprobantePagoNombre: file?.name ?? '',
      servicioComprobantePagoUrl: '',
    });
    if (input) input.value = '';
  }

  verArchivoRemoto(url: string | null | undefined, titulo: string): void {
    if (!url?.trim()) return;
    const subtitulo = String(this.arrendatarioForm.get('arrendatario')?.value ?? '').trim();
    this.docPreview?.abrir(url, titulo, subtitulo);
  }

  /** Edición con archivo ya guardado en el servidor (URL remota). Misma regla que `agregar-inmueble` (id + URL). */
  layoutArchivoRemoto(url: string | null | undefined): boolean {
    return this.idArrendatario != null && !!String(url ?? '').trim();
  }

  agregarFotoGaleria(): void {
    const nuevoIndice = this.galeriaImagenesFormArray.length;
    this.galeriaImagenesFormArray.push(this.crearGaleriaImagenFormGroup());
    this.indiceGaleriaAnimando = nuevoIndice;
    setTimeout(() => this.finalizarAnimacionGaleria(nuevoIndice), 450);
  }

  finalizarAnimacionGaleria(indice: number): void {
    if (this.indiceGaleriaAnimando === indice) {
      this.indiceGaleriaAnimando = null;
    }
  }

  eliminarFotoGaleria(index: number): void {
    if (this.galeriaImagenesFormArray.length === 1) return;
    this.galeriaImagenesFormArray.removeAt(index);
  }

  abrirSelectorGaleria(input: HTMLInputElement): void {
    input.click();
  }

  onGaleriaFileSelected(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const galeriaGroup = this.galeriaImagenesFormArray.at(index) as FormGroup;
    galeriaGroup.patchValue({
      archivo: file,
      nombre: file?.name ?? '',
      url: '',
    });
  }

  abrirSelectorArchivo(ref: string): void {
    const map: Record<string, ElementRef<HTMLInputElement> | undefined> = {
      plano: this.imagenPlanoInput,
      contratoRenta: this.contratoRentaInput,
      constanciaFiscal: this.constanciaFiscalInput,
      constanciaRepLegal: this.constanciaRepLegalInput,
      comprobanteDomicilio: this.comprobanteDomicilioInput,
      ineRepresentante: this.ineRepresentanteInput,
    };
    map[ref]?.nativeElement?.click();
  }

  onFileSelected(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (
      controlName === 'documentoConstanciaFiscal' &&
      file &&
      this.autocargaCsfPendiente
    ) {
      if (!this.esArchivoPdf(file)) {
        input.value = '';
        this.arrendatarioForm.get(controlName)?.setValue(null);
        this.constanciaFiscalNombre = null;
        void Swal.fire({
          title: 'Solo se acepta PDF',
          text: 'Para completar el formulario automáticamente debes subir la Constancia de Situación Fiscal en formato PDF.',
          icon: 'warning',
          confirmButtonColor: '#3085d6',
          background: '#141a21',
          color: '#ffffff',
        });
        return;
      }
    }

    this.arrendatarioForm.get(controlName)?.setValue(file);

    const name = file?.name ?? null;
    if (controlName === 'documentoPlano') {
      this.imagenPlanoNombre = name;
      this.imagenPlanoUrl = null;
    }
    if (controlName === 'documentoContratoRenta') {
      this.contratoRentaNombre = name;
      this.contratoRentaUrl = null;
    }
    if (controlName === 'documentoConstanciaFiscal') {
      this.constanciaFiscalNombre = name;
      this.constanciaFiscalUrl = null;
      if (file && this.autocargaCsfPendiente) {
        this.procesarConstanciaFiscalOcr(file);
        return;
      }
    }
    if (controlName === 'constanciaSituacionFiscalRepresentanteLegal') {
      this.constanciaRepLegalNombre = name;
      this.constanciaRepLegalUrl = null;
    }
    if (controlName === 'documentoComprobanteDomicilio') {
      this.comprobanteDomicilioNombre = name;
      this.comprobanteDomicilioUrl = null;
    }
    if (controlName === 'ineRepresentanteLegal') {
      this.ineRepresentanteNombre = name;
      this.ineRepresentanteUrl = null;
    }
    if (controlName === 'documentoContratoRenta' && file) this.resaltarAutocargaContrato = false;
  }

  private cargarDemoEdicion(id: number): void {
    const demoLocal = this.buscarLocalDemoPorId(id);
    const registro = ARRENDATARIOS_FORM_DEMO.find((item) => item.id === id);
    if (!registro && !demoLocal) return;
    const arrendatarioNombre =
      demoLocal?.local.arrendatario ??
      registro?.nombreComercial ??
      '';
    const arrendadorNombre =
      demoLocal?.local.arrendador ??
      registro?.arrendador ??
      '';
    const nombreRepresentante =
      this.resolverNombreRepresentanteDemo(arrendatarioNombre);
    const telefonoRep =
      demoLocal?.local.telefonoContacto ??
      registro?.telefono ??
      '';
    const correoRep =
      demoLocal?.local.correoContacto ??
      registro?.correo ??
      '';
    const localDemo = demoLocal
      ? {
          idLocal: demoLocal.local.idLocal,
          nombreLocal: demoLocal.local.nombreLocal,
          idInmueble: demoLocal.inmueble.idInmueble,
          nombreInmueble: demoLocal.inmueble.nombreInmueble,
          nivel: demoLocal.local.nivel,
          superficieM2: demoLocal.local.superficieM2,
          mensualidadMxn: demoLocal.local.mensualidadMxn,
          fechaInicio: '2024-01-01',
          fechaTermino: demoLocal.local.vigenciaHasta,
          estatusContrato: 'vigente' as const,
        }
      : registro?.locales?.[0];

    this.arrendatarioForm.patchValue(
      {
        arrendatario: arrendatarioNombre,
        tipoPersona: 2,
        estatusInmueble: 'RENTADO',
        renta: localDemo?.mensualidadMxn ?? '',
        direccionFiscal: demoLocal?.inmueble.direccion ?? '',
        fechaInicio: localDemo?.fechaInicio ?? '',
        fechaFin: localDemo?.fechaTermino ?? '',
        idArrendador: 1,
        tiempoRenta: '12',
        representanteLegal: nombreRepresentante,
        telefonoRepresentante: telefonoRep,
        correoRepresentante: correoRep,
        idInmueble: localDemo?.idInmueble ?? null,
        lat: '',
        lng: '',
      },
      { emitEvent: false },
    );
    if (localDemo?.idInmueble != null) {
      this.cargarLocalesLibres(localDemo.idInmueble, localDemo.idLocal ?? null);
    }

    const socio0 = this.sociosFormArray.at(0) as FormGroup;
    socio0?.patchValue(
      {
        nombre: registro?.razonSocial ?? arrendatarioNombre,
        rfc: registro?.rfc ?? '',
      },
      { emitEvent: false },
    );

    if (localDemo) {
      this.localesFormArray.clear();
      this.localesFormArray.push(
        this.fb.group({
          nombreLocal: [localDemo.nombreLocal ?? ''],
          estadoLocal: [''],
          mensualidadLocalMxn: [localDemo.mensualidadMxn ?? ''],
          zonaLocal: [localDemo.nivel ?? ''],
          ocupanteLocal: [arrendatarioNombre ?? ''],
          giroLocal: [''],
          medidaLocal: [localDemo.superficieM2 ? `${localDemo.superficieM2} m²` : ''],
          contratoHastaLocal: [localDemo.fechaTermino ?? ''],
          archivoContratoLocal: [''],
          numeroContratoLocal: [''],
          tipoModificacionContratoLocal: [''],
          arrendadorLocal: [arrendadorNombre ?? ''],
          arrendatarioLocal: [arrendatarioNombre ?? ''],
          fechaInicioContratoLocal: [localDemo.fechaInicio ?? ''],
          fechaTerminoContratoLocal: [localDemo.fechaTermino ?? ''],
          tipoMonedaLocal: [''],
          metrosRentadosLocal: [localDemo.superficieM2 ?? ''],
          costoPorM2Local: [''],
          pctMantenimientoLocal: [''],
          mesesDepositoLocal: [''],
          montoDepositoLocal: [''],
          mesesAdelantoLocal: [''],
          montoAdelantoLocal: [''],
          anosForzososArrendadorLocal: [''],
          anosForzososArrendatarioLocal: [''],
          subtotalRentaLocal: [''],
          ivaRentaLocal: [''],
          rentaTotalLocal: [''],
          subtotalMantenimientoLocal: [''],
          ivaMantenimientoLocal: [''],
          mantenimientoTotalLocal: [''],
          observacionesContratoLocal: [''],
        }),
      );
    }

    this.aplicarValidadoresTipoPersona(this.arrendatarioForm.get('tipoPersona')?.value);
  }

  private cargarDesdeGrid(data: any): void {
    this.arrendatarioForm.patchValue(
      {
        arrendatario: data.arrendatario || 'Arrendatario Demo',
        tipoPersona: 2,
        estatusInmueble: 'RENTADO',
        renta: data.mensualidadMxn || 25000,
        direccionFiscal: 'C. San Cristóbal 4, San Cristobal, 62250 Cuernavaca, Mor.',
        fechaInicio: '2024-01-01',
        fechaFin: '2027-01-01',
        idArrendador: 1,
        tiempoRenta: '12',
        representanteLegal: this.resolverNombreRepresentanteDemo(
          data.arrendatario || '',
        ),
        telefonoRepresentante: data.telefonoContacto || '7770000000',
        correoRepresentante: data.correoContacto || 'demo@correo.com',
        idInmueble: 1,
        lat: '',
        lng: '',
        fechaInicioContrato: '2024-01-01',
        fechaTerminoContrato: '2027-01-01',
        tipoMoneda: 'MXN',
        metrosRentados: data.superficieM2 || 100,
        costoPorM2: 350,
        pctMantenimiento: 10,
        mesesDeposito: 2,
        montoDeposito: 70000,
        mesesAdelanto: 1,
        montoAdelanto: 35000,
        anosForzososArrendador: 2,
        anosForzososArrendatario: 2,
        subtotalRenta: 35000,
        ivaRenta: 5600,
        rentaTotal: 40600,
        subtotalMantenimiento: 3500,
        ivaMantenimiento: 560,
        mantenimientoTotal: 4060,
        observaciones:
          'Contrato activo con condiciones estándar, incluye mantenimiento y servicios básicos.',
      },
      { emitEvent: false },
    );

    const servicios = this.arrendatarioForm.get('servicios') as FormArray;
    servicios.clear();
    const servicioRenta = this.crearServicioFormGroup();
    servicioRenta.patchValue(
      {
        servicioNumeroContrato: data.numeroContrato || 'RENTA-001',
        servicioFechaPago: '2024-02-01',
        servicioUltimoDiaPago: '2024-02-28',
        servicioComprobantePagoNombre: 'comprobante_renta.pdf',
      },
      { emitEvent: false },
    );
    servicios.push(servicioRenta);

    const servicioMtto = this.crearServicioFormGroup();
    servicioMtto.patchValue(
      {
        servicioNumeroContrato: 'MTTO-001',
        servicioFechaPago: '2024-02-01',
        servicioUltimoDiaPago: '2024-02-28',
        servicioComprobantePagoNombre: 'comprobante_mtto.pdf',
      },
      { emitEvent: false },
    );
    servicios.push(servicioMtto);
    this.syncServiciosIdsDesdeCatalogo();

    const socios = this.arrendatarioForm.get('socios') as FormArray;
    socios.clear();
    socios.push(this.crearSocioFormGroup());
    socios.at(0).patchValue(
      {
        nombre: 'Carlos Ramírez',
        rfc: 'CARL900101ABC',
      },
      { emitEvent: false },
    );

    const locales = this.arrendatarioForm.get('locales') as FormArray;
    locales.clear();
    const local = this.crearLocalFormGroup();
    local.patchValue(
      {
        nombreLocal: data.local || 'Local Demo',
        zonaLocal: data.nivel || 'Planta baja',
        medidaLocal: data.superficieM2 ? `${data.superficieM2} m²` : '100 m²',
        ocupanteLocal: data.arrendatario || 'Arrendatario Demo',
        mensualidadLocalMxn: data.mensualidadMxn || 25000,
        arrendatarioLocal: data.arrendatario || 'Arrendatario Demo',
        arrendadorLocal: data.arrendador || 'Inmuebles y Desarrollos HAC S.A de C.V.',
        numeroContratoLocal: data.numeroContrato || 'RENTA-001',
        fechaInicioContratoLocal: '2024-01-01',
        fechaTerminoContratoLocal: '2027-01-01',
        contratoHastaLocal: '2027-01-01',
      },
      { emitEvent: false },
    );
    locales.push(local);

    const galeria = this.arrendatarioForm.get('galeriaImagenes') as FormArray;
    galeria.clear();
    const imagen = this.crearGaleriaImagenFormGroup();
    imagen.patchValue(
      {
        archivo: null,
        nombre: 'fondonegro.png',
      },
      { emitEvent: false },
    );
    galeria.push(imagen);

    this.aplicarValidadoresTipoPersona(this.arrendatarioForm.get('tipoPersona')?.value);
  }

  private cargarArrendatarioParaEdicionDesdeApi(id: number): void {
    this.cargandoDetalle = true;
    this.abrirSwalCargando();
    this.arrendatariosService
      .obtenerArrendatario(id)
      .pipe(
        finalize(() => {
          Swal.close();
          this.cargandoDetalle = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (resp) => {
          const item = extraerArrendatarioDetalleApi(resp);
          if (!item || Object.keys(item).length === 0) {
            void Swal.fire({
              title: 'Sin datos',
              text: 'No se encontró información del arrendatario.',
              icon: 'warning',
              confirmButtonColor: '#3085d6',
              background: '#141a21',
              color: '#ffffff',
            });
            return;
          }
          this.poblarFormularioDesdeDetalleApi(item);
        },
        error: (err: unknown) => {
          const e = err as { error?: { message?: string }; message?: string };
          const text =
            e?.error?.message ??
            e?.message ??
            'No se pudo cargar el arrendatario. Intenta de nuevo.';
          void Swal.fire({
            title: 'Error al cargar',
            text: String(text),
            icon: 'error',
            confirmButtonColor: '#3085d6',
            background: '#141a21',
            color: '#ffffff',
          });
        },
      });
  }

  private poblarFormularioDesdeDetalleApi(item: Record<string, unknown>): void {
    const lat = this.numOptLocal(item['lat']);
    const lng = this.numOptLocal(item['lng']);
    const idArr = this.idArrendadorDesdeItem(item);
    const tp = this.numOptLocal(item['tipoPersona']);

    this.arrendatarioForm.patchValue(
      {
        arrendatario: this.strApi(item['arrendatario'] ?? item['nombre']),
        tipoPersona: tp != null && tp > 0 ? tp : null,
        renta: this.numForm(item['renta']),
        direccionFiscal: this.strApi(item['direccionFiscal']),
        fechaInicio: fechaParaInputDate(String(item['fechaInicio'] ?? '')),
        fechaFin: fechaParaInputDate(String(item['fechaFin'] ?? '')),
        idArrendador: idArr,
        estatusInmueble:
          item['estatusInmueble'] != null && String(item['estatusInmueble']).trim() !== ''
            ? String(item['estatusInmueble'])
            : item['estatus'] != null && String(item['estatus']).trim() !== ''
              ? String(item['estatus'])
              : null,
        tiempoRenta: this.strApi(item['tiempoRenta']),
        representanteLegal: this.strApi(item['representanteLegal']),
        telefonoRepresentante: this.strApi(item['telefonoRepresentante']),
        correoRepresentante: this.strApi(item['correoRepresentante']),
        lat: lat != null ? String(lat) : '',
        lng: lng != null ? String(lng) : '',
      },
      { emitEvent: false },
    );

    const c = this.primerContratoRegistro(item);
    if (c) {
      const idIm = this.idInmuebleDesdeContrato(c);
      const idLoc = this.idLocalDesdeContrato(c);
      this.arrendatarioForm.patchValue(
        {
          idInmueble: idIm,
          fechaInicioContrato: fechaParaInputDate(String(c['fechaInicioContrato'] ?? '')),
          fechaTerminoContrato: fechaParaInputDate(String(c['fechaTerminoContrato'] ?? '')),
          tipoMoneda: this.strApi(c['moneda'] ?? c['tipoMoneda']) || 'MXN',
          metrosRentados: this.numForm(c['metrosRentados']),
          costoPorM2: this.numForm(c['costoM2'] ?? c['costoPorM2']),
          pctMantenimiento: this.numForm(c['porcentajeMantenimiento'] ?? c['pctMantenimiento']),
          mesesDeposito: this.numForm(c['mesesDeposito']),
          montoDeposito: this.numForm(c['montoDeposito']),
          mesesAdelanto: this.numForm(c['mesesAdelanto']),
          montoAdelanto: this.numForm(c['montoAdelanto']),
          anosForzososArrendador: this.numForm(
            c['aniosForzososArrendador'] ?? c['anosForzososArrendador'],
          ),
          anosForzososArrendatario: this.numForm(
            c['aniosForzososArrendatario'] ?? c['anosForzososArrendatario'],
          ),
          subtotalRenta: this.numForm(c['subTotalRenta'] ?? c['subtotalRenta']),
          ivaRenta: this.numForm(c['ivaRenta']),
          rentaTotal: this.numForm(c['rentaTotal']),
          subtotalMantenimiento: this.numForm(c['subTotalMantenimiento'] ?? c['subtotalMantenimiento']),
          ivaMantenimiento: this.numForm(c['ivaMantenimiento']),
          mantenimientoTotal: this.numForm(c['mantenimientoTotal']),
          observaciones: this.strApi(c['observaciones']),
        },
        { emitEvent: false },
      );
      if (idIm != null) {
        this.cargarLocalesLibres(idIm, idLoc);
      }
    }

    const serviciosRaw = item['servicios'];
    this.serviciosFormArray.clear();
    if (Array.isArray(serviciosRaw) && serviciosRaw.length > 0) {
      for (const raw of serviciosRaw) {
        const s = raw as Record<string, unknown>;
        const g = this.crearServicioFormGroup();
        const idTipo = Number(s['idTipoServicio']);
        g.patchValue(
          {
            idTipoServicio: Number.isFinite(idTipo) && idTipo > 0 ? Math.trunc(idTipo) : null,
            servicioNumeroContrato: this.strApi(s['numeroContrato']),
            servicioFechaPago: fechaParaInputDate(String(s['fechaPago'] ?? '')),
            servicioUltimoDiaPago: fechaParaInputDate(String(s['ultimoDiaPago'] ?? '')),
            servicioComprobantePago: null,
            servicioComprobantePagoNombre: '',
            servicioComprobantePagoUrl: this.strApi(s['urlComprobante'] ?? s['url']),
          },
          { emitEvent: false },
        );
        this.serviciosFormArray.push(g);
      }
    } else {
      this.serviciosFormArray.push(this.crearServicioFormGroup());
      this.serviciosFormArray.push(this.crearServicioFormGroup());
      this.syncServiciosIdsDesdeCatalogo();
    }

    this.sociosFormArray.clear();
    const sociosRaw = item['socios'];
    if (Array.isArray(sociosRaw) && sociosRaw.length > 0) {
      for (const raw of sociosRaw) {
        const s = raw as Record<string, unknown>;
        const g = this.crearSocioFormGroup();
        g.patchValue(
          {
            nombre: this.strApi(s['nombre']),
            rfc: this.strApi(s['rfc']),
            constanciaFiscalArchivo: null,
            comprobanteDomicilioArchivo: null,
            identificacionOficialArchivo: null,
          },
          { emitEvent: false },
        );
        this.sociosFormArray.push(g);
      }
    } else {
      this.sociosFormArray.push(this.crearSocioFormGroup());
    }

    this.localesFormArray.clear();
    this.localesFormArray.push(this.crearLocalFormGroup());

    this.aplicarArchivosEImagenesDesdeDetalle(item);

    this.aplicarValidadoresTipoPersona(this.arrendatarioForm.get('tipoPersona')?.value);
    this.cdr.markForCheck();
  }

  private aplicarArchivosEImagenesDesdeDetalle(item: Record<string, unknown>): void {
    const archivos = (Array.isArray(item['archivos']) ? item['archivos'] : []) as InmuebleArchivoApi[];
    const imagenes = (Array.isArray(item['imagenes']) ? item['imagenes'] : []) as InmuebleArchivoApi[];
    const { documentos, galeria } = separarArchivosInmueble(archivos, imagenes);
    this.resetVistasDocumentosEnlaces();
    this.aplicarDocumentosClasificadosArrendatario(documentos);

    this.galeriaImagenesFormArray.clear();
    if (galeria.length > 0) {
      for (const im of galeria) {
        const gg = this.crearGaleriaImagenFormGroup();
        const url = String(im.url ?? '').trim();
        const nombre =
          String(im.nombre ?? '').trim() ||
          (url ? (url.split('/').pop() ?? '').split('?')[0] ?? '' : '');
        gg.patchValue({ archivo: null, nombre, url }, { emitEvent: false });
        this.galeriaImagenesFormArray.push(gg);
      }
    } else {
      this.galeriaImagenesFormArray.push(this.crearGaleriaImagenFormGroup());
    }
  }

  private resetVistasDocumentosEnlaces(): void {
    this.imagenPlanoNombre = null;
    this.imagenPlanoUrl = null;
    this.contratoRentaNombre = null;
    this.contratoRentaUrl = null;
    this.constanciaFiscalNombre = null;
    this.constanciaFiscalUrl = null;
    this.constanciaRepLegalNombre = null;
    this.constanciaRepLegalUrl = null;
    this.comprobanteDomicilioNombre = null;
    this.comprobanteDomicilioUrl = null;
    this.ineRepresentanteNombre = null;
    this.ineRepresentanteUrl = null;
  }

  private aplicarDocumentosClasificadosArrendatario(
    documentos: Partial<Record<SlotDocumentoInmueble, InmuebleArchivoApi>>,
  ): void {
    const url = (d?: InmuebleArchivoApi): string => String(d?.url ?? '').trim();
    const nom = (d: InmuebleArchivoApi | undefined, fb: string): string => {
      const n = String(d?.nombre ?? '').trim();
      return n || fb;
    };
    const has = (d?: InmuebleArchivoApi): boolean => url(d).length > 0;

    if (has(documentos.contratoRenta)) {
      this.contratoRentaUrl = url(documentos.contratoRenta);
      this.contratoRentaNombre = nom(documentos.contratoRenta, 'Contrato de renta');
    }
    if (has(documentos.constanciaFiscal)) {
      this.constanciaFiscalUrl = url(documentos.constanciaFiscal);
      this.constanciaFiscalNombre = nom(documentos.constanciaFiscal, 'Constancia de situación fiscal');
    }
    if (has(documentos.comprobanteDomicilio)) {
      this.comprobanteDomicilioUrl = url(documentos.comprobanteDomicilio);
      this.comprobanteDomicilioNombre = nom(documentos.comprobanteDomicilio, 'Comprobante de domicilio');
    }
    if (has(documentos.constanciaRepLegal)) {
      this.constanciaRepLegalUrl = url(documentos.constanciaRepLegal);
      this.constanciaRepLegalNombre = nom(
        documentos.constanciaRepLegal,
        'Constancia fiscal representante legal',
      );
    }
    if (has(documentos.ineRepresentante)) {
      this.ineRepresentanteUrl = url(documentos.ineRepresentante);
      this.ineRepresentanteNombre = nom(documentos.ineRepresentante, 'Identificación oficial');
    }
    if (has(documentos.fachada)) {
      this.imagenPlanoUrl = url(documentos.fachada);
      this.imagenPlanoNombre = nom(documentos.fachada, 'Fachada');
    }
  }

  private primerContratoRegistro(item: Record<string, unknown>): Record<string, unknown> | null {
    const contratos = item['contratos'];
    if (!Array.isArray(contratos) || contratos.length === 0) return null;
    const c0 = contratos[0];
    if (c0 == null || typeof c0 !== 'object') return null;
    return c0 as Record<string, unknown>;
  }

  private idInmuebleDesdeContrato(c: Record<string, unknown>): number | null {
    const direct = Number(c['idInmueble']);
    if (Number.isFinite(direct) && direct > 0) return Math.trunc(direct);
    const inm = c['inmueble'];
    if (inm != null && typeof inm === 'object') {
      const id = Number((inm as Record<string, unknown>)['id']);
      if (Number.isFinite(id) && id > 0) return Math.trunc(id);
    }
    return null;
  }

  private idLocalDesdeContrato(c: Record<string, unknown>): number | null {
    const direct = Number(c['idLocal']);
    if (Number.isFinite(direct) && direct > 0) return Math.trunc(direct);
    const loc = c['local'];
    if (loc != null && typeof loc === 'object') {
      const id = Number((loc as Record<string, unknown>)['id'] ?? (loc as Record<string, unknown>)['idLocal']);
      if (Number.isFinite(id) && id > 0) return Math.trunc(id);
    }
    return null;
  }

  private idArrendadorDesdeItem(item: Record<string, unknown>): number | null {
    const direct = Number(item['idArrendador']);
    if (Number.isFinite(direct) && direct > 0) return Math.trunc(direct);
    const arr = item['arrendador'];
    if (arr != null && typeof arr === 'object') {
      const id = Number((arr as Record<string, unknown>)['id']);
      if (Number.isFinite(id) && id > 0) return Math.trunc(id);
    }
    return null;
  }

  private numOptLocal(v: unknown): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private strApi(v: unknown): string {
    if (v == null) return '';
    return String(v).trim();
  }

  private numForm(v: unknown): string | number {
    if (v == null || v === '') return '';
    const n = Number(v);
    return Number.isFinite(n) ? n : '';
  }

  private asignarListaClientes(res: unknown): void {
    const r = res as { data?: unknown[] } | unknown[] | null;
    const rows = Array.isArray(r) ? r : ((r as { data?: unknown[] })?.data ?? []);
    this.listaClientes = Array.isArray(rows)
      ? rows.map((c) => {
          const row = c as Record<string, unknown>;
          return { ...row, id: Number(row['id']) };
        })
      : [];
  }

  private asignarListaInmuebles(res: unknown): void {
    const bag = res as { data?: unknown[] } | null;
    const rows = Array.isArray(bag?.data) ? bag.data : [];
    const items = rows
      .map((raw) => {
        const row = raw as Record<string, unknown>;
        const id = Number(row['id']);
        if (!Number.isFinite(id)) return null;
        const nombre = String(row['inmueble'] ?? '').trim() || 'Inmueble';
        const dir = String(row['direccionFiscal'] ?? '').trim();
        const etiqueta = dir ? `${nombre} — ${dir}` : nombre;
        return { id, etiqueta };
      })
      .filter((x): x is { id: number; etiqueta: string } => x != null);
    items.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
    this.listaInmuebles = items;
  }

  private extraerFilasCatServicios(res: unknown): CatServicioItem[] {
    const r = res as { data?: unknown } | unknown[] | null;
    if (r == null) return [];
    let rows: unknown = Array.isArray(r) ? r : (r as { data?: unknown }).data;
    if (rows != null && typeof rows === 'object' && !Array.isArray(rows)) {
      const bag = rows as Record<string, unknown>;
      rows = bag['items'] ?? bag['rows'] ?? bag['content'] ?? bag['data'];
    }
    if (!Array.isArray(rows)) return [];
    return rows
      .map((item) => {
        const row = item as Record<string, unknown>;
        const id = Number(row['id'] ?? row['idTipoServicio'] ?? row['idCatServicio']);
        if (!Number.isFinite(id)) return null;
        return {
          id,
          nombre: row['nombre'] != null ? String(row['nombre']) : undefined,
          servicio: row['servicio'] != null ? String(row['servicio']) : undefined,
          descripcion: row['descripcion'] != null ? String(row['descripcion']) : undefined,
        } as CatServicioItem;
      })
      .filter((item): item is CatServicioItem => item != null);
  }

  private syncServiciosIdsDesdeCatalogo(): void {
    const rentaId = this.buscarIdServicioPorNombre(/renta/i);
    const mttoId = this.buscarIdServicioPorNombre(/mantenimiento/i);
    if (this.serviciosFormArray.length >= 1 && rentaId != null) {
      (this.serviciosFormArray.at(0) as FormGroup).patchValue({ idTipoServicio: rentaId }, { emitEvent: false });
    }
    if (this.serviciosFormArray.length >= 2 && mttoId != null) {
      (this.serviciosFormArray.at(1) as FormGroup).patchValue({ idTipoServicio: mttoId }, { emitEvent: false });
    }
  }

  private buscarIdServicioPorNombre(rx: RegExp): number | null {
    const hit = this.listaCatServicios.find((s) => {
      const t = `${s.nombre ?? ''} ${s.servicio ?? ''} ${s.descripcion ?? ''}`;
      return rx.test(t);
    });
    return hit?.id ?? null;
  }

  private readonly controlesExcluidosValidacion = new Set<string>([
    'locales',
    'pagos',
    'servicios',
    'socios',
    'galeriaImagenes',
    'documentoPlano',
    'documentoContratoRenta',
    'documentoConstanciaFiscal',
    'constanciaSituacionFiscalRepresentanteLegal',
    'documentoComprobanteDomicilio',
    'ineRepresentanteLegal',
    'lat',
    'lng',
  ]);

  private readonly etiquetasCampos: Record<string, string> = {
    arrendatario: 'Nombre del arrendatario',
    tipoPersona: 'Tipo de persona',
    renta: 'Renta',
    direccionFiscal: 'Dirección fiscal',
    estatusInmueble: 'Estatus del arrendamiento',
    fechaInicio: 'Fecha de inicio',
    fechaFin: 'Fecha de fin',
    idArrendador: 'Arrendador',
    tiempoRenta: 'Tiempo de renta',
    representanteLegal: 'Representante legal',
    telefonoRepresentante: 'Teléfono del representante',
    correoRepresentante: 'Correo del representante',
    idInmueble: 'Inmueble (contrato)',
    idLocal: 'Local (contrato)',
    fechaInicioContrato: 'Inicio de contrato',
    fechaTerminoContrato: 'Término de contrato',
    tipoMoneda: 'Moneda',
    metrosRentados: 'Metros rentados',
    costoPorM2: 'Costo por m²',
    pctMantenimiento: 'Porcentaje mantenimiento',
    mesesDeposito: 'Meses depósito',
    montoDeposito: 'Monto depósito',
    mesesAdelanto: 'Meses adelanto',
    montoAdelanto: 'Monto adelanto',
    anosForzososArrendador: 'Años forzosos arrendador',
    anosForzososArrendatario: 'Años forzosos arrendatario',
    subtotalRenta: 'Subtotal renta',
    ivaRenta: 'IVA renta',
    rentaTotal: 'Renta total',
    subtotalMantenimiento: 'Subtotal mantenimiento',
    ivaMantenimiento: 'IVA mantenimiento',
    mantenimientoTotal: 'Mantenimiento total',
    observaciones: 'Observaciones',
  };

  private validarFormularioAntesMapa(): boolean {
    this.aplicarValidadoresTipoPersona(this.arrendatarioForm.get('tipoPersona')?.value);

    this.arrendatarioForm.markAllAsTouched();
    this.serviciosFormArray.controls.forEach((c) => (c as FormGroup).markAllAsTouched());
    this.sociosFormArray.controls.forEach((c) => (c as FormGroup).markAllAsTouched());

    const faltantes = this.recopilarCamposFaltantes();
    if (faltantes.length === 0) return true;

    const lista = faltantes
      .map(
        (campo, index) => `
        <div style="padding: 8px 12px; border-left: 4px solid #d9534f;
                    background: #caa8a8; text-align: center; margin-bottom: 8px;
                    border-radius: 4px;">
          <strong style="color: #b02a37;">${index + 1}. ${campo}</strong>
        </div>
      `,
      )
      .join('');

    void Swal.fire({
      title: '¡Revise el formulario!',
      html: `
        <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
          Faltan campos obligatorios según el formulario y el API.
          Los campos excluidos de validación (documentos, coordenadas, etc.) no se listan aquí.
        </p>
        <div style="max-height: 350px; overflow-y: auto;">${lista}</div>
      `,
      icon: 'error',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#3085d6',
      background: '#141a21',
      color: '#ffffff',
      customClass: { popup: 'swal2-padding swal2-border' },
    });
    return false;
  }

  /** Fila de servicios considerada «en uso»: si eligieron tipo de servicio, deben completar datos mínimos. */
  private servicioFilaActiva(grupo: FormGroup): boolean {
    const raw = grupo.get('idTipoServicio')?.value;
    if (raw == null || raw === '') return false;
    return Number.isFinite(Number(raw));
  }

  private recopilarCamposFaltantes(): string[] {
    const faltantes: string[] = [];
    Object.keys(this.arrendatarioForm.controls).forEach((key) => {
      if (this.controlesExcluidosValidacion.has(key)) return;

      const control = this.arrendatarioForm.get(key);
      if (!control || control.disabled) return;
      if (control.invalid) {
        faltantes.push(this.etiquetasCampos[key] ?? key);
      }
    });

    this.serviciosFormArray.controls.forEach((ctrl, i) => {
      const g = ctrl as FormGroup;
      if (!this.servicioFilaActiva(g)) return;
      const etiquetaPref = `Servicio ${i + 1}`;
      const nc = String(g.get('servicioNumeroContrato')?.value ?? '').trim();
      const fp = String(g.get('servicioFechaPago')?.value ?? '').trim();
      const ulp = String(g.get('servicioUltimoDiaPago')?.value ?? '').trim();
      if (!nc) faltantes.push(`${etiquetaPref}: número de contrato`);
      if (!fp) faltantes.push(`${etiquetaPref}: fecha de pago`);
      if (!ulp) faltantes.push(`${etiquetaPref}: último día de pago`);
    });

    /** Socios: sin validadores en filas vacías; no se bloquean filas incompletasssss. */

    return faltantes;
  }

  private appendEntero(fd: FormData, key: string, value: unknown): void {
    if (value == null || value === '') return;
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    fd.append(key, String(Math.trunc(n)));
  }

  private numJson(value: unknown): number | undefined {
    if (value == null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  /** JSON `arrendatario`: campos ArrendatarioJsonDto (string en multipart FormData). */
  private construirJsonArrendatarioSwagger(v: Record<string, unknown>): string {
    const dto: Record<string, unknown> = {
      fechaInicio: String(v['fechaInicio'] ?? '').trim(),
      fechaFin: String(v['fechaFin'] ?? '').trim(),
      arrendatario: String(v['arrendatario'] ?? '').trim(),
      correoRepresentante: String(v['correoRepresentante'] ?? '').trim(),
      telefonoRepresentante: String(v['telefonoRepresentante'] ?? '').trim(),
      representanteLegal: String(v['representanteLegal'] ?? '').trim(),
    };

    const df = String(v['direccionFiscal'] ?? '').trim();
    if (df) dto['direccionFiscal'] = df;

    const tp = Number(v['tipoPersona']);
    if (Number.isFinite(tp)) dto['tipoPersona'] = Math.trunc(tp);

    const idArr = Number(v['idArrendador']);
    if (Number.isFinite(idArr)) dto['idArrendador'] = Math.trunc(idArr);

    const rentaNum = this.numJson(v['renta']);
    if (rentaNum !== undefined) dto['renta'] = rentaNum;
    const tr = String(v['tiempoRenta'] ?? '').trim();
    if (tr) dto['tiempoRenta'] = tr;

    const lat = Number(v['lat']);
    const lng = Number(v['lng']);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      dto['lat'] = lat;
      dto['lng'] = lng;
    }

    return JSON.stringify(dto);
  }

  private logMultipartArrendatario(fd: FormData): void {
    const entradas: Record<string, string> = {};
    fd.forEach((value, key) => {
      if (value instanceof File) entradas[key] = `[File: ${value.name} (${value.size} B)]`;
      else entradas[key] = value;
    });
    console.log('[agregar-arrendatario] POST /arrendatarios multipart (clave → valor)', entradas);
  }

  /**
   * Archivos de la sección «Documentos e Imágenes» (whitelist).
   * Socios, servicios y contrato van por sus propias claves en multipart; no mezclar aquí.
   */
  private readonly documentosMultipartArrendatario: ReadonlyArray<{
    control: string;
    nombre: string;
    coleccion: 'archivos' | 'imagenes';
  }> = [
    { control: 'documentoContratoRenta', nombre: 'Contrato de renta', coleccion: 'archivos' },
    { control: 'documentoConstanciaFiscal', nombre: 'Constancia de situación fiscal', coleccion: 'archivos' },
    { control: 'documentoComprobanteDomicilio', nombre: 'Comprobante de domicilio', coleccion: 'archivos' },
    {
      control: 'constanciaSituacionFiscalRepresentanteLegal',
      nombre: 'Constancia fiscal representante legal',
      coleccion: 'archivos',
    },
    {
      control: 'ineRepresentanteLegal',
      nombre: 'Identificación oficial representante legal',
      coleccion: 'archivos',
    },
    { control: 'documentoPlano', nombre: 'Fachada', coleccion: 'imagenes' },
  ];

  /**
   * Swagger `socios[]`: `socios[i].nombre`, `rfc`, `constanciaFiscalArchivo`,
   * `comprobanteDomicilioArchivo`, `identificacionOficialArchivo` (multipart).
   */
  private adjuntarSociosMultipart(fd: FormData): void {
    let i = 0;
    this.sociosFormArray.controls.forEach((ctrl) => {
      const g = ctrl as FormGroup;
      const nombre = String(g.get('nombre')?.value ?? '').trim();
      const rfc = String(g.get('rfc')?.value ?? '').trim();
      const constancia = g.get('constanciaFiscalArchivo')?.value;
      const comprobante = g.get('comprobanteDomicilioArchivo')?.value;
      const identificacion = g.get('identificacionOficialArchivo')?.value;

      const tieneFila =
        !!nombre ||
        !!rfc ||
        constancia instanceof File ||
        comprobante instanceof File ||
        identificacion instanceof File;
      if (!tieneFila) return;

      fd.append(`socios[${i}].nombre`, nombre || 'Socio');
      if (rfc) fd.append(`socios[${i}].rfc`, rfc);
      if (constancia instanceof File) {
        fd.append(`socios[${i}].constanciaFiscalArchivo`, constancia, constancia.name);
      }
      if (comprobante instanceof File) {
        fd.append(`socios[${i}].comprobanteDomicilioArchivo`, comprobante, comprobante.name);
      }
      if (identificacion instanceof File) {
        fd.append(`socios[${i}].identificacionOficialArchivo`, identificacion, identificacion.name);
      }
      i += 1;
    });
  }

  private adjuntarDocumentosPermitidosArrendatario(
    fd: FormData,
    v: Record<string, unknown>,
  ): void {
    let ai = 0;
    let ii = 0;

    const pushArchivo = (file: unknown, nombre: string): void => {
      if (!(file instanceof File)) return;
      fd.append(`archivos[${ai}].nombre`, nombre);
      fd.append(`archivos[${ai}].archivo`, file, file.name);
      ai += 1;
    };

    const pushImagen = (file: unknown, nombre: string): void => {
      if (!(file instanceof File)) return;
      fd.append(`imagenes[${ii}].nombre`, nombre || file.name);
      fd.append(`imagenes[${ii}].archivo`, file, file.name);
      ii += 1;
    };

    for (const doc of this.documentosMultipartArrendatario) {
      const file = v[doc.control];
      if (doc.coleccion === 'archivos') {
        pushArchivo(file, doc.nombre);
      } else {
        pushImagen(file, doc.nombre);
      }
    }

    this.galeriaImagenesFormArray.controls.forEach((galCtrl, index) => {
      const g = galCtrl as FormGroup;
      const f = g.get('archivo')?.value;
      const nom = String(g.get('nombre')?.value ?? '').trim();
      if (f instanceof File) {
        fd.append(`imagenes[${ii}].nombre`, nom || f.name || `Imagen ${index + 1}`);
        fd.append(`imagenes[${ii}].archivo`, f, f.name);
        ii += 1;
      }
    });
  }

  private construirFormDataArrendatario(): FormData {
    const fd = new FormData();
    const v = this.arrendatarioForm.getRawValue() as Record<string, unknown>;

    fd.append('arrendatario', this.construirJsonArrendatarioSwagger(v));

    const idInmRaw = v['idInmueble'];
    const idInm =
      idInmRaw != null && String(idInmRaw).trim() !== '' ? Number(idInmRaw) : Number.NaN;

    const contrato: Record<string, unknown> = {};
    if (Number.isFinite(idInm)) contrato['idInmueble'] = Math.trunc(idInm);
    const idLocRaw = v['idLocal'];
    const idLoc =
      idLocRaw != null && String(idLocRaw).trim() !== '' ? Number(idLocRaw) : Number.NaN;
    if (Number.isFinite(idLoc)) contrato['idLocal'] = Math.trunc(idLoc);
    const fiC = String(v['fechaInicioContrato'] ?? '').trim();
    if (fiC) contrato['fechaInicioContrato'] = fiC;
    const ftC = String(v['fechaTerminoContrato'] ?? '').trim();
    if (ftC) contrato['fechaTerminoContrato'] = ftC;
    const moneda = String(v['tipoMoneda'] ?? '').trim();
    if (moneda) contrato['moneda'] = moneda;
    const obs = String(v['observaciones'] ?? '').trim();
    if (obs) contrato['observaciones'] = obs;
    const mr = this.numJson(v['metrosRentados']);
    if (mr !== undefined) contrato['metrosRentados'] = mr;
    const cm2 = this.numJson(v['costoPorM2']);
    if (cm2 !== undefined) contrato['costoM2'] = cm2;
    const pct = this.numJson(v['pctMantenimiento']);
    if (pct !== undefined) contrato['porcentajeMantenimiento'] = pct;
    const mdMes = this.numJson(v['mesesDeposito']);
    if (mdMes !== undefined) contrato['mesesDeposito'] = mdMes;
    const mdMon = this.numJson(v['montoDeposito']);
    if (mdMon !== undefined) contrato['montoDeposito'] = mdMon;
    const maMes = this.numJson(v['mesesAdelanto']);
    if (maMes !== undefined) contrato['mesesAdelanto'] = maMes;
    const maMon = this.numJson(v['montoAdelanto']);
    if (maMon !== undefined) contrato['montoAdelanto'] = maMon;
    const afa = this.numJson(v['anosForzososArrendador']);
    if (afa !== undefined) contrato['aniosForzososArrendador'] = afa;
    const afAt = this.numJson(v['anosForzososArrendatario']);
    if (afAt !== undefined) contrato['aniosForzososArrendatario'] = afAt;
    const str = this.numJson(v['subtotalRenta']);
    if (str !== undefined) contrato['subTotalRenta'] = str;
    const ivaR = this.numJson(v['ivaRenta']);
    if (ivaR !== undefined) contrato['ivaRenta'] = ivaR;
    const rt = this.numJson(v['rentaTotal']);
    if (rt !== undefined) contrato['rentaTotal'] = rt;
    const stm = this.numJson(v['subtotalMantenimiento']);
    if (stm !== undefined) contrato['subTotalMantenimiento'] = stm;
    const ivaM = this.numJson(v['ivaMantenimiento']);
    if (ivaM !== undefined) contrato['ivaMantenimiento'] = ivaM;
    const mt = this.numJson(v['mantenimientoTotal']);
    if (mt !== undefined) contrato['mantenimientoTotal'] = mt;

    if (Object.keys(contrato).length > 0) {
      fd.append('contratoArrendatario', JSON.stringify(contrato));
    }

    let si = 0;
    this.serviciosFormArray.controls.forEach((ctrl) => {
      const g = ctrl as FormGroup;
      const idTipoRaw = g.get('idTipoServicio')?.value;
      const idTipo =
        idTipoRaw != null && idTipoRaw !== '' ? Number(idTipoRaw) : Number.NaN;
      if (!Number.isFinite(idTipo)) return;
      this.appendEntero(fd, `servicios[${si}].idTipoServicio`, idTipo);
      const nc = g.get('servicioNumeroContrato')?.value;
      if (nc != null && String(nc).trim() !== '') {
        fd.append(`servicios[${si}].numeroContrato`, String(nc).trim());
      }
      const fp = String(g.get('servicioFechaPago')?.value ?? '').trim();
      if (fp) fd.append(`servicios[${si}].fechaPago`, fp);
      const ulp = String(g.get('servicioUltimoDiaPago')?.value ?? '').trim();
      if (ulp) fd.append(`servicios[${si}].ultimoDiaPago`, ulp);
      si += 1;
    });

    this.adjuntarDocumentosPermitidosArrendatario(fd, v);
    this.adjuntarSociosMultipart(fd);

    return fd;
  }

  private abrirSwalCargando(): void {
    void Swal.fire({
      title: 'Cargando...',
      background: '#141a21',
      color: '#ffffff',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
  }

  private cerrarSwalCargandoYRedirigirArrendatarios(inicioPeticion: number): void {
    const restanteMs = Math.max(0, 2000 - (Date.now() - inicioPeticion));
    setTimeout(() => {
      Swal.close();
      this.loadingSubmit = false;
      void this.router.navigateByUrl('/arrendatarios');
    }, restanteMs);
  }

  private ejecutarGuardadoArrendatario(): void {
    this.loadingSubmit = true;
    const inicio = Date.now();
    this.abrirSwalCargando();
    const fd = this.construirFormDataArrendatario();
    this.logMultipartArrendatario(fd);

    const req =
      this.idArrendatario != null && Number.isFinite(Number(this.idArrendatario))
        ? this.arrendatariosService.actualizarArrendatario(Number(this.idArrendatario), fd)
        : this.arrendatariosService.crearArrendatario(fd);

    req.subscribe({
      next: () => this.cerrarSwalCargandoYRedirigirArrendatarios(inicio),
      error: (err: unknown) => {
        Swal.close();
        this.loadingSubmit = false;
        const e = err as { error?: { message?: string }; message?: string };
        const text =
          e?.error?.message ??
          e?.message ??
          'No se pudo guardar el arrendatario. Verifique la información e intente de nuevo.';
        void Swal.fire({
          title: 'No se pudo guardar',
          text: String(text),
          icon: 'error',
          confirmButtonColor: '#3085d6',
          background: '#141a21',
          color: '#ffffff',
        });
      },
    });
  }

  submit(): void {
    if (!this.validarFormularioAntesMapa()) return;
    if (this.tieneCoordenadasEnFormulario()) {
      this.ejecutarGuardadoArrendatario();
    } else {
      this.abrirModalMapaParaGuardar();
    }
  }

  private buscarLocalDemoPorId(idLocal: number): {
    inmueble: (typeof INMUEBLES_ARRENDATARIOS_DEMO)[number];
    local: (typeof INMUEBLES_ARRENDATARIOS_DEMO)[number]['locales'][number];
  } | null {
    for (const inmueble of INMUEBLES_ARRENDATARIOS_DEMO) {
      const local = inmueble.locales.find((l) => l.idLocal === idLocal);
      if (local) return { inmueble, local };
    }
    return null;
  }

  private resolverNombreRepresentanteDemo(arrendatarioNombre: string): string {
    const key = String(arrendatarioNombre ?? '').trim().toLowerCase();
    const map: Record<string, string> = {
      'little caesars': 'Paola Méndez',
      'farmacia san pablo': 'Ricardo Ortega',
      'joyerías nice': 'Gabriela Salinas',
      'spring telecom méxico': 'Luis Fernando Ríos',
    };
    return map[key] ?? 'Representante Demo';
  }

  regresar(): void {
    void this.router.navigateByUrl('/arrendatarios');
  }
}
