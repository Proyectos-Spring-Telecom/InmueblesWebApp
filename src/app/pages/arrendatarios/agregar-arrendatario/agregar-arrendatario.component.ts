import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
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

type ServicioArrendatarioEdicionSnap = {
  id: number | null;
  idTipoServicio: number | null;
  numeroContrato: string;
  fechaPago: string;
  ultimoDiaPago: string;
  comprobanteUrl: string;
};

type SocioArrendatarioEdicionSnap = {
  id: number | null;
  nombre: string;
  rfc: string;
  uCsf: string;
  uCd: string;
  uIne: string;
};

type DocSlotArrendatarioSnap = { id: number | null; nombre: string; url: string };
type GaleriaArrendatarioSnap = { id: number | null; nombre: string; url: string };

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
  /** Inmuebles del arrendador seleccionado (GET `/inmuebles/arrendador/{id}`). */
  public listaInmuebles: { id: number; etiqueta: string }[] = [];
  cargandoInmueblesArrendador = false;
  /** GET `/inmuebles/arrendador/{id}` ya respondió (p. ej. `[]` = sin inmuebles). */
  inmueblesArrendadorConsultados = false;
  /** Opciones del tag-box por contrato (GET `/inmuebles/locales-libres/{idInmueble}`). */
  localesLibresPorContrato: { id: number; nombre: string; etiqueta: string }[][] = [[]];
  cargandoLocalesPorContrato: boolean[] = [false];
  /** GET locales-libres ya respondió por contrato (p. ej. `[]` = sin locales). */
  localesLibresConsultadosPorContrato: boolean[] = [false];
  /** Índice del contrato cuyo menú de locales está abierto (-1 = ninguno). */
  localesDropdownContratoIndex = -1;
  private contratosInmuebleSubs: Subscription[] = [];
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
  private idArrendadorSub?: Subscription;

  /** Última respuesta de documentos del GET (ids por slot). */
  private documentosApiUltimaCarga: Partial<Record<SlotDocumentoInmueble, InmuebleArchivoApi>> = {};
  private serviciosEdicionSnapshots: ServicioArrendatarioEdicionSnap[] | null = null;
  private sociosEdicionSnapshots: SocioArrendatarioEdicionSnap[] | null = null;
  private documentosEdicionSnapshots: Partial<Record<string, DocSlotArrendatarioSnap>> | null = null;
  private galeriaEdicionSnapshots: GaleriaArrendatarioSnap[] | null = null;
  /** Firma estable del arreglo `contratos` tras cargar edición (sin campos excluidos por API). */
  private contratoEdicionSnapshotJson: string | null = null;

  private readonly controlDocumentoASlot: Record<string, SlotDocumentoInmueble> = {
    documentoContratoRenta: 'contratoRenta',
    documentoConstanciaFiscal: 'constanciaFiscal',
    documentoComprobanteDomicilio: 'comprobanteDomicilio',
    constanciaSituacionFiscalRepresentanteLegal: 'constanciaRepLegal',
    ineRepresentanteLegal: 'ineRepresentante',
    documentoPlano: 'fachada',
  };

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
    this.inicializarContratosArrendatarioLogic();
    this.enlazarInmueblesArrendador();
    this.actualizarEstadoInmuebleContratos();
    this.formValueLogSub = this.arrendatarioForm.valueChanges
      .pipe(debounceTime(this.debounceLogMs))
      .subscribe(() => {
        const raw = this.arrendatarioForm.getRawValue() as Record<string, unknown>;
        const { contratos: _contratosForm, ...restoFormulario } = raw;
        console.log('[agregar-arrendatario] valor del formulario (tras pausa de escritura)', {
          value: restoFormulario,
          contratos: this.construirContratosArrendatarioDesdeFormulario(),
        });
      });

    forkJoin({
      clientes: this.clientesService.obtenerClientes().pipe(catchError(() => of(null))),
      catServicios: this.catServiciosService
        .obtenerServiciosPaginados(1, 30)
        .pipe(catchError(() => of(null))),
    }).subscribe(({ clientes, catServicios }) => {
      this.asignarListaClientes(clientes);
      if (catServicios != null) {
        this.listaCatServicios = this.extraerFilasCatServicios(catServicios);
      } else {
        this.listaCatServicios = [];
      }
      /** No pisar filas cargadas desde el GET en edición (Renta/Mantenimiento solo para formulario vacío). */
      if (!this.esEdicionArrendatario()) {
        this.syncServiciosIdsDesdeCatalogo();
      }
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
    this.idArrendadorSub?.unsubscribe();
    this.contratosInmuebleSubs.forEach((sub) => sub.unsubscribe());
    this.contratosInmuebleSubs = [];
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
    if (patch.rfc) valores['rfc'] = patch.rfc;

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
    this.aplicarDatosConstanciaAlFormulario(mapearConstanciaAArrendatario(constancia));
    this.finalizarAutocargaCsf();
    this.cdr.detectChanges();
    this.scrollArribaTrasOcrExitoso();
    void this.swalToastOcrExito.fire();
  }

  private procesarConstanciaFiscalOcr(file: File): void {
    if (this.procesandoConstanciaOcr) return;
    this.procesandoConstanciaOcr = true;

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
          this.finalizarAutocargaCsf();
          this.mostrarAlertaOcrFallido(this.mensajeErrorOcrHttp(err));
        },
      });
  }

  private initForm(): void {
    this.documentosApiUltimaCarga = {};
    this.serviciosEdicionSnapshots = null;
    this.sociosEdicionSnapshots = null;
    this.documentosEdicionSnapshots = null;
    this.galeriaEdicionSnapshots = null;
    this.contratoEdicionSnapshotJson = null;
    this.arrendatarioForm = this.fb.group({
      arrendatario: ['', Validators.required],
      rfc: [
        '',
        [
          Validators.required,
          Validators.minLength(12),
          Validators.maxLength(13),
          Validators.pattern(/^[A-Za-z0-9]+$/),
        ],
      ],
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
      lat: [''],
      lng: [''],
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
      contratos: this.fb.array([this.crearContratoFormGroup()]),
    });
    this.localesLibresPorContrato = [[]];
    this.cargandoLocalesPorContrato = [false];
    this.localesLibresConsultadosPorContrato = [false];
  }

  private initTipoPersonaLogic(): void {
    const ctrl = this.arrendatarioForm.get('tipoPersona');
    if (!ctrl) return;
    this.aplicarValidadoresTipoPersona(ctrl.value);
    ctrl.valueChanges.subscribe((v) => this.aplicarValidadoresTipoPersona(v));
  }

  private crearContratoFormGroup(): FormGroup {
    return this.fb.group({
      /** Id del registro de contrato en API (solo edición; no se envía en `contratos`). */
      idContrato: [null as number | null],
      idInmueble: [null as number | null],
      /** Locales seleccionados (mismo nombre que el payload API). */
      idLocales: [[] as number[]],
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
    });
  }

  private inicializarContratosArrendatarioLogic(): void {
    this.contratosInmuebleSubs.forEach((sub) => sub.unsubscribe());
    this.contratosInmuebleSubs = [];
    this.contratosFormArray.controls.forEach((_, index) => {
      this.enlazarInmuebleLocalContrato(index);
    });
    this.actualizarEstadoInmuebleContratos();
  }

  private enlazarInmueblesArrendador(): void {
    const ctrl = this.arrendatarioForm.get('idArrendador');
    if (!ctrl) return;
    this.idArrendadorSub?.unsubscribe();
    this.idArrendadorSub = ctrl.valueChanges.subscribe((raw) => {
      this.onArrendadorContratoChanged(raw);
    });
  }

  private onArrendadorContratoChanged(raw: unknown): void {
    this.limpiarInmueblesContratosTrasCambioArrendador();
    const id =
      raw != null && String(raw).trim() !== '' ? Number(raw) : Number.NaN;
    if (Number.isFinite(id) && id > 0) {
      this.cargarInmueblesPorArrendador(Math.trunc(id));
    } else {
      this.listaInmuebles = [];
      this.inmueblesArrendadorConsultados = false;
      this.actualizarEstadoInmuebleContratos();
      this.cdr.markForCheck();
    }
  }

  private limpiarInmueblesContratosTrasCambioArrendador(): void {
    this.listaInmuebles = [];
    this.inmueblesArrendadorConsultados = false;
    this.contratosFormArray.controls.forEach((_, index) => {
      const grupo = this.contratosFormArray.at(index) as FormGroup;
      grupo.get('idInmueble')?.setValue(null, { emitEvent: false });
      this.limpiarIdLocalesContrato(index);
      this.localesLibresPorContrato[index] = [];
      this.cargandoLocalesPorContrato[index] = false;
      this.localesLibresConsultadosPorContrato[index] = false;
    });
    this.cerrarLocalesDropdown();
    this.actualizarEstadoInmuebleContratos();
  }

  private cargarInmueblesPorArrendador(idArrendador: number, onListo?: () => void): void {
    this.cargandoInmueblesArrendador = true;
    this.inmueblesArrendadorConsultados = false;
    this.actualizarEstadoInmuebleContratos();
    this.inmueblesService
      .obtenerInmueblesPorArrendador(idArrendador)
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          this.cargandoInmueblesArrendador = false;
          this.inmueblesArrendadorConsultados = true;
          this.actualizarEstadoInmuebleContratos();
          onListo?.();
          this.cdr.markForCheck();
        }),
      )
      .subscribe((res) => {
        this.asignarListaInmuebles(res);
        this.cdr.markForCheck();
      });
  }

  private actualizarEstadoInmuebleContratos(): void {
    const deshabilitado = this.inmuebleContratoDeshabilitado();
    this.contratosFormArray.controls.forEach((ctrl) => {
      const c = (ctrl as FormGroup).get('idInmueble');
      if (!c) return;
      if (deshabilitado) {
        c.disable({ emitEvent: false });
      } else {
        c.enable({ emitEvent: false });
      }
    });
  }

  arrendadorContratoSeleccionado(): boolean {
    const id = Number(this.arrendatarioForm.get('idArrendador')?.value);
    return Number.isFinite(id) && id > 0;
  }

  inmuebleContratoDeshabilitado(): boolean {
    if (!this.arrendadorContratoSeleccionado()) return true;
    if (this.cargandoInmueblesArrendador) return true;
    return this.listaInmuebles.length === 0;
  }

  placeholderInmuebleContrato(): string {
    if (!this.arrendadorContratoSeleccionado()) return 'Selecciona arrendador primero';
    if (this.cargandoInmueblesArrendador) return 'Cargando inmuebles…';
    if (this.inmueblesArrendadorConsultados && this.listaInmuebles.length === 0) {
      return 'Este arrendador no tiene inmuebles';
    }
    return 'Selecciona inmueble';
  }

  mostrarAvisoSinInmueblesArrendador(): boolean {
    return (
      this.arrendadorContratoSeleccionado() &&
      !this.cargandoInmueblesArrendador &&
      this.inmueblesArrendadorConsultados &&
      this.listaInmuebles.length === 0
    );
  }

  private enlazarInmuebleLocalContrato(indexContrato: number): void {
    const grupo = this.contratosFormArray.at(indexContrato) as FormGroup;
    const ctrlInmueble = grupo.get('idInmueble');
    if (!ctrlInmueble) return;

    this.contratosInmuebleSubs[indexContrato]?.unsubscribe();
    this.contratosInmuebleSubs[indexContrato] = ctrlInmueble.valueChanges.subscribe((raw) => {
      this.cerrarLocalesDropdown();
      this.limpiarIdLocalesContrato(indexContrato);
      this.localesLibresPorContrato[indexContrato] = [];
      this.localesLibresConsultadosPorContrato[indexContrato] = false;
      this.cdr.markForCheck();
      const id =
        raw != null && String(raw).trim() !== '' ? Number(raw) : Number.NaN;
      if (Number.isFinite(id) && id > 0) {
        this.cargarLocalesLibresContrato(indexContrato, Math.trunc(id));
      }
    });
  }

  private cargarLocalesLibresContrato(
    indexContrato: number,
    idInmueble: number,
    idLocalesPreservar?: number[] | null,
  ): void {
    this.cargandoLocalesPorContrato[indexContrato] = true;
    this.localesLibresConsultadosPorContrato[indexContrato] = false;
    this.inmueblesService
      .obtenerLocalesLibres(idInmueble)
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          this.cargandoLocalesPorContrato[indexContrato] = false;
          this.localesLibresConsultadosPorContrato[indexContrato] = true;
          if (this.esEdicionArrendatario()) {
            this.actualizarContratoEdicionSnapshotDesdeFormularioActual();
          }
          this.cdr.markForCheck();
        }),
      )
      .subscribe((res) => {
        this.localesLibresPorContrato[indexContrato] = this.mapearLocalesLibresDesdeApi(res);
        const preserve = (idLocalesPreservar ?? [])
          .map((id) => Math.trunc(Number(id)))
          .filter((id) => Number.isFinite(id) && id > 0);
        const opciones = this.localesLibresPorContrato[indexContrato] ?? [];
        const idsValidos = preserve.filter((id) => opciones.some((l) => l.id === id));
        if (idsValidos.length > 0) {
          this.idLocalesControl(indexContrato).setValue([...idsValidos], { emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  private limpiarIdLocalesContrato(indexContrato: number): void {
    (this.contratosFormArray.at(indexContrato) as FormGroup)
      .get('idLocales')
      ?.setValue([], { emitEvent: false });
  }

  private extraerFilasLocalesApi(resp: unknown): Record<string, unknown>[] {
    if (Array.isArray(resp)) {
      return resp.filter(
        (x): x is Record<string, unknown> =>
          x != null && typeof x === 'object' && !Array.isArray(x),
      );
    }
    if (resp != null && typeof resp === 'object') {
      const data = (resp as Record<string, unknown>)['data'];
      if (Array.isArray(data)) {
        return data.filter(
          (x): x is Record<string, unknown> =>
            x != null && typeof x === 'object' && !Array.isArray(x),
        );
      }
    }
    return [];
  }

  private mapearLocalesLibresDesdeApi(
    resp: unknown,
  ): { id: number; nombre: string; etiqueta: string }[] {
    return this.extraerFilasLocalesApi(resp)
      .map((row) => {
        const id = Number(row['id'] ?? row['idLocal']);
        if (!Number.isFinite(id) || id <= 0) return null;
        return {
          id: Math.trunc(id),
          nombre: this.nombreLocalLibre(row),
          etiqueta: this.etiquetaLocalLibre(row),
        };
      })
      .filter((x): x is { id: number; nombre: string; etiqueta: string } => x != null)
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
  }

  private nombreLocalLibre(row: Record<string, unknown>): string {
    const idRef = row['id'] ?? row['idLocal'];
    return (
      String(row['nombre'] ?? row['nombreLocal'] ?? '').trim() ||
      (idRef != null ? `Local ${idRef}` : 'Local')
    );
  }

  private etiquetaLocalLibre(row: Record<string, unknown>): string {
    const nombre = this.nombreLocalLibre(row);
    const partes = [`Nombre: ${nombre}`];
    const mensualidadRaw = row['mensualidad'];
    if (mensualidadRaw != null && String(mensualidadRaw).trim() !== '') {
      partes.push(`Mensualidad: ${this.formatearMensualidadLocal(mensualidadRaw)}`);
    }
    return partes.join(' - ');
  }

  /** MXN con centavos solo si el valor los trae (p. ej. $3,500.65 o $70,000). */
  private formatearMensualidadLocal(val: unknown): string {
    const n = Number(val);
    if (!Number.isFinite(n)) return '—';
    const hasCentavos = Math.abs(n - Math.trunc(n)) > 0.001;
    return n.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: hasCentavos ? 2 : 0,
      maximumFractionDigits: hasCentavos ? 2 : 0,
    });
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

  sanitizeRfcInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const sanitizedValue = inputElement.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 13);
    inputElement.value = sanitizedValue;
    this.arrendatarioForm.get('rfc')?.setValue(sanitizedValue, { emitEvent: false });
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
      id: [null as number | null],
      nombre: [''],
      rfc: [''],
      constanciaFiscalArchivo: [null],
      comprobanteDomicilioArchivo: [null],
      identificacionOficialArchivo: [null],
      constanciaFiscalUrl: [''],
      comprobanteDomicilioUrl: [''],
      identificacionOficialUrl: [''],
    });
  }

  private crearGaleriaImagenFormGroup(): FormGroup {
    return this.fb.group({
      idRegistro: [null as number | null],
      archivo: [null],
      nombre: [''],
      url: [''],
    });
  }

  private crearServicioFormGroup(): FormGroup {
    return this.fb.group({
      id: [null as number | null],
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

  get contratosFormArray(): FormArray {
    return this.arrendatarioForm.get('contratos') as FormArray;
  }

  idLocalesControl(index: number): FormControl<number[]> {
    return (this.contratosFormArray.at(index) as FormGroup).get('idLocales') as FormControl<number[]>;
  }

  inmuebleContratoSeleccionado(index: number): boolean {
    const idInm = Number(
      (this.contratosFormArray.at(index) as FormGroup).get('idInmueble')?.value,
    );
    return Number.isFinite(idInm) && idInm > 0;
  }

  idLocalesContrato(index: number): number[] {
    return this.normalizarIdLocalesValue(this.idLocalesControl(index).value);
  }

  localesDropdownAbierto(index: number): boolean {
    return this.localesDropdownContratoIndex === index;
  }

  localesContratoDeshabilitado(index: number): boolean {
    if (!this.arrendadorContratoSeleccionado()) return true;
    if (!this.inmuebleContratoSeleccionado(index)) return true;
    if (this.cargandoLocalesPorContrato[index]) return true;
    return (this.localesLibresPorContrato[index]?.length ?? 0) === 0;
  }

  placeholderLocalesContrato(index: number): string {
    if (!this.arrendadorContratoSeleccionado()) return 'Selecciona arrendador';
    if (!this.inmuebleContratoSeleccionado(index)) return 'Selecciona inmueble';
    if (this.cargandoLocalesPorContrato[index]) return 'Cargando locales…';
    if (
      this.localesLibresConsultadosPorContrato[index] &&
      (this.localesLibresPorContrato[index]?.length ?? 0) === 0
    ) {
      return 'Este inmueble no tiene locales disponibles';
    }
    return 'Selecciona local(es)';
  }

  toggleLocalesDropdown(index: number, event?: Event): void {
    event?.stopPropagation();
    if (this.localesContratoDeshabilitado(index)) return;
    this.localesDropdownContratoIndex =
      this.localesDropdownContratoIndex === index ? -1 : index;
  }

  cerrarLocalesDropdown(): void {
    this.localesDropdownContratoIndex = -1;
  }

  @HostListener('document:click')
  onDocumentClickCerrarLocalesDropdown(): void {
    this.cerrarLocalesDropdown();
  }

  localContratoEstaSeleccionado(index: number, idLocal: number): boolean {
    return this.idLocalesContrato(index).includes(idLocal);
  }

  toggleLocalContrato(index: number, idLocal: number, event?: Event): void {
    event?.stopPropagation();
    const actual = [...this.idLocalesContrato(index)];
    const pos = actual.indexOf(idLocal);
    if (pos >= 0) actual.splice(pos, 1);
    else actual.push(idLocal);
    actual.sort((a, b) => a - b);
    this.idLocalesControl(index).setValue(actual, { emitEvent: false });
    this.cdr.markForCheck();
  }

  quitarLocalContrato(index: number, idLocal: number, event: Event): void {
    event.stopPropagation();
    const actual = this.idLocalesContrato(index).filter((id) => id !== idLocal);
    this.idLocalesControl(index).setValue(actual, { emitEvent: false });
    this.cdr.markForCheck();
  }

  nombreLocalContrato(index: number, idLocal: number): string {
    const loc = (this.localesLibresPorContrato[index] ?? []).find((l) => l.id === idLocal);
    return loc?.nombre ?? `Local ${idLocal}`;
  }

  private normalizarIdLocalesValue(raw: unknown): number[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((x) => {
        if (x != null && typeof x === 'object') {
          const row = x as Record<string, unknown>;
          const idRef = row['id'] ?? row['idLocal'];
          return Math.trunc(Number(idRef));
        }
        return Math.trunc(Number(x));
      })
      .filter((n) => Number.isFinite(n) && n > 0);
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

  /** Ítems expandidos del acordeón de contratos (el primero inicia abierto). */
  contratoAccordionIndicesAbiertos: number[] = [0];
  servicioAccordionIndicesAbiertos: number[] = [0];
  socioAccordionIndicesAbiertos: number[] = [0];

  onContratoAccordionIndicesChange(raw: number | number[]): void {
    if (Array.isArray(raw)) {
      this.contratoAccordionIndicesAbiertos = raw;
      return;
    }
    this.contratoAccordionIndicesAbiertos = raw >= 0 ? [raw] : [];
  }

  onServicioAccordionIndicesChange(raw: number | number[]): void {
    if (Array.isArray(raw)) {
      this.servicioAccordionIndicesAbiertos = raw;
      return;
    }
    this.servicioAccordionIndicesAbiertos = raw >= 0 ? [raw] : [];
  }

  onSocioAccordionIndicesChange(raw: number | number[]): void {
    if (Array.isArray(raw)) {
      this.socioAccordionIndicesAbiertos = raw;
      return;
    }
    this.socioAccordionIndicesAbiertos = raw >= 0 ? [raw] : [];
  }

  tituloServicioAccordion(index: number): string {
    return `Servicio ${index + 1}`;
  }

  tituloSocioAccordion(index: number): string {
    const nombre = this.nombreSocioEnIndice(index);
    if (nombre) return `Socio ${index + 1} | ${nombre}`;
    return `Socio ${index + 1}`;
  }

  agregarContratoArrendatario(): void {
    this.contratosFormArray.push(this.crearContratoFormGroup());
    const nuevoIndex = this.contratosFormArray.length - 1;
    this.localesLibresPorContrato.push([]);
    this.cargandoLocalesPorContrato.push(false);
    this.localesLibresConsultadosPorContrato.push(false);
    this.enlazarInmuebleLocalContrato(nuevoIndex);
    this.actualizarEstadoInmuebleContratos();
    const abiertos = new Set(this.contratoAccordionIndicesAbiertos);
    abiertos.add(nuevoIndex);
    this.contratoAccordionIndicesAbiertos = [...abiertos].sort((a, b) => a - b);
    this.cdr.detectChanges();
    setTimeout(() => this.scrollAlContratoArrendatario(nuevoIndex), 300);
  }

  private scrollAlContratoArrendatario(index: number): void {
    const root = document.querySelector('.arrend-accordion-contratos');
    if (!root) return;
    const items = root.querySelectorAll('.dx-accordion-item');
    const target = items.item(index);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  eliminarContratoArrendatario(index: number): void {
    if (this.contratosFormArray.length < 2) return;
    this.contratosInmuebleSubs[index]?.unsubscribe();
    this.contratosFormArray.removeAt(index);
    this.contratosInmuebleSubs.splice(index, 1);
    this.localesLibresPorContrato.splice(index, 1);
    this.cargandoLocalesPorContrato.splice(index, 1);
    this.localesLibresConsultadosPorContrato.splice(index, 1);
    if (this.localesDropdownContratoIndex === index) {
      this.localesDropdownContratoIndex = -1;
    } else if (this.localesDropdownContratoIndex > index) {
      this.localesDropdownContratoIndex -= 1;
    }
    this.contratoAccordionIndicesAbiertos = this.contratoAccordionIndicesAbiertos
      .filter((i) => i !== index)
      .map((i) => (i > index ? i - 1 : i));
    if (this.contratoAccordionIndicesAbiertos.length === 0 && this.contratosFormArray.length > 0) {
      this.contratoAccordionIndicesAbiertos = [0];
    }
  }

  tituloAccordionCaption(data: unknown): string {
    if (typeof data === 'string') return data;
    if (data != null && typeof data === 'object' && 'title' in data) {
      return String((data as { title: unknown }).title ?? '');
    }
    return '';
  }

  eliminarContratoDesdeTituloAccordion(event: Event, data: unknown): void {
    event.preventDefault();
    event.stopPropagation();
    const titulo = this.tituloAccordionCaption(data);
    const idx = this.indiceContratoDesdeTituloAccordion(titulo);
    if (idx >= 0) this.eliminarContratoArrendatario(idx);
  }

  private indiceContratoDesdeTituloAccordion(titulo: string): number {
    const m = /^Contrato\s+(\d+)/i.exec(String(titulo ?? '').trim());
    if (!m) return -1;
    const idx = Number(m[1]) - 1;
    return idx >= 0 && idx < this.contratosFormArray.length ? idx : -1;
  }

  tituloContratoAccordion(index: number): string {
    const grupo = this.contratosFormArray.at(index) as FormGroup;
    const partes = [`Contrato ${index + 1}`];
    const idInm = Number(grupo.get('idInmueble')?.value);
    const inm = this.listaInmuebles.find((x) => x.id === idInm);
    if (inm?.etiqueta) partes.push(`Inmueble: ${inm.etiqueta}`);

    const idLocales = this.idLocalesContrato(index);
    const lista = this.localesLibresPorContrato[index] ?? [];
    const nombres = idLocales
      .map((id) => lista.find((l) => l.id === id)?.nombre ?? `Local ${id}`)
      .filter(Boolean);

    if (nombres.length === 1) {
      partes.push(`Local: ${nombres[0]}`);
    } else if (nombres.length > 1) {
      partes.push(`Locales: ${nombres.join(', ')}`);
    }

    return partes.join(' | ');
  }

  mostrarAvisoLocalesLibresVaciosContrato(index: number): boolean {
    const grupo = this.contratosFormArray.at(index) as FormGroup;
    const idInm = Number(grupo.get('idInmueble')?.value);
    if (!Number.isFinite(idInm) || idInm <= 0) return false;
    if (this.cargandoLocalesPorContrato[index]) return false;
    if (!this.localesLibresConsultadosPorContrato[index]) return false;
    return (this.localesLibresPorContrato[index] ?? []).length === 0;
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
    const nuevoIndex = this.sociosFormArray.length - 1;
    const abiertos = new Set(this.socioAccordionIndicesAbiertos);
    abiertos.add(nuevoIndex);
    this.socioAccordionIndicesAbiertos = [...abiertos].sort((a, b) => a - b);
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
    const urlKey =
      field === 'constanciaFiscalArchivo'
        ? 'constanciaFiscalUrl'
        : field === 'comprobanteDomicilioArchivo'
          ? 'comprobanteDomicilioUrl'
          : 'identificacionOficialUrl';
    group.patchValue({ [field]: file, [urlKey]: '' });
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
    const nuevoIndex = this.serviciosFormArray.length - 1;
    const abiertos = new Set(this.servicioAccordionIndicesAbiertos);
    abiertos.add(nuevoIndex);
    this.servicioAccordionIndicesAbiertos = [...abiertos].sort((a, b) => a - b);
  }

  etiquetaCatServicio(item: CatServicioItem): string {
    const nombre = item.nombre ?? item.servicio ?? item.descripcion;
    if (nombre != null && String(nombre).trim() !== '') return String(nombre).trim();
    return `Servicio ${item.id}`;
  }

  agregarPago(): void {
    this.pagosFormArray.push(this.crearPagoFormGroup());
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
        rfc: registro?.rfc ?? '',
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
        lat: '',
        lng: '',
      },
      { emitEvent: false },
    );
    if (localDemo?.idInmueble != null) {
      this.cargarInmueblesPorArrendador(1, () => {
        const contrato0 = this.contratosFormArray.at(0) as FormGroup;
        contrato0.patchValue(
          {
            idInmueble: localDemo.idInmueble,
          },
          { emitEvent: false },
        );
        this.cargarLocalesLibresContrato(
          0,
          localDemo.idInmueble,
          localDemo.idLocal != null ? [localDemo.idLocal] : null,
        );
      });
    } else {
      this.cargarInmueblesPorArrendador(1);
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
        rfc: '',
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
        lat: '',
        lng: '',
      },
      { emitEvent: false },
    );

    this.cargarInmueblesPorArrendador(1, () => {
      const contrato0 = this.contratosFormArray.at(0) as FormGroup;
      contrato0.patchValue(
        {
          idInmueble: 1,
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
      this.cargarLocalesLibresContrato(0, 1);
    });

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
    this.arrendatariosService
      .obtenerArrendatario(id)
      .pipe(
        finalize(() => {
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
        rfc: this.strApi(item['rfc']),
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

    const continuarDespuesContratos = (): void => {
      this.poblarRestoFormularioDesdeDetalleApi(item);
    };

    if (idArr != null && idArr > 0) {
      this.cargarInmueblesPorArrendador(idArr, () => {
        this.poblarContratosDesdeDetalleApi(item);
        continuarDespuesContratos();
      });
    } else {
      this.listaInmuebles = [];
      this.poblarContratosDesdeDetalleApi(item);
      this.actualizarEstadoInmuebleContratos();
      continuarDespuesContratos();
    }
  }

  private poblarRestoFormularioDesdeDetalleApi(item: Record<string, unknown>): void {
    const serviciosRaw = item['servicios'];
    this.serviciosFormArray.clear();
    if (Array.isArray(serviciosRaw) && serviciosRaw.length > 0) {
      for (const raw of serviciosRaw) {
        const s = raw as Record<string, unknown>;
        const g = this.crearServicioFormGroup();
        const idSrv =
          s['id'] != null && String(s['id']).trim() !== '' && Number.isFinite(Number(s['id']))
            ? Math.trunc(Number(s['id']))
            : null;
        const tipoObj = s['tipoServicio'];
        const idTipoDesdeAnidado =
          tipoObj != null && typeof tipoObj === 'object'
            ? Number((tipoObj as Record<string, unknown>)['id'])
            : Number.NaN;
        const idTipoDirecto = Number(s['idTipoServicio']);
        let idTipo = Number.NaN;
        if (Number.isFinite(idTipoDirecto) && idTipoDirecto > 0) {
          idTipo = Math.trunc(idTipoDirecto);
        } else if (Number.isFinite(idTipoDesdeAnidado) && idTipoDesdeAnidado > 0) {
          idTipo = Math.trunc(idTipoDesdeAnidado);
        }
        g.patchValue(
          {
            id: idSrv,
            idTipoServicio: Number.isFinite(idTipo) && idTipo > 0 ? idTipo : null,
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
        const idSoc =
          s['id'] != null && String(s['id']).trim() !== '' && Number.isFinite(Number(s['id']))
            ? Math.trunc(Number(s['id']))
            : null;
        g.patchValue(
          {
            id: idSoc,
            nombre: this.strApi(s['nombre']),
            rfc: this.strApi(s['rfc']),
            constanciaFiscalArchivo: null,
            comprobanteDomicilioArchivo: null,
            identificacionOficialArchivo: null,
            constanciaFiscalUrl: this.strApi(s['constanciaSituacionFiscal'] ?? s['constanciaFiscalArchivo']),
            comprobanteDomicilioUrl: this.strApi(s['comprobanteDomicilio'] ?? s['comprobanteDomicilioArchivo']),
            identificacionOficialUrl: this.strApi(s['identificacionOficial'] ?? s['identificacionOficialArchivo']),
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
    this.syncArrendatarioEdicionSnapshotsDesdeFormulario();
    this.cdr.markForCheck();
  }

  private aplicarArchivosEImagenesDesdeDetalle(item: Record<string, unknown>): void {
    const archivos = (Array.isArray(item['archivos']) ? item['archivos'] : []) as InmuebleArchivoApi[];
    const imagenes = (Array.isArray(item['imagenes']) ? item['imagenes'] : []) as InmuebleArchivoApi[];
    const { documentos, galeria } = separarArchivosInmueble(archivos, imagenes);
    this.documentosApiUltimaCarga = { ...documentos };
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
        const idG =
          im.id != null && String(im.id).trim() !== '' && Number.isFinite(Number(im.id))
            ? Math.trunc(Number(im.id))
            : null;
        gg.patchValue({ idRegistro: idG, archivo: null, nombre, url }, { emitEvent: false });
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

  private poblarContratosDesdeDetalleApi(item: Record<string, unknown>): void {
    const contratos = this.listarContratosOrdenadosDesdeItem(item);
    this.contratosInmuebleSubs.forEach((sub) => sub.unsubscribe());
    this.contratosInmuebleSubs = [];
    this.contratosFormArray.clear();
    this.localesLibresPorContrato = [];
    this.cargandoLocalesPorContrato = [];
    this.localesLibresConsultadosPorContrato = [];
    this.localesDropdownContratoIndex = -1;
    this.contratoAccordionIndicesAbiertos = [0];

    if (contratos.length === 0) {
      this.contratosFormArray.push(this.crearContratoFormGroup());
      this.localesLibresPorContrato.push([]);
      this.cargandoLocalesPorContrato.push(false);
      this.localesLibresConsultadosPorContrato.push(false);
      this.enlazarInmuebleLocalContrato(0);
      this.actualizarEstadoInmuebleContratos();
      return;
    }

    contratos.forEach((c, index) => {
      const g = this.crearContratoFormGroup();
      this.patchContratoGrupoDesdeApi(g, c);
      this.contratosFormArray.push(g);
      this.localesLibresPorContrato.push([]);
      this.cargandoLocalesPorContrato.push(false);
      this.localesLibresConsultadosPorContrato.push(false);
      this.enlazarInmuebleLocalContrato(index);
      const idIm = this.idInmuebleDesdeContrato(c);
      const idsLoc = this.idLocalesDesdeContrato(c);
      if (idIm != null) {
        this.cargarLocalesLibresContrato(
          index,
          idIm,
          idsLoc.length > 0 ? idsLoc : null,
        );
      }
    });
    this.actualizarEstadoInmuebleContratos();
  }

  private patchContratoGrupoDesdeApi(g: FormGroup, c: Record<string, unknown>): void {
    const idContr =
      c['id'] != null &&
      String(c['id']).trim() !== '' &&
      Number.isFinite(Number(c['id'])) &&
      Number(c['id']) > 0
        ? Math.trunc(Number(c['id']))
        : null;
    const idLoc = this.idLocalesDesdeContrato(c);
    g.patchValue(
      {
        idContrato: idContr,
        idInmueble: this.idInmuebleDesdeContrato(c),
        idLocales: idLoc,
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
  }

  /** Contratos del GET ordenados por antigüedad (`fhRegistro` / `id`). */
  private listarContratosOrdenadosDesdeItem(item: Record<string, unknown>): Record<string, unknown>[] {
    const contratos = item['contratos'];
    if (!Array.isArray(contratos) || contratos.length === 0) return [];
    const rows = contratos
      .map((x) => (x != null && typeof x === 'object' ? (x as Record<string, unknown>) : null))
      .filter((x): x is Record<string, unknown> => x != null);
    rows.sort((a, b) => {
      const ta = new Date(String(a['fhRegistro'] ?? '')).getTime();
      const tb = new Date(String(b['fhRegistro'] ?? '')).getTime();
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
      const ida = Number(a['id']);
      const idb = Number(b['id']);
      if (Number.isFinite(ida) && Number.isFinite(idb) && ida !== idb) return ida - idb;
      return 0;
    });
    return rows;
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

  private idLocalesDesdeContrato(c: Record<string, unknown>): number[] {
    const raw = c['idLocales'];
    if (Array.isArray(raw)) {
      return raw
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((n) => Math.trunc(n));
    }
    const idLoc = this.idLocalDesdeContrato(c);
    return idLoc != null ? [idLoc] : [];
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
    const items = this.extraerFilasLocalesApi(res)
      .map((row) => {
        const id = Number(row['id']);
        if (!Number.isFinite(id) || id <= 0) return null;
        const nombre = String(row['inmueble'] ?? '').trim() || 'Inmueble';
        const dir = String(row['direccionFiscal'] ?? '').trim();
        const etiqueta = dir ? `${nombre} — ${dir}` : nombre;
        return { id: Math.trunc(id), etiqueta };
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
    'contratos',
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
    rfc: 'RFC',
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
    idInmueble: 'Inmueble',
    idLocal: 'Local',
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
    this.contratosFormArray.controls.forEach((c) => (c as FormGroup).markAllAsTouched());
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

    this.recopilarFaltantesLocalContrato(faltantes);

    return faltantes;
  }

  /**
   * Validación por fila de contrato: inmueble elegido y al menos un local en `idLocales`.
   */
  private recopilarFaltantesLocalContrato(faltantes: string[]): void {
    this.contratosFormArray.controls.forEach((ctrl, index) => {
      const g = ctrl as FormGroup;
      const idInmRaw = g.get('idInmueble')?.value;
      const idInmSeleccionado =
        idInmRaw != null &&
        String(idInmRaw).trim() !== '' &&
        Number.isFinite(Number(idInmRaw)) &&
        Number(idInmRaw) > 0;
      const pref = `Contrato ${index + 1}`;

      if (!idInmSeleccionado) return;

      if (this.cargandoLocalesPorContrato[index]) {
        faltantes.push(`${pref}: espera a que termine la carga de locales`);
        return;
      }

      if ((this.localesLibresPorContrato[index] ?? []).length === 0) {
        faltantes.push(`${pref}: no hay locales disponibles para el inmueble seleccionado`);
        return;
      }

      const idsOk = this.normalizarIdLocalesValue(g.get('idLocales')?.value).length > 0;
      if (!idsOk) {
        faltantes.push(`${pref}: ${this.etiquetasCampos['idLocal'] ?? 'Local'}`);
      }
    });
  }

  private esEdicionArrendatario(): boolean {
    return this.idArrendatario != null && Number(this.idArrendatario) > 0;
  }

  private syncArrendatarioEdicionSnapshotsDesdeFormulario(): void {
    if (!this.esEdicionArrendatario()) {
      this.serviciosEdicionSnapshots = null;
      this.sociosEdicionSnapshots = null;
      this.documentosEdicionSnapshots = null;
      this.galeriaEdicionSnapshots = null;
      this.contratoEdicionSnapshotJson = null;
      return;
    }
    this.serviciosEdicionSnapshots = this.serviciosFormArray.controls.map((ctrl) => {
      const g = ctrl as FormGroup;
      const idVal = g.get('id')?.value;
      const idTipoRaw = g.get('idTipoServicio')?.value;
      return {
        id:
          idVal != null && String(idVal).trim() !== '' && Number.isFinite(Number(idVal))
            ? Math.trunc(Number(idVal))
            : null,
        idTipoServicio:
          idTipoRaw != null && idTipoRaw !== '' && Number.isFinite(Number(idTipoRaw))
            ? Math.trunc(Number(idTipoRaw))
            : null,
        numeroContrato: String(g.get('servicioNumeroContrato')?.value ?? '').trim(),
        fechaPago: String(g.get('servicioFechaPago')?.value ?? '').trim(),
        ultimoDiaPago: String(g.get('servicioUltimoDiaPago')?.value ?? '').trim(),
        comprobanteUrl: String(g.get('servicioComprobantePagoUrl')?.value ?? '').trim(),
      };
    });

    this.sociosEdicionSnapshots = this.sociosFormArray.controls.map((ctrl) =>
      this.snapshotSocioArrendatarioDesdeGrupo(ctrl as FormGroup),
    );

    const docSnaps: Partial<Record<string, DocSlotArrendatarioSnap>> = {};
    for (const doc of this.documentosMultipartArrendatario) {
      const slot = this.controlDocumentoASlot[doc.control];
      const api = slot ? this.documentosApiUltimaCarga[slot] : undefined;
      const idApi =
        api?.id != null && String(api.id).trim() !== '' && Number.isFinite(Number(api.id))
          ? Math.trunc(Number(api.id))
          : null;
      const { nombre, url } = this.vistaDocumentoDesdeControl(doc.control);
      docSnaps[doc.control] = {
        id: idApi,
        nombre: (String(nombre ?? '').trim() || doc.nombre).trim(),
        url: String(url ?? '').trim(),
      };
    }
    this.documentosEdicionSnapshots = docSnaps;

    this.galeriaEdicionSnapshots = this.galeriaImagenesFormArray.controls.map((ctrl) => {
      const g = ctrl as FormGroup;
      const idVal = g.get('idRegistro')?.value;
      return {
        id:
          idVal != null && String(idVal).trim() !== '' && Number.isFinite(Number(idVal))
            ? Math.trunc(Number(idVal))
            : null,
        nombre: String(g.get('nombre')?.value ?? '').trim(),
        url: String(g.get('url')?.value ?? '').trim(),
      };
    });

    this.actualizarContratoEdicionSnapshotDesdeFormularioActual();
  }

  /** Línea base del arreglo `contratos` (sin `id`, `idArrendatario`, `fhRegistro`, `estatus`) para comparar en actualización. */
  private actualizarContratoEdicionSnapshotDesdeFormularioActual(): void {
    if (!this.esEdicionArrendatario()) return;
    const contratos = this.construirContratosArrendatarioDesdeFormulario();
    this.contratoEdicionSnapshotJson =
      contratos.length === 0 ? null : this.serialContratosArrendatarioEstable(contratos);
  }

  private construirContratosArrendatarioDesdeFormulario(): Record<string, unknown>[] {
    return this.contratosFormArray.controls
      .map((ctrl) => {
        const v = (ctrl as FormGroup).getRawValue() as Record<string, unknown>;
        return this.construirContratoArrendatarioObjetoDesdeFormRaw(v);
      })
      .filter((c) => Object.keys(c).length > 0);
  }

  private vistaDocumentoDesdeControl(control: string): { nombre: string | null; url: string | null } {
    switch (control) {
      case 'documentoPlano':
        return { nombre: this.imagenPlanoNombre, url: this.imagenPlanoUrl };
      case 'documentoContratoRenta':
        return { nombre: this.contratoRentaNombre, url: this.contratoRentaUrl };
      case 'documentoConstanciaFiscal':
        return { nombre: this.constanciaFiscalNombre, url: this.constanciaFiscalUrl };
      case 'constanciaSituacionFiscalRepresentanteLegal':
        return { nombre: this.constanciaRepLegalNombre, url: this.constanciaRepLegalUrl };
      case 'documentoComprobanteDomicilio':
        return { nombre: this.comprobanteDomicilioNombre, url: this.comprobanteDomicilioUrl };
      case 'ineRepresentanteLegal':
        return { nombre: this.ineRepresentanteNombre, url: this.ineRepresentanteUrl };
      default:
        return { nombre: null, url: null };
    }
  }

  private snapshotSocioArrendatarioDesdeGrupo(g: FormGroup): SocioArrendatarioEdicionSnap {
    const idVal = g.get('id')?.value;
    return {
      id:
        idVal != null && String(idVal).trim() !== '' && Number.isFinite(Number(idVal))
          ? Math.trunc(Number(idVal))
          : null,
      nombre: String(g.get('nombre')?.value ?? '').trim(),
      rfc: String(g.get('rfc')?.value ?? '').trim(),
      uCsf: String(g.get('constanciaFiscalUrl')?.value ?? '').trim(),
      uCd: String(g.get('comprobanteDomicilioUrl')?.value ?? '').trim(),
      uIne: String(g.get('identificacionOficialUrl')?.value ?? '').trim(),
    };
  }

  private servicioArrendatarioModificadoVsSnapshot(g: FormGroup, filaIndex: number): boolean {
    if (this.serviciosEdicionSnapshots == null) return false;
    const cf = g.get('servicioComprobantePago')?.value;
    if (cf instanceof File) return true;
    const base =
      this.serviciosEdicionSnapshots[filaIndex] ??
      ({
        id: null,
        idTipoServicio: null,
        numeroContrato: '',
        fechaPago: '',
        ultimoDiaPago: '',
        comprobanteUrl: '',
      } satisfies ServicioArrendatarioEdicionSnap);
    const idVal = g.get('id')?.value;
    const idCur =
      idVal != null && String(idVal).trim() !== '' && Number.isFinite(Number(idVal))
        ? Math.trunc(Number(idVal))
        : null;
    const idTipoRaw = g.get('idTipoServicio')?.value;
    const idTipoCur =
      idTipoRaw != null && idTipoRaw !== '' && Number.isFinite(Number(idTipoRaw))
        ? Math.trunc(Number(idTipoRaw))
        : null;
    return (
      idCur !== base.id ||
      idTipoCur !== base.idTipoServicio ||
      String(g.get('servicioNumeroContrato')?.value ?? '').trim() !== base.numeroContrato ||
      String(g.get('servicioFechaPago')?.value ?? '').trim() !== base.fechaPago ||
      String(g.get('servicioUltimoDiaPago')?.value ?? '').trim() !== base.ultimoDiaPago ||
      String(g.get('servicioComprobantePagoUrl')?.value ?? '').trim() !== base.comprobanteUrl
    );
  }

  private socioArrendatarioModificadoVsSnapshot(g: FormGroup, filaIndex: number): boolean {
    if (this.sociosEdicionSnapshots == null) return false;
    const constancia = g.get('constanciaFiscalArchivo')?.value;
    const comprobante = g.get('comprobanteDomicilioArchivo')?.value;
    const identificacion = g.get('identificacionOficialArchivo')?.value;
    if (
      constancia instanceof File ||
      comprobante instanceof File ||
      identificacion instanceof File
    ) {
      return true;
    }
    const base =
      this.sociosEdicionSnapshots[filaIndex] ??
      ({
        id: null,
        nombre: '',
        rfc: '',
        uCsf: '',
        uCd: '',
        uIne: '',
      } satisfies SocioArrendatarioEdicionSnap);
    const cur = this.snapshotSocioArrendatarioDesdeGrupo(g);
    return (
      cur.nombre !== base.nombre ||
      cur.rfc !== base.rfc ||
      cur.uCsf !== base.uCsf ||
      cur.uCd !== base.uCd ||
      cur.uIne !== base.uIne
    );
  }

  private documentoArrendatarioSlotModificado(control: string): boolean {
    if (this.documentosEdicionSnapshots == null) return false;
    const file = this.arrendatarioForm.get(control)?.value;
    if (file instanceof File) return true;
    const snap = this.documentosEdicionSnapshots[control];
    if (!snap) return false;
    const { nombre, url } = this.vistaDocumentoDesdeControl(control);
    return (
      String(nombre ?? '').trim() !== snap.nombre || String(url ?? '').trim() !== snap.url
    );
  }

  private galeriaArrendatarioItemModificado(g: FormGroup, filaIndex: number): boolean {
    if (this.galeriaEdicionSnapshots == null) return false;
    const f = g.get('archivo')?.value;
    if (f instanceof File) return true;
    const base =
      this.galeriaEdicionSnapshots[filaIndex] ??
      ({ id: null, nombre: '', url: '' } satisfies GaleriaArrendatarioSnap);
    const nombre = String(g.get('nombre')?.value ?? '').trim();
    const url = String(g.get('url')?.value ?? '').trim();
    return nombre !== base.nombre || url !== base.url;
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
      rfc: String(v['rfc'] ?? '').trim(),
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
   * Swagger `socios[]`: `socios[i].nombre`, `rfc`, `constanciaFiscalArchivo`,
   * `comprobanteDomicilioArchivo`, `identificacionOficialArchivo` (multipart).
   * En edición: solo filas modificadas; con `id` de servidor cuando aplica.
   */
  private adjuntarSociosMultipart(fd: FormData, soloModificadosEnEdicion: boolean): void {
    if (soloModificadosEnEdicion && this.sociosEdicionSnapshots == null) return;

    let i = 0;
    this.sociosFormArray.controls.forEach((ctrl, index) => {
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

      if (soloModificadosEnEdicion) {
        if (!this.socioArrendatarioModificadoVsSnapshot(g, index)) return;
        const idSrv = g.get('id')?.value;
        if (
          idSrv != null &&
          String(idSrv).trim() !== '' &&
          Number.isFinite(Number(idSrv))
        ) {
          fd.append(`socios[${i}].id`, String(Math.trunc(Number(idSrv))));
        }
      } else if (!tieneFila) {
        return;
      }

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
    soloModificadosEnEdicion: boolean,
  ): void {
    let ai = 0;
    let ii = 0;

    const pushArchivo = (file: unknown, nombre: string, idReg: number | null): void => {
      if (idReg != null) fd.append(`archivos[${ai}].id`, String(idReg));
      fd.append(`archivos[${ai}].nombre`, nombre);
      if (file instanceof File) {
        fd.append(`archivos[${ai}].archivo`, file, file.name);
      }
      ai += 1;
    };

    const pushImagen = (file: unknown, nombre: string, idReg: number | null): void => {
      if (idReg != null) fd.append(`imagenes[${ii}].id`, String(idReg));
      fd.append(`imagenes[${ii}].nombre`, nombre || (file instanceof File ? file.name : ''));
      if (file instanceof File) {
        fd.append(`imagenes[${ii}].archivo`, file, file.name);
      }
      ii += 1;
    };

    if (!soloModificadosEnEdicion) {
      for (const doc of this.documentosMultipartArrendatario) {
        const file = v[doc.control];
        const idReg = null;
        if (doc.coleccion === 'archivos') {
          if (file instanceof File) pushArchivo(file, doc.nombre, idReg);
        } else if (file instanceof File) {
          pushImagen(file, doc.nombre, idReg);
        }
      }
      this.galeriaImagenesFormArray.controls.forEach((galCtrl, index) => {
        const g = galCtrl as FormGroup;
        const f = g.get('archivo')?.value;
        const nom = String(g.get('nombre')?.value ?? '').trim();
        if (f instanceof File) {
          pushImagen(f, nom || f.name || `Imagen ${index + 1}`, null);
        }
      });
      return;
    }

    if (this.documentosEdicionSnapshots == null && this.galeriaEdicionSnapshots == null) {
      return;
    }

    for (const doc of this.documentosMultipartArrendatario) {
      if (!this.documentoArrendatarioSlotModificado(doc.control)) continue;
      const file = v[doc.control];
      const snap = this.documentosEdicionSnapshots?.[doc.control];
      const idReg = snap?.id != null ? snap.id : null;
      const nombreEnviar =
        String(this.vistaDocumentoDesdeControl(doc.control).nombre ?? '').trim() || doc.nombre;
      if (doc.coleccion === 'archivos') {
        pushArchivo(file, nombreEnviar, idReg);
      } else {
        pushImagen(file, nombreEnviar, idReg);
      }
    }

    this.galeriaImagenesFormArray.controls.forEach((galCtrl, index) => {
      const g = galCtrl as FormGroup;
      if (!this.galeriaArrendatarioItemModificado(g, index)) return;
      const f = g.get('archivo')?.value;
      const nom = String(g.get('nombre')?.value ?? '').trim();
      const idRaw = g.get('idRegistro')?.value;
      const idG =
        idRaw != null && String(idRaw).trim() !== '' && Number.isFinite(Number(idRaw))
          ? Math.trunc(Number(idRaw))
          : null;
      if (f instanceof File) {
        pushImagen(f, nom || f.name || `Imagen ${index + 1}`, idG);
      } else if (idG != null) {
        pushImagen(null, nom || `Imagen ${index + 1}`, idG);
      }
    });
  }

  private appendServiciosArrendatarioMultipart(
    fd: FormData,
    soloModificadosEnEdicion: boolean,
  ): void {
    if (soloModificadosEnEdicion && this.serviciosEdicionSnapshots == null) {
      return;
    }
    let si = 0;
    this.serviciosFormArray.controls.forEach((ctrl, index) => {
      const g = ctrl as FormGroup;
      const idTipoRaw = g.get('idTipoServicio')?.value;
      const idTipo =
        idTipoRaw != null && idTipoRaw !== '' ? Number(idTipoRaw) : Number.NaN;
      if (!Number.isFinite(idTipo)) return;

      if (soloModificadosEnEdicion) {
        if (!this.servicioArrendatarioModificadoVsSnapshot(g, index)) return;
        const idSrv = g.get('id')?.value;
        if (
          idSrv != null &&
          String(idSrv).trim() !== '' &&
          Number.isFinite(Number(idSrv))
        ) {
          this.appendEntero(fd, `servicios[${si}].id`, Number(idSrv));
        }
      }

      this.appendEntero(fd, `servicios[${si}].idTipoServicio`, idTipo);
      const nc = g.get('servicioNumeroContrato')?.value;
      if (nc != null && String(nc).trim() !== '') {
        fd.append(`servicios[${si}].numeroContrato`, String(nc).trim());
      }
      const fp = String(g.get('servicioFechaPago')?.value ?? '').trim();
      if (fp) fd.append(`servicios[${si}].fechaPago`, fp);
      const ulp = String(g.get('servicioUltimoDiaPago')?.value ?? '').trim();
      if (ulp) fd.append(`servicios[${si}].ultimoDiaPago`, ulp);
      const comp = g.get('servicioComprobantePago')?.value;
      if (comp instanceof File) {
        fd.append(`servicios[${si}].archivo`, comp, comp.name);
      }
      si += 1;
    });
  }

  /** Objeto enviado en `contratos[]` (sin `id`, `idArrendatario`, `fhRegistro`, `estatus`; incluye `idLocales`). */
  private construirContratoArrendatarioObjetoDesdeFormRaw(v: Record<string, unknown>): Record<string, unknown> {
    const contrato: Record<string, unknown> = {};
    const idInmRaw = v['idInmueble'];
    const idInm =
      idInmRaw != null && String(idInmRaw).trim() !== '' ? Number(idInmRaw) : Number.NaN;
    if (Number.isFinite(idInm)) {
      contrato['idInmueble'] = Math.trunc(idInm);
      contrato['idLocales'] = this.normalizarIdLocalesValue(v['idLocales']);
    }
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
    return contrato;
  }

  private serialContratosArrendatarioEstable(contratos: Record<string, unknown>[]): string {
    const normalized = contratos.map((c) => JSON.parse(this.serialContratoArrendatarioEstable(c)));
    return JSON.stringify(normalized);
  }

  private serialContratoArrendatarioEstable(contrato: Record<string, unknown>): string {
    const keys = Object.keys(contrato).sort();
    const sorted: Record<string, unknown> = {};
    for (const k of keys) sorted[k] = contrato[k];
    return JSON.stringify(sorted);
  }

  private construirFormDataArrendatario(esActualizacion = false): FormData {
    const fd = new FormData();
    const v = this.arrendatarioForm.getRawValue() as Record<string, unknown>;

    fd.append('arrendatario', this.construirJsonArrendatarioSwagger(v));

    const contratosBase = this.construirContratosArrendatarioDesdeFormulario();
    let debeEnviarContrato = contratosBase.length > 0;

    if (
      esActualizacion &&
      this.esEdicionArrendatario() &&
      this.contratoEdicionSnapshotJson != null &&
      debeEnviarContrato
    ) {
      if (this.serialContratosArrendatarioEstable(contratosBase) === this.contratoEdicionSnapshotJson) {
        debeEnviarContrato = false;
      }
    }

    if (debeEnviarContrato) {
      fd.append('contratos', JSON.stringify(contratosBase));
    }

    const soloArraysModificados = esActualizacion && this.esEdicionArrendatario();
    this.appendServiciosArrendatarioMultipart(fd, soloArraysModificados);
    this.adjuntarDocumentosPermitidosArrendatario(fd, v, soloArraysModificados);
    this.adjuntarSociosMultipart(fd, soloArraysModificados);

    return fd;
  }

  /** Muestra el mismo éxito que en el resto del sistema; luego navega. */
  private mostrarExitoArrendatarioYRedirigir(esActualizacion: boolean): void {
    this.loadingSubmit = false;
    const text = esActualizacion
      ? 'Los datos del arrendatario se actualizaron correctamente.'
      : 'Se registró el arrendatario de manera exitosa.';
    void Swal.fire({
      color: '#ffffff',
      background: '#141a21',
      title: '¡Operación Exitosa!',
      text,
      icon: 'success',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Confirmar',
    }).then(() => {
      void this.router.navigateByUrl('/arrendatarios');
    });
  }

  private abrirSwalCargandoArrendatario(esActualizacion: boolean): void {
    void Swal.fire({
      title: 'Cargando...',
      text: esActualizacion
        ? 'Actualizando arrendatario, por favor espera.'
        : 'Guardando arrendatario, por favor espera.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      background: '#141a21',
      color: '#ffffff',
      didOpen: () => {
        Swal.showLoading();
      },
    });
  }

  private ejecutarGuardadoArrendatario(): void {
    this.loadingSubmit = true;
    const esActualizacion =
      this.idArrendatario != null && Number.isFinite(Number(this.idArrendatario));
    const fd = this.construirFormDataArrendatario(esActualizacion);
    this.logMultipartArrendatario(fd);
    this.abrirSwalCargandoArrendatario(esActualizacion);

    const req =
      this.idArrendatario != null && Number.isFinite(Number(this.idArrendatario))
        ? this.arrendatariosService.actualizarArrendatario(Number(this.idArrendatario), fd)
        : this.arrendatariosService.crearArrendatario(fd);

    req.subscribe({
      next: () => {
        window.setTimeout(() => {
          Swal.close();
          this.mostrarExitoArrendatarioYRedirigir(esActualizacion);
        }, 1000);
      },
      error: (err: unknown) => {
        Swal.close();
        this.loadingSubmit = false;
        const e = err as { error?: { message?: string }; message?: string };
        const text =
          e?.error?.message ??
          e?.message ??
          'No se pudo guardar el arrendatario. Verifique la información e intente de nuevo.';
        void Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          title: '¡Ops!',
          text: String(text),
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
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
