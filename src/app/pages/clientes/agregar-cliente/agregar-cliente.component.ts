import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { AuthenticationService } from 'src/app/services/auth.service';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { PdfOcrService } from 'src/app/services/moduleService/pdf-ocr.service';
import { UsuariosService } from 'src/app/services/moduleService/usuario.service';
import {
  extraerConstanciaDeRespuestaOcr,
  mapearConstanciaACliente,
} from 'src/app/shared/constancia-fiscal-ocr.mapper';
import { DocumentoPreviewComponent } from 'src/app/shared/documento-preview/documento-preview.component';
import {
  extraerClienteDetalleApi,
  nombreDeArchivoApi,
  urlOCadenaDeArchivoApi,
} from '../clientes-list.mapper';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-agregar-cliente',
  templateUrl: './agregar-cliente.component.html',
  styleUrl: './agregar-cliente.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarClienteComponent implements OnInit {
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

  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public clienteForm: FormGroup;
  public idCliente?: number;
  public title = 'Agregar Arrendador';
  public listaClientes: any[] = [];
  selectedFileName: string = '';
  previewUrl: string | ArrayBuffer | null = null;
  public showRol: any;
  ineFileName: string | null = null;
  inePreviewUrl: string | ArrayBuffer | null = null;
  ineDragging = false;
  resaltarAutocargaContrato = false;
  resaltarAutocargaDocs = false;
  autocargaCsfPendiente = false;
  private procesandoConstanciaOcr = false;
  private promptAutocargaMostrado = false;

  @ViewChild('autocargaCsfCardCliente') autocargaCsfCardCliente?: ElementRef<HTMLElement>;
  @ViewChild('topFormularioCliente') topFormularioCliente?: ElementRef<HTMLElement>;
  @ViewChild('inicioFormularioCliente') inicioFormularioCliente?: ElementRef<HTMLElement>;
  @ViewChild('docsSectionCliente') docsSectionCliente?: ElementRef<HTMLElement>;
  @ViewChild('docPreview') docPreview?: DocumentoPreviewComponent;

  constructor(
    private fb: FormBuilder,
    private clieService: ClientesService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
    private usuaService: UsuariosService,
    private users: AuthenticationService,
    private pdfOcrService: PdfOcrService,
    private cdr: ChangeDetectorRef,
  ) {
    const user = this.users.getUser();
  }

  ngOnInit(): void {
    this.initForm();

    const raw =
      this.activatedRouted.snapshot.paramMap.get('idCliente') ??
      this.activatedRouted.snapshot.paramMap.get('id');
    const idRoute =
      raw != null && String(raw).trim() !== '' ? Number(raw) : Number.NaN;

    if (Number.isFinite(idRoute) && idRoute > 0) {
      this.idCliente = Math.trunc(idRoute);
      this.title = 'Editar Arrendador';
      this.submitButton = 'Actualizar';
      this.cargarClienteParaEdicionDesdeApi(this.idCliente);
      return;
    }

    const data = history.state?.cliente;
    if (data && data.id) {
      this.idCliente = Number(data.id);
      this.title = 'Editar Arrendador';
      this.submitButton = 'Actualizar';
      this.cargarClienteParaEdicionDesdeApi(Number(this.idCliente));
      return;
    }

    this.title = 'Agregar Arrendador';
    this.submitButton = 'Guardar';
    this.mostrarPromptAutocargaContrato();
  }

  private strApi(v: unknown): string {
    if (v == null) return '';
    return String(v).trim();
  }

  private cargarClienteParaEdicionDesdeApi(id: number): void {
    this.loading = true;
    this.clieService
      .obtenerCliente(id)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (resp) => {
          const d = extraerClienteDetalleApi(resp);
          if (!d || Object.keys(d).length === 0) {
            void Swal.fire({
              title: 'Sin datos',
              text: 'No se encontró información del cliente.',
              icon: 'warning',
              confirmButtonColor: '#3085d6',
              background: '#141a21',
              color: '#ffffff',
            });
            return;
          }
          this.poblarFormularioDesdeDetalleApi(d);
          this.onTipoPersonaChange(null);
        },
        error: (err: unknown) => {
          const e = err as { error?: { message?: string }; message?: string };
          const text =
            e?.error?.message ??
            e?.message ??
            'No se pudo cargar el cliente. Intenta de nuevo.';
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

  private poblarFormularioDesdeDetalleApi(d: Record<string, unknown>): void {
    this.clienteForm.patchValue(
      {
        idPadre: d['idPadre'] != null ? Number(d['idPadre']) : null,
        rfc: this.strApi(d['rfc']),
        tipoPersona:
          d['tipoPersona'] != null && String(d['tipoPersona']).trim() !== ''
            ? Number(d['tipoPersona'])
            : null,
        estatus:
          d['estatus'] != null && String(d['estatus']).trim() !== ''
            ? Number(d['estatus'])
            : 1,
        logotipo: urlOCadenaDeArchivoApi(d['logotipo']) || null,
        nombre: this.strApi(d['nombre']),
        apellidoPaterno:
          d['apellidoPaterno'] != null && String(d['apellidoPaterno']).trim() !== ''
            ? String(d['apellidoPaterno'])
            : null,
        apellidoMaterno:
          d['apellidoMaterno'] != null && String(d['apellidoMaterno']).trim() !== ''
            ? String(d['apellidoMaterno'])
            : null,
        telefono: this.strApi(d['telefono']),
        correo: this.strApi(d['correo']),
        estado: this.strApi(d['estado']),
        municipio: this.strApi(d['municipio']),
        colonia: this.strApi(d['colonia']),
        calle: this.strApi(d['calle']),
        entreCalles: this.strApi(d['entreCalles']),
        numeroExterior: this.strApi(d['numeroExterior']),
        numeroInterior: this.strApi(d['numeroInterior']),
        cp: this.strApi(d['cp']),
        nombreEncargado: this.strApi(d['nombreEncargado']),
        telefonoEncargado: this.strApi(d['telefonoEncargado']),
        correoEncargado: this.strApi(d['correoEncargado']),
        sitioWeb: this.strApi(d['sitioWeb']),
        constanciaSituacionFiscal: urlOCadenaDeArchivoApi(d['constanciaSituacionFiscal']) || null,
        comprobanteDomicilio: urlOCadenaDeArchivoApi(d['comprobanteDomicilio']) || null,
        licenciaFuncionamiento: urlOCadenaDeArchivoApi(d['licenciaFuncionamiento']) || null,
        constanciaProteccionCivil: urlOCadenaDeArchivoApi(d['constanciaProteccionCivil']) || null,
        usoSuelo: urlOCadenaDeArchivoApi(d['usoSuelo']) || null,
        planoCatastral: urlOCadenaDeArchivoApi(d['planoCatastral']) || null,
        actaConstitutiva: urlOCadenaDeArchivoApi(d['actaConstitutiva']) || null,
        poderRepresentanteLegal: urlOCadenaDeArchivoApi(d['poderRepresentanteLegal']) || null,
        ineRepresentanteLegal: urlOCadenaDeArchivoApi(d['ineRepresentanteLegal']) || null,
      },
      { emitEvent: false },
    );

    const logoUrl = urlOCadenaDeArchivoApi(d['logotipo']);
    this.logoPreviewUrl = logoUrl && this.isImageUrl(logoUrl) ? logoUrl : null;

    this.csfFileName = nombreDeArchivoApi(d['constanciaSituacionFiscal'], 'Constancia');
    this.compDomFileName = nombreDeArchivoApi(d['comprobanteDomicilio'], 'Comprobante');
    this.actaFileName = nombreDeArchivoApi(d['actaConstitutiva'], 'Acta');
    this.poderFileName = nombreDeArchivoApi(d['poderRepresentanteLegal'], 'Poder');
    this.ineFileName = nombreDeArchivoApi(d['ineRepresentanteLegal'], 'INE');
    this.licenciaFileName = nombreDeArchivoApi(d['licenciaFuncionamiento'], 'Licencia');
    this.proteccionCivilFileName = nombreDeArchivoApi(d['constanciaProteccionCivil'], 'Protección civil');
    this.usoSueloFileName = nombreDeArchivoApi(d['usoSuelo'], 'Uso de suelo');
    this.planoCatastralFileName = nombreDeArchivoApi(d['planoCatastral'], 'Plano');

    this.originalDocs = {
      logotipo: logoUrl,
      constanciaSituacionFiscal: urlOCadenaDeArchivoApi(d['constanciaSituacionFiscal']),
      comprobanteDomicilio: urlOCadenaDeArchivoApi(d['comprobanteDomicilio']),
      licenciaFuncionamiento: urlOCadenaDeArchivoApi(d['licenciaFuncionamiento']),
      constanciaProteccionCivil: urlOCadenaDeArchivoApi(d['constanciaProteccionCivil']),
      usoSuelo: urlOCadenaDeArchivoApi(d['usoSuelo']),
      planoCatastral: urlOCadenaDeArchivoApi(d['planoCatastral']),
      actaConstitutiva: urlOCadenaDeArchivoApi(d['actaConstitutiva']),
      poderRepresentanteLegal: urlOCadenaDeArchivoApi(d['poderRepresentanteLegal']),
      ineRepresentanteLegal: urlOCadenaDeArchivoApi(d['ineRepresentanteLegal']),
    };

    this.sociosFormArray.clear();
    const sociosRaw = d['socios'];
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
            constanciaFiscalUrl: urlOCadenaDeArchivoApi(s['constanciaFiscalArchivo']),
            constanciaFiscalNombre: nombreDeArchivoApi(s['constanciaFiscalArchivo'], 'Constancia fiscal'),
            comprobanteDomicilioUrl: urlOCadenaDeArchivoApi(s['comprobanteDomicilioArchivo']),
            comprobanteDomicilioNombre: nombreDeArchivoApi(s['comprobanteDomicilioArchivo'], 'Comprobante'),
            identificacionOficialUrl: urlOCadenaDeArchivoApi(s['identificacionOficialArchivo']),
            identificacionOficialNombre: nombreDeArchivoApi(s['identificacionOficialArchivo'], 'Identificación'),
          },
          { emitEvent: false },
        );
        this.sociosFormArray.push(g);
      }
    } else {
      this.sociosFormArray.push(this.crearSocioFormGroup());
    }

    this.cdr.markForCheck();
  }

  verArchivoRemoto(url: string | null | undefined, titulo: string): void {
    if (!url?.trim()) return;
    const subtitulo = String(this.clienteForm.get('nombre')?.value ?? '').trim();
    this.docPreview?.abrir(url, titulo, subtitulo);
  }

  /** Documentos remotos del GET: mismo criterio que inmuebles/arrendatarios (id + URL). */
  layoutArchivoRemoto(url: string | null | undefined): boolean {
    return this.idCliente != null && !!String(url ?? '').trim();
  }

  setSociosMock() {
    const sociosArray = this.clienteForm.get('socios') as FormArray;
    sociosArray.clear();

    const sociosMock = [
      {
        nombre: 'Carlos Ramírez',
        rfc: 'CARL900101ABC',
        constanciaFiscalUrl: 'https://example.com/csf1.pdf',
        constanciaFiscalNombre: 'csf1.pdf',
        comprobanteDomicilioUrl: 'https://example.com/domicilio1.pdf',
        comprobanteDomicilioNombre: 'domicilio1.pdf',
        identificacionOficialUrl: 'https://example.com/ine1.pdf',
        identificacionOficialNombre: 'ine1.pdf',
      },
    ];

    sociosMock.forEach((socio) => {
      sociosArray.push(
        this.fb.group({
          nombre: [socio.nombre],
          rfc: [socio.rfc],
          constanciaFiscalArchivo: [null],
          comprobanteDomicilioArchivo: [null],
          identificacionOficialArchivo: [null],
          constanciaFiscalUrl: [socio.constanciaFiscalUrl],
          constanciaFiscalNombre: [socio.constanciaFiscalNombre],
          comprobanteDomicilioUrl: [socio.comprobanteDomicilioUrl],
          comprobanteDomicilioNombre: [socio.comprobanteDomicilioNombre],
          identificacionOficialUrl: [socio.identificacionOficialUrl],
          identificacionOficialNombre: [socio.identificacionOficialNombre],
        }),
      );
    });
  }

  obtenerClientes() {
    this.clieService.obtenerClientes().subscribe((response) => {
      this.listaClientes = (response.data || []).map((c: any) => ({
        ...c,
        id: Number(c.id),
      }));
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFileName = file.name;
      this.clienteForm.patchValue({ logotipo: file });
      this.clienteForm.get('logotipo')?.markAsTouched();
      this.clienteForm.get('logotipo')?.updateValueAndValidity();

      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }

  /** True cuando ya eligieron Física (1) o Moral (2); hasta entonces no se muestran nombre/apellidos/razón social. */
  tipoPersonaSeleccionada(): boolean {
    const raw = this.clienteForm?.get('tipoPersona')?.value;
    const n = Number(raw);
    return n === 1 || n === 2;
  }

  /** Persona moral (2): representante legal, acta/INE del representante y socios. */
  esPersonaMoral(): boolean {
    return Number(this.clienteForm?.get('tipoPersona')?.value) === 2;
  }

  onTipoPersonaChange(_event: any) {
    const raw = this.clienteForm.get('tipoPersona')!.value;
    const value =
      raw === null || raw === undefined || raw === ''
        ? null
        : Number(raw);

    const nombreCtrl = this.clienteForm.get('nombre');
    const apPat = this.clienteForm.get('apellidoPaterno');
    const apMat = this.clienteForm.get('apellidoMaterno');

    if (value !== 1 && value !== 2) {
      nombreCtrl?.clearValidators();
      apPat?.clearValidators();
      apMat?.clearValidators();
      nombreCtrl?.setValue('', { emitEvent: false });
      apPat?.setValue(null, { emitEvent: false });
      apMat?.setValue(null, { emitEvent: false });
    } else {
      nombreCtrl?.setValidators([Validators.required]);
      if (value === 1) {
        apPat?.setValidators([Validators.required]);
        apMat?.setValidators([Validators.required]);
      } else {
        apPat?.clearValidators();
        apMat?.clearValidators();
        this.clienteForm.patchValue(
          { apellidoPaterno: null, apellidoMaterno: null },
          { emitEvent: false },
        );
      }
    }

    nombreCtrl?.updateValueAndValidity({ emitEvent: false });
    apPat?.updateValueAndValidity({ emitEvent: false });
    apMat?.updateValueAndValidity({ emitEvent: false });

    this.aplicarSeccionMoral(value === 2);
  }

  /** Representante legal, acta/INE y socios solo aplican a persona moral. */
  private aplicarSeccionMoral(activar: boolean): void {
    const ne = this.clienteForm.get('nombreEncargado');
    const te = this.clienteForm.get('telefonoEncargado');
    const ce = this.clienteForm.get('correoEncargado');
    const ac = this.clienteForm.get('actaConstitutiva');
    const poder = this.clienteForm.get('poderRepresentanteLegal');
    const ine = this.clienteForm.get('ineRepresentanteLegal');

    if (activar) {
      ne?.setValidators([Validators.required]);
      te?.setValidators([Validators.required]);
      ce?.setValidators([Validators.required, Validators.email]);
      ac?.setValidators([Validators.required]);
      poder?.setValidators([Validators.required]);
      ine?.setValidators([Validators.required]);
      this.sociosFormArray.controls.forEach((ctrl) =>
        this.setSocioNombreRequerido(ctrl as FormGroup, true),
      );
    } else {
      ne?.clearValidators();
      te?.clearValidators();
      ce?.clearValidators();
      ac?.clearValidators();
      poder?.clearValidators();
      ine?.clearValidators();
      ne?.setValue('', { emitEvent: false });
      te?.setValue('', { emitEvent: false });
      ce?.setValue('', { emitEvent: false });
      ac?.setValue(null, { emitEvent: false });
      poder?.setValue(null, { emitEvent: false });
      ine?.setValue(null, { emitEvent: false });
      this.actaFileName = null;
      this.poderFileName = null;
      this.ineFileName = null;
      while (this.sociosFormArray.length > 1) {
        this.sociosFormArray.removeAt(this.sociosFormArray.length - 1);
      }
      const g0 = this.sociosFormArray.at(0) as FormGroup;
      g0?.reset(
        {
          nombre: '',
          rfc: null,
          constanciaFiscalArchivo: null,
          comprobanteDomicilioArchivo: null,
          identificacionOficialArchivo: null,
          constanciaFiscalUrl: '',
          constanciaFiscalNombre: '',
          comprobanteDomicilioUrl: '',
          comprobanteDomicilioNombre: '',
          identificacionOficialUrl: '',
          identificacionOficialNombre: '',
        },
        { emitEvent: false },
      );
      this.sociosFormArray.controls.forEach((ctrl) =>
        this.setSocioNombreRequerido(ctrl as FormGroup, false),
      );
    }

    [ne, te, ce, ac, poder, ine].forEach((c) =>
      c?.updateValueAndValidity({ emitEvent: false }),
    );
  }

  private setSocioNombreRequerido(group: FormGroup | null, required: boolean): void {
    const n = group?.get('nombre');
    if (!n) return;
    if (required) n.setValidators([Validators.required]);
    else n.clearValidators();
    n.updateValueAndValidity({ emitEvent: false });
  }

  sanitizeInput(event: any): void {
    const inputElement = event.target as HTMLInputElement;
    const sanitizedValue = inputElement.value.replace(/[^A-Za-z0-9]/g, '');
    inputElement.value = sanitizedValue.slice(0, 13);
    this.clienteForm
      .get('rfc')
      ?.setValue(inputElement.value, { emitEvent: false });
  }

  allowOnlyNumbers(event: KeyboardEvent): void {
    const charCode = event.keyCode ? event.keyCode : event.which;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
    }
  }

  private readonly DEFAULT_AVATAR_URL =
    'https://wallpapercat.com/w/full/9/5/a/945731-3840x2160-desktop-4k-matte-black-wallpaper-image.jpg';

  initForm() {
    this.clienteForm = this.fb.group({
      idPadre: [null as number | null],
      rfc: ['', Validators.required],
      tipoPersona: [null, Validators.required],
      estatus: [1],
      logotipo: [null],
      constanciaSituacionFiscal: [null, Validators.required],
      comprobanteDomicilio: [null, Validators.required],
      licenciaFuncionamiento: [null],
      constanciaProteccionCivil: [null],
      usoSuelo: [null],
      planoCatastral: [null],
      actaConstitutiva: [null],
      poderRepresentanteLegal: [null],
      ineRepresentanteLegal: [null],
      nombre: [''],
      apellidoPaterno: [null],
      apellidoMaterno: [null],
      telefono: ['', Validators.required],
      correo: ['', [Validators.required, Validators.email]],
      estado: ['', Validators.required],
      municipio: ['', Validators.required],
      colonia: ['', Validators.required],
      calle: ['', Validators.required],
      entreCalles: [null],
      numeroExterior: ['', Validators.required],
      numeroInterior: [null],
      cp: ['', Validators.required],
      nombreEncargado: [''],
      telefonoEncargado: [''],
      correoEncargado: [''],
      sitioWeb: [null],
      socios: this.fb.array([this.crearSocioFormGroup()]),
    });
  }

  private crearSocioFormGroup(): FormGroup {
    return this.fb.group({
      nombre: [''],
      rfc: [''],
      constanciaFiscalArchivo: [null],
      comprobanteDomicilioArchivo: [null],
      identificacionOficialArchivo: [null],
      constanciaFiscalUrl: [''],
      constanciaFiscalNombre: [''],
      comprobanteDomicilioUrl: [''],
      comprobanteDomicilioNombre: [''],
      identificacionOficialUrl: [''],
      identificacionOficialNombre: [''],
    });
  }

  get sociosFormArray(): FormArray {
    return this.clienteForm.get('socios') as FormArray;
  }

  /** Nombre del primer socio (se muestra junto al título “Socios” mientras escriben). */
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
    const g = this.crearSocioFormGroup();
    this.sociosFormArray.push(g);
    if (this.esPersonaMoral()) this.setSocioNombreRequerido(g, true);
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

    const nombreKey =
      field === 'constanciaFiscalArchivo'
        ? 'constanciaFiscalNombre'
        : field === 'comprobanteDomicilioArchivo'
          ? 'comprobanteDomicilioNombre'
          : 'identificacionOficialNombre';
    const urlKey =
      field === 'constanciaFiscalArchivo'
        ? 'constanciaFiscalUrl'
        : field === 'comprobanteDomicilioArchivo'
          ? 'comprobanteDomicilioUrl'
          : 'identificacionOficialUrl';

    group.patchValue({
      [field]: file,
      [nombreKey]: file?.name ?? '',
      [urlKey]: '',
    });
    if (input) input.value = '';
  }

  submit() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idCliente != null && Number(this.idCliente) > 0) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  private appendSociosMultipartCliente(fd: FormData): void {
    let i = 0;
    this.sociosFormArray.controls.forEach((ctrl) => {
      const g = ctrl as FormGroup;
      const nombre = String(g.get('nombre')?.value ?? '').trim();
      const rfc = String(g.get('rfc')?.value ?? '').trim();
      const cf = g.get('constanciaFiscalArchivo')?.value;
      const cd = g.get('comprobanteDomicilioArchivo')?.value;
      const idoc = g.get('identificacionOficialArchivo')?.value;
      const tieneFila =
        !!nombre ||
        !!rfc ||
        cf instanceof File ||
        cd instanceof File ||
        idoc instanceof File;
      if (!tieneFila) return;
      fd.append(`socios[${i}].nombre`, nombre || 'Socio');
      if (rfc) fd.append(`socios[${i}].rfc`, rfc);
      if (cf instanceof File) {
        fd.append(`socios[${i}].constanciaFiscalArchivo`, cf, cf.name);
      }
      if (cd instanceof File) {
        fd.append(`socios[${i}].comprobanteDomicilioArchivo`, cd, cd.name);
      }
      if (idoc instanceof File) {
        fd.append(`socios[${i}].identificacionOficialArchivo`, idoc, idoc.name);
      }
      i += 1;
    });
  }

  /** Multipart alineado con Swagger (cliente + archivos + `socios[i].*`). */
  private construirFormDataCliente(): FormData {
    const v = this.clienteForm.getRawValue() as Record<string, unknown>;
    const tipoRaw = v['tipoPersona'];
    const tipo = tipoRaw != null && String(tipoRaw).trim() !== '' ? Number(tipoRaw) : null;

    const fd = new FormData();

    const idPadre = v['idPadre'];
    if (idPadre !== undefined && idPadre !== null && String(idPadre).trim() !== '') {
      const n = Number(idPadre);
      if (Number.isFinite(n)) fd.append('idPadre', String(Math.trunc(n)));
    }

    if (v['rfc'] != null) fd.append('rfc', String(v['rfc']).trim());
    if (tipo != null && Number.isFinite(tipo)) {
      fd.append('tipoPersona', String(Math.trunc(tipo)));
    }

    const estatusRaw = v['estatus'];
    const estatusNum =
      estatusRaw != null && String(estatusRaw).trim() !== '' && Number.isFinite(Number(estatusRaw))
        ? Math.trunc(Number(estatusRaw))
        : 1;
    fd.append('estatus', String(estatusNum));

    const str = (x: unknown): string | null =>
      x != null && String(x).trim() !== '' ? String(x).trim() : null;

    const app = (key: string, val: unknown): void => {
      const s = str(val);
      if (s != null) fd.append(key, s);
    };

    app('nombre', v['nombre']);
    app('apellidoPaterno', v['apellidoPaterno']);
    app('apellidoMaterno', v['apellidoMaterno']);
    app('telefono', v['telefono']);
    app('correo', v['correo']);
    app('sitioWeb', v['sitioWeb']);
    app('estado', v['estado']);
    app('municipio', v['municipio']);
    app('colonia', v['colonia']);
    app('calle', v['calle']);
    app('entreCalles', v['entreCalles']);
    app('numeroExterior', v['numeroExterior']);
    app('numeroInterior', v['numeroInterior']);
    app('cp', v['cp']);

    const logotipo = v['logotipo'];
    const csf = v['constanciaSituacionFiscal'];
    const comp = v['comprobanteDomicilio'];
    const acta = v['actaConstitutiva'];
    const poder = v['poderRepresentanteLegal'];
    const ine = v['ineRepresentanteLegal'];

    if (tipo === 2) {
      app('nombreEncargado', v['nombreEncargado']);
      app('telefonoEncargado', v['telefonoEncargado']);
      app('correoEncargado', v['correoEncargado']);
      if (acta instanceof File) {
        fd.append('actaConstitutiva', acta, acta.name);
      }
      if (poder instanceof File) {
        fd.append('poderRepresentanteLegal', poder, poder.name);
      }
      if (ine instanceof File) {
        fd.append('ineRepresentanteLegal', ine, ine.name);
      }
    }

    if (logotipo instanceof File) {
      fd.append('logotipo', logotipo, logotipo.name);
    }
    if (csf instanceof File) {
      fd.append('constanciaSituacionFiscal', csf, csf.name);
    }
    if (comp instanceof File) {
      fd.append('comprobanteDomicilio', comp, comp.name);
    }

    const lic = v['licenciaFuncionamiento'];
    const pciv = v['constanciaProteccionCivil'];
    const uso = v['usoSuelo'];
    const plano = v['planoCatastral'];
    if (lic instanceof File) fd.append('licenciaFuncionamiento', lic, lic.name);
    if (pciv instanceof File) {
      fd.append('constanciaProteccionCivil', pciv, pciv.name);
    }
    if (uso instanceof File) fd.append('usoSuelo', uso, uso.name);
    if (plano instanceof File) fd.append('planoCatastral', plano, plano.name);

    this.appendSociosMultipartCliente(fd);
    return fd;
  }

  agregar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    this.onTipoPersonaChange(null);

    if (this.clienteForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;

      const etiquetas: Record<string, string> = {
        idPadre: 'Cliente padre',
        rfc: 'RFC',
        tipoPersona: 'Tipo de Persona',
        estatus: 'Estatus',
        logotipo: 'Logotipo',
        constanciaSituacionFiscal: 'Constancia De Situación Fiscal (RFC De La Empresa)',
        comprobanteDomicilio: 'Comprobante De Domicilio Fiscal',
        actaConstitutiva: 'Acta Constitutiva',
        poderRepresentanteLegal: 'Poder Del Representante Legal',
        ineRepresentanteLegal: 'Identificación Oficial Del Representante Legal',
        nombre: 'Nombre / Razón Social',
        apellidoPaterno: 'Apellido Paterno',
        apellidoMaterno: 'Apellido Materno',
        telefono: 'Teléfono',
        correo: 'Correo Electrónico',
        estado: 'Estado',
        municipio: 'Municipio',
        colonia: 'Colonia',
        calle: 'Calle',
        numeroExterior: 'Número Exterior',
        cp: 'Código Postal',
        nombreEncargado: 'Nombre del Representante Legal',
        telefonoEncargado: 'Teléfono del Representante Legal',
        correoEncargado: 'Email del Representante Legal',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.clienteForm.controls).forEach((key) => {
        const control = this.clienteForm.get(key);
        if (control?.invalid && control.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
        }
      });

      const lista = camposFaltantes
        .map(
          (campo, index) => `
      <div style="padding:8px 12px;border-left:4px solid #d9534f;background:#caa8a8;text-align:center;margin-bottom:8px;border-radius:4px;">
        <strong style="color:#b02a37;">${index + 1}. ${campo}</strong>
      </div>
    `
        )
        .join('');

      Swal.fire({
        color: '#ffffff',
        background: '#141a21',
        title: '¡Faltan campos obligatorios!',
        html: `
        <p style="text-align:center;font-size:15px;margin-bottom:16px;color:white">
          Los siguientes <strong>campos obligatorios</strong> están vacíos.<br>
          Por favor complétalos antes de continuar:
        </p>
        <div style="max-height:350px;overflow-y:auto;">${lista}</div>
      `,
        icon: 'error',
        confirmButtonText: 'Entendido',
        customClass: { popup: 'swal2-padding swal2-border' },
      });
      return;
    }

    if (this.clienteForm.contains('id')) this.clienteForm.removeControl('id');

    const formData = this.construirFormDataCliente();

    this.clieService.agregarCliente(formData).subscribe(
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          title: '¡Operación Exitosa!',
          text: 'Se agregó un nuevo arrendador de manera exitosa.',
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
        });
        this.regresar();
      },
      (error) => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          title: '¡Ops!',
          text: error?.error?.message,
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
        });
      }
    );
  }

  actualizar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    this.onTipoPersonaChange(null);

    if (this.clienteForm.invalid) {
      this.submitButton = 'Actualizar';
      this.loading = false;

      const etiquetas: Record<string, string> = {
        idPadre: 'Cliente padre',
        rfc: 'RFC',
        tipoPersona: 'Tipo de Persona',
        estatus: 'Estatus',
        logotipo: 'Logotipo',
        constanciaSituacionFiscal: 'Constancia De Situación Fiscal (RFC De La Empresa)',
        comprobanteDomicilio: 'Comprobante De Domicilio Fiscal',
        actaConstitutiva: 'Acta Constitutiva',
        poderRepresentanteLegal: 'Poder Del Representante Legal',
        ineRepresentanteLegal: 'Identificación Oficial Del Representante Legal',
        nombre: 'Nombre / Razón Social',
        apellidoPaterno: 'Apellido Paterno',
        apellidoMaterno: 'Apellido Materno',
        telefono: 'Teléfono',
        correo: 'Correo Electrónico',
        estado: 'Estado',
        municipio: 'Municipio',
        colonia: 'Colonia',
        calle: 'Calle',
        numeroExterior: 'Número Exterior',
        cp: 'Código Postal',
        nombreEncargado: 'Nombre del Representante Legal',
        telefonoEncargado: 'Teléfono del Representante Legal',
        correoEncargado: 'Email del Representante Legal',
      };

      const camposFaltantes: string[] = [];
      Object.keys(this.clienteForm.controls).forEach((key) => {
        const control = this.clienteForm.get(key);
        if (control?.invalid && control.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
        }
      });

      const lista = camposFaltantes
        .map(
          (campo, index) => `
        <div style="padding:8px 12px;border-left:4px solid #d9534f;background:#caa8a8;text-align:center;margin-bottom:8px;border-radius:4px;">
          <strong style="color:#b02a37;">${index + 1}. ${campo}</strong>
        </div>`
        )
        .join('');

      Swal.fire({
        color: '#ffffff',
        background: '#141a21',
        title: '¡Faltan campos obligatorios!',
        html: `
        <p style="text-align:center;font-size:15px;margin-bottom:16px;color:white">
          Los siguientes <strong>campos obligatorios</strong> están vacíos.<br>
          Por favor complétalos antes de continuar:
        </p>
        <div style="max-height:350px;overflow-y:auto;">${lista}</div>
      `,
        icon: 'error',
        confirmButtonText: 'Entendido',
        customClass: { popup: 'swal2-padding swal2-border' },
      });
      return;
    }

    const formData = this.construirFormDataCliente();

    this.clieService.actualizarCliente(Number(this.idCliente), formData).subscribe(
      () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          title: '¡Operación Exitosa!',
          text: 'Los datos del arrendador se actualizaron correctamente.',
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
        });
        this.regresar();
      },
      () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          title: '¡Ops!',
          text: 'Ocurrió un error al actualizar el arrendador.',
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
        });
      }
    );
  }

  regresar() {
    this.route.navigateByUrl('/clientes');
  }

  private originalDocs = {
    logotipo: '' as string,
    constanciaSituacionFiscal: '' as string,
    comprobanteDomicilio: '' as string,
    licenciaFuncionamiento: '' as string,
    constanciaProteccionCivil: '' as string,
    usoSuelo: '' as string,
    planoCatastral: '' as string,
    actaConstitutiva: '' as string,
    poderRepresentanteLegal: '' as string,
    ineRepresentanteLegal: '' as string,
  };

  private isFileLike(v: any): v is File {
    return v instanceof File;
  }

  @ViewChild('logoFileInput') logoFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('csfFileInput') csfFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('compDomFileInput')
  compDomFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('actaFileInput') actaFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('poderFileInput') poderFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('ineFileInput') ineFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('licenciaFileInput') licenciaFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('proteccionCivilFileInput')
  proteccionCivilFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('usoSueloFileInput') usoSueloFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('planoCatastralFileInput')
  planoCatastralFileInput!: ElementRef<HTMLInputElement>;

  logoPreviewUrl: string | ArrayBuffer | null = null;
  csfPreviewUrl: string | ArrayBuffer | null = null;
  compDomPreviewUrl: string | ArrayBuffer | null = null;
  actaPreviewUrl: string | ArrayBuffer | null = null;
  poderPreviewUrl: string | ArrayBuffer | null = null;

  logoDragging = false;
  csfDragging = false;
  compDomDragging = false;
  actaDragging = false;
  poderDragging = false;
  licenciaDragging = false;
  proteccionCivilDragging = false;
  usoSueloDragging = false;
  planoCatastralDragging = false;

  csfFileName: string | null = null;
  compDomFileName: string | null = null;
  actaFileName: string | null = null;
  poderFileName: string | null = null;
  licenciaFileName: string | null = null;
  proteccionCivilFileName: string | null = null;
  usoSueloFileName: string | null = null;
  planoCatastralFileName: string | null = null;

  licenciaPreviewUrl: string | ArrayBuffer | null = null;
  proteccionCivilPreviewUrl: string | ArrayBuffer | null = null;
  usoSueloPreviewUrl: string | ArrayBuffer | null = null;
  planoCatastralPreviewUrl: string | ArrayBuffer | null = null;

  private readonly MAX_MB = 10;

  private isImage(file: File): boolean {
    if (!file?.type) return /\.(png|jpe?g|webp)$/i.test(file.name);
    return /^image\/(png|jpe?g|webp)$/i.test(file.type);
  }
  private isPdf(file: File): boolean {
    if (!file?.type) return /\.pdf$/i.test(file.name);
    return file.type === 'application/pdf';
  }
  private isOffice(file: File): boolean {
    const t = file?.type;
    if (!t) return /\.(docx?|xlsx?)$/i.test(file.name);
    return [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ].includes(t);
  }
  private isImageUrl(u: string): boolean {
    return /\.(png|jpe?g|webp|gif|bmp|svg|avif)(\?.*)?$/i.test(u);
  }

  private isLogoImage(file: File): boolean {
    if (!file?.type) return /\.(png|jpe?g)$/i.test(file.name);
    return /^image\/(png|jpe?g)$/i.test(file.type);
  }

  private isAllowedLogo(file: File): boolean {
    const okType = this.isLogoImage(file) || this.isPdf(file);
    const okSize = file.size <= this.MAX_MB * 1024 * 1024;
    return okType && okSize;
  }
  private isAllowedDoc(file: File): boolean {
    const okType = this.isImage(file) || this.isPdf(file);
    const okSize = file.size <= this.MAX_MB * 1024 * 1024;
    return okType && okSize;
  }

  private loadPreview(
    file: File,
    setter: (url: string | ArrayBuffer | null) => void
  ) {
    if (!this.isImage(file)) {
      setter(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setter(reader.result);
    reader.readAsDataURL(file);
  }

  openLogoFilePicker() {
    this.logoFileInput.nativeElement.click();
  }

  /** URL remota del logotipo (el API devuelve string). Si eligieron archivo local, es instancia de `File`. */
  get urlLogotipoRemoto(): string | null {
    const v = this.clienteForm.get('logotipo')?.value;
    return typeof v === 'string' && v.trim() ? v : null;
  }

  /** Texto del badge: nombre local o último segmento de la URL (evita repetir la URL completa dos veces en pantalla). */
  etiquetaLogotipoUploader(): string {
    const v = this.clienteForm.get('logotipo')?.value;
    if (v instanceof File) return v.name;
    if (typeof v === 'string' && v.trim()) {
      return this.nombreArchivoDesdeUrlRemota(v) || v;
    }
    return 'PNG · JPG · JPEG';
  }

  private nombreArchivoDesdeUrlRemota(urlStr: string): string {
    try {
      const u = new URL(urlStr);
      const parts = u.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      return last ? decodeURIComponent(last) : '';
    } catch {
      return '';
    }
  }

  onLogoDragOver(e: DragEvent) {
    e.preventDefault();
    this.logoDragging = true;
  }
  onLogoDragLeave(e: DragEvent) {
    e.preventDefault();
    this.logoDragging = false;
  }


  onLogoFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] || null;
    if (f) this.handleLogoFile(f);
    if (input) input.value = '';
  }

  onLogoDrop(e: DragEvent) {
    e.preventDefault();
    this.logoDragging = false;
    const f = e.dataTransfer?.files?.[0] || null;
    if (f) this.handleLogoFile(f);
  }

  private handleLogoFile(file: File) {
    if (!this.isAllowedLogo(file)) {
      this.clienteForm.get('logotipo')?.setErrors({ invalid: true });
      if (!this.isLogoImage(file) && !this.isPdf(file)) {
        void Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          icon: 'warning',
          title: 'Formato no permitido',
          text: 'El logotipo acepta PNG, JPG, JPEG o PDF (máx. 10 MB).',
        });
      }
      return;
    }

    this.loadPreview(file, (url) => (this.logoPreviewUrl = url));
    this.clienteForm.patchValue({ logotipo: file });
    this.clienteForm.get('logotipo')?.setErrors(null);
  }



  clearLogoImage(e: Event) {
    e.stopPropagation();
    this.logoPreviewUrl = null;
    this.logoFileInput.nativeElement.value = '';
    this.clienteForm.patchValue({ logotipo: this.DEFAULT_AVATAR_URL });
    this.clienteForm.get('logotipo')?.setErrors(null);
  }

  private uploadingLogo = false;
  private uploadLogo(file: File): void {
    if (this.uploadingLogo) return;
    this.uploadingLogo = true;

    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('folder', 'clientes');
    fd.append('idModule', '1');

    this.usuaService
      .uploadFile(fd)
      .pipe(
        finalize(() => {
          this.uploadingLogo = false;
        })
      )
      .subscribe({
        next: (res: any) => {
          const url = this.extractFileUrl(res);
          if (url) {
            this.clienteForm.patchValue({ logotipo: url });
            this.logoPreviewUrl = this.isImageUrl(url) ? url : null;
          } else {
            this.clienteForm.get('logotipo')?.setErrors({ uploadFailed: true });
          }
        },
        error: () => {
          this.clienteForm.get('logotipo')?.setErrors({ uploadFailed: true });
        },
      });
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
    const csfCard = this.autocargaCsfCardCliente?.nativeElement;
    if (csfCard) {
      this.scrollSuaveAElemento(csfCard, 'center');
      this.resaltarAutocargaContrato = true;
      return;
    }
    const docs = this.docsSectionCliente?.nativeElement;
    if (!docs) return;
    this.scrollSuaveAElemento(docs, 'center');
    this.resaltarAutocargaDocs = true;
  }

  private scrollArribaTrasOcrExitoso(): void {
    const arriba =
      this.topFormularioCliente?.nativeElement ??
      this.inicioFormularioCliente?.nativeElement;
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
    patch: ReturnType<typeof mapearConstanciaACliente>,
  ): void {
    const valores: Record<string, unknown> = {};
    const claves: (keyof ReturnType<typeof mapearConstanciaACliente>)[] = [
      'rfc',
      'tipoPersona',
      'nombre',
      'apellidoPaterno',
      'apellidoMaterno',
      'estado',
      'municipio',
      'colonia',
      'calle',
      'entreCalles',
      'numeroExterior',
      'numeroInterior',
      'cp',
    ];

    for (const key of claves) {
      const valor = patch[key];
      if (valor == null || String(valor).trim() === '') continue;
      valores[key] = valor;
    }

    if (patch.tipoPersona === 2) {
      valores['apellidoPaterno'] = '';
      valores['apellidoMaterno'] = '';
    }

    if (Object.keys(valores).length === 0) return;

    this.clienteForm.patchValue(valores);
    if (valores['tipoPersona'] != null) {
      this.onTipoPersonaChange(null);
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
    this.aplicarDatosConstanciaAlFormulario(mapearConstanciaACliente(constancia));
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

  openCsfFilePicker() {
    this.csfFileInput.nativeElement.click();
  }
  onCsfDragOver(e: DragEvent) {
    e.preventDefault();
    this.csfDragging = true;
  }
  onCsfDragLeave(e: DragEvent) {
    e.preventDefault();
    this.csfDragging = false;
  }
  onCsfDrop(e: DragEvent) {
    e.preventDefault();
    this.csfDragging = false;
    const f = e.dataTransfer?.files?.[0] || null;
    if (f) this.handleCsfFile(f, this.csfFileInput?.nativeElement);
  }
  onCsfFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] || null;
    if (f) this.handleCsfFile(f, input);
    if (input) input.value = '';
  }
  clearCsfFile(e: Event) {
    e.stopPropagation();
    this.csfPreviewUrl = null;
    this.csfFileName = null;
    this.csfFileInput.nativeElement.value = '';
    this.clienteForm.patchValue({
      constanciaSituacionFiscal: this.DEFAULT_AVATAR_URL,
    });
    this.clienteForm.get('constanciaSituacionFiscal')?.setErrors(null);
  }
  private handleCsfFile(file: File, input?: HTMLInputElement) {
    if (this.autocargaCsfPendiente && !this.esArchivoPdf(file)) {
      if (input) input.value = '';
      this.clienteForm.get('constanciaSituacionFiscal')?.setValue(null);
      this.csfFileName = null;
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

    if (!this.isAllowedDoc(file)) {
      this.clienteForm
        .get('constanciaSituacionFiscal')
        ?.setErrors({ invalid: true });
      return;
    }
    this.csfFileName = file.name;
    this.loadPreview(file, (url) => (this.csfPreviewUrl = url));
    this.clienteForm.patchValue({ constanciaSituacionFiscal: file });
    this.clienteForm.get('constanciaSituacionFiscal')?.setErrors(null);

    if (this.autocargaCsfPendiente) {
      this.procesarConstanciaFiscalOcr(file);
    }
  }
  private uploadingCsf = false;
  private uploadCsf(file: File): void {
    if (this.uploadingCsf) return;
    this.uploadingCsf = true;

    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('folder', 'clientes');
    fd.append('idModule', '1');

    this.usuaService
      .uploadFile(fd)
      .pipe(
        finalize(() => {
          this.uploadingCsf = false;
        })
      )
      .subscribe({
        next: (res: any) => {
          const url = this.extractFileUrl(res);
          if (url) {
            this.clienteForm.patchValue({ constanciaSituacionFiscal: url });
            this.csfPreviewUrl = this.isImageUrl(url) ? url : null;
          } else {
            this.clienteForm
              .get('constanciaSituacionFiscal')
              ?.setErrors({ uploadFailed: true });
          }
        },
        error: () => {
          this.clienteForm
            .get('constanciaSituacionFiscal')
            ?.setErrors({ uploadFailed: true });
        },
      });
  }

  openCompDomFilePicker() {
    this.compDomFileInput.nativeElement.click();
  }
  onCompDomDragOver(e: DragEvent) {
    e.preventDefault();
    this.compDomDragging = true;
  }
  onCompDomDragLeave(e: DragEvent) {
    e.preventDefault();
    this.compDomDragging = false;
  }
  onCompDomDrop(e: DragEvent) {
    e.preventDefault();
    this.compDomDragging = false;
    const f = e.dataTransfer?.files?.[0] || null;
    if (f) this.handleCompDomFile(f);
  }
  onCompDomFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] || null;
    if (f) this.handleCompDomFile(f);
    if (input) input.value = '';
  }
  clearCompDomFile(e: Event) {
    e.stopPropagation();
    this.compDomPreviewUrl = null;
    this.compDomFileName = null;
    this.compDomFileInput.nativeElement.value = '';
    this.clienteForm.patchValue({
      comprobanteDomicilio: this.DEFAULT_AVATAR_URL,
    });
    this.clienteForm.get('comprobanteDomicilio')?.setErrors(null);
  }
  private handleCompDomFile(file: File) {
    if (!this.isAllowedDoc(file)) {
      this.clienteForm
        .get('comprobanteDomicilio')
        ?.setErrors({ invalid: true });
      return;
    }
    this.compDomFileName = file.name;
    this.loadPreview(file, (url) => (this.compDomPreviewUrl = url));
    this.clienteForm.patchValue({ comprobanteDomicilio: file });
    this.clienteForm.get('comprobanteDomicilio')?.setErrors(null);
  }
  private uploadingComp = false;
  private uploadCompDom(file: File): void {
    if (this.uploadingComp) return;
    this.uploadingComp = true;

    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('folder', 'clientes');
    fd.append('idModule', '1');

    this.usuaService
      .uploadFile(fd)
      .pipe(
        finalize(() => {
          this.uploadingComp = false;
        })
      )
      .subscribe({
        next: (res: any) => {
          const url = this.extractFileUrl(res);
          if (url) {
            this.clienteForm.patchValue({ comprobanteDomicilio: url });
            this.compDomPreviewUrl = this.isImageUrl(url) ? url : null;
          } else {
            this.clienteForm
              .get('comprobanteDomicilio')
              ?.setErrors({ uploadFailed: true });
          }
        },
        error: () => {
          this.clienteForm
            .get('comprobanteDomicilio')
            ?.setErrors({ uploadFailed: true });
        },
      });
  }

  openActaFilePicker() {
    this.actaFileInput.nativeElement.click();
  }
  onActaDragOver(e: DragEvent) {
    e.preventDefault();
    this.actaDragging = true;
  }
  onActaDragLeave(e: DragEvent) {
    e.preventDefault();
    this.actaDragging = false;
  }
  onActaDrop(e: DragEvent) {
    e.preventDefault();
    this.actaDragging = false;
    const f = e.dataTransfer?.files?.[0] || null;
    if (f) this.handleActaFile(f);
  }
  onActaFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] || null;
    if (f) this.handleActaFile(f);
    if (input) input.value = '';
  }
  clearActaFile(e: Event) {
    e.stopPropagation();
    this.actaPreviewUrl = null;
    this.actaFileName = null;
    this.actaFileInput.nativeElement.value = '';
    this.clienteForm.patchValue({ actaConstitutiva: this.DEFAULT_AVATAR_URL });
    this.clienteForm.get('actaConstitutiva')?.setErrors(null);
  }
  private handleActaFile(file: File) {
    if (!this.isAllowedDoc(file)) {
      this.clienteForm.get('actaConstitutiva')?.setErrors({ invalid: true });
      return;
    }
    this.actaFileName = file.name;
    this.loadPreview(file, (url) => (this.actaPreviewUrl = url));
    this.clienteForm.patchValue({ actaConstitutiva: file });
    this.clienteForm.get('actaConstitutiva')?.setErrors(null);
  }
  private uploadingActa = false;
  private uploadActa(file: File): void {
    if (this.uploadingActa) return;
    this.uploadingActa = true;

    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('folder', 'clientes');
    fd.append('idModule', '1');

    this.usuaService
      .uploadFile(fd)
      .pipe(
        finalize(() => {
          this.uploadingActa = false;
        })
      )
      .subscribe({
        next: (res: any) => {
          const url = this.extractFileUrl(res);
          if (url) {
            this.clienteForm.patchValue({ actaConstitutiva: url });
            this.actaPreviewUrl = this.isImageUrl(url) ? url : null;
          } else {
            this.clienteForm
              .get('actaConstitutiva')
              ?.setErrors({ uploadFailed: true });
          }
        },
        error: () => {
          this.clienteForm
            .get('actaConstitutiva')
            ?.setErrors({ uploadFailed: true });
        },
      });
  }

  openPoderFilePicker(): void {
    this.poderFileInput.nativeElement.click();
  }
  onPoderDragOver(e: DragEvent): void {
    e.preventDefault();
    this.poderDragging = true;
  }
  onPoderDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.poderDragging = false;
  }
  onPoderDrop(e: DragEvent): void {
    e.preventDefault();
    this.poderDragging = false;
    const f = e.dataTransfer?.files?.[0] ?? null;
    if (f) this.handlePoderFile(f);
  }
  onPoderFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (f) this.handlePoderFile(f);
    if (input) input.value = '';
  }
  private handlePoderFile(file: File): void {
    if (!this.isAllowedDoc(file)) {
      this.clienteForm
        .get('poderRepresentanteLegal')
        ?.setErrors({ invalid: true });
      return;
    }
    this.poderFileName = file.name;
    this.loadPreview(file, (url) => (this.poderPreviewUrl = url));
    this.clienteForm.patchValue({ poderRepresentanteLegal: file });
    this.clienteForm.get('poderRepresentanteLegal')?.setErrors(null);
  }

  openIneFilePicker(): void {
    this.ineFileInput.nativeElement.click();
  }
  onIneDragOver(e: DragEvent): void {
    e.preventDefault();
    this.ineDragging = true;
  }
  onIneDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.ineDragging = false;
  }
  onIneDrop(e: DragEvent): void {
    e.preventDefault();
    this.ineDragging = false;
    const f = e.dataTransfer?.files?.[0] || null;
    if (f) this.handleIneFile(f);
  }
  onIneFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] || null;
    if (f) this.handleIneFile(f);
    if (input) input.value = '';
  }
  clearIneFile(e: Event): void {
    e.stopPropagation();
    this.inePreviewUrl = null;
    this.ineFileName = null;
    this.ineFileInput.nativeElement.value = '';
    this.clienteForm.patchValue({ ineRepresentanteLegal: this.DEFAULT_AVATAR_URL });
    this.clienteForm.get('ineRepresentanteLegal')?.setErrors(null);
  }
  private handleIneFile(file: File): void {
    if (!this.isAllowedDoc(file)) {
      this.clienteForm.get('ineRepresentanteLegal')?.setErrors({ invalid: true });
      return;
    }
    this.ineFileName = file.name;
    this.loadPreview(file, (url) => (this.inePreviewUrl = url));
    this.clienteForm.patchValue({ ineRepresentanteLegal: file });
    this.clienteForm.get('ineRepresentanteLegal')?.setErrors(null);
  }

  /** Documentos opcionales: licencia, protección civil, uso de suelo, plano catastral. */
  private handleExtraDoc(
    file: File,
    control: 'licenciaFuncionamiento' | 'constanciaProteccionCivil' | 'usoSuelo' | 'planoCatastral',
  ): void {
    if (!this.isAllowedDoc(file)) {
      this.clienteForm.get(control)?.setErrors({ invalid: true });
      return;
    }
    if (control === 'licenciaFuncionamiento') {
      this.licenciaFileName = file.name;
      this.loadPreview(file, (url) => (this.licenciaPreviewUrl = url));
    } else if (control === 'constanciaProteccionCivil') {
      this.proteccionCivilFileName = file.name;
      this.loadPreview(file, (url) => (this.proteccionCivilPreviewUrl = url));
    } else if (control === 'usoSuelo') {
      this.usoSueloFileName = file.name;
      this.loadPreview(file, (url) => (this.usoSueloPreviewUrl = url));
    } else {
      this.planoCatastralFileName = file.name;
      this.loadPreview(file, (url) => (this.planoCatastralPreviewUrl = url));
    }
    this.clienteForm.patchValue({ [control]: file });
    this.clienteForm.get(control)?.setErrors(null);
  }

  openLicenciaFilePicker(): void {
    this.licenciaFileInput.nativeElement.click();
  }
  onLicenciaDragOver(e: DragEvent): void {
    e.preventDefault();
    this.licenciaDragging = true;
  }
  onLicenciaDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.licenciaDragging = false;
  }
  onLicenciaDrop(e: DragEvent): void {
    e.preventDefault();
    this.licenciaDragging = false;
    const f = e.dataTransfer?.files?.[0] ?? null;
    if (f) this.handleExtraDoc(f, 'licenciaFuncionamiento');
  }
  onLicenciaFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (f) this.handleExtraDoc(f, 'licenciaFuncionamiento');
    if (input) input.value = '';
  }

  openProteccionCivilFilePicker(): void {
    this.proteccionCivilFileInput.nativeElement.click();
  }
  onProteccionCivilDragOver(e: DragEvent): void {
    e.preventDefault();
    this.proteccionCivilDragging = true;
  }
  onProteccionCivilDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.proteccionCivilDragging = false;
  }
  onProteccionCivilDrop(e: DragEvent): void {
    e.preventDefault();
    this.proteccionCivilDragging = false;
    const f = e.dataTransfer?.files?.[0] ?? null;
    if (f) this.handleExtraDoc(f, 'constanciaProteccionCivil');
  }
  onProteccionCivilFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (f) this.handleExtraDoc(f, 'constanciaProteccionCivil');
    if (input) input.value = '';
  }

  openUsoSueloFilePicker(): void {
    this.usoSueloFileInput.nativeElement.click();
  }
  onUsoSueloDragOver(e: DragEvent): void {
    e.preventDefault();
    this.usoSueloDragging = true;
  }
  onUsoSueloDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.usoSueloDragging = false;
  }
  onUsoSueloDrop(e: DragEvent): void {
    e.preventDefault();
    this.usoSueloDragging = false;
    const f = e.dataTransfer?.files?.[0] ?? null;
    if (f) this.handleExtraDoc(f, 'usoSuelo');
  }
  onUsoSueloFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (f) this.handleExtraDoc(f, 'usoSuelo');
    if (input) input.value = '';
  }

  openPlanoCatastralFilePicker(): void {
    this.planoCatastralFileInput.nativeElement.click();
  }
  onPlanoCatastralDragOver(e: DragEvent): void {
    e.preventDefault();
    this.planoCatastralDragging = true;
  }
  onPlanoCatastralDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.planoCatastralDragging = false;
  }
  onPlanoCatastralDrop(e: DragEvent): void {
    e.preventDefault();
    this.planoCatastralDragging = false;
    const f = e.dataTransfer?.files?.[0] ?? null;
    if (f) this.handleExtraDoc(f, 'planoCatastral');
  }
  onPlanoCatastralFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (f) this.handleExtraDoc(f, 'planoCatastral');
    if (input) input.value = '';
  }

  private extractFileUrl(res: any): string {
    return (
      res?.url ??
      res?.Location ??
      res?.data?.url ??
      res?.data?.Location ??
      res?.key ??
      res?.Key ??
      res?.path ??
      res?.filePath ??
      ''
    );
  }

  private buildFD(file: File): FormData {
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('folder', 'clientes');
    fd.append('idModule', '1');
    return fd;
  }

  private resolveUrlForField(
    field: keyof typeof this.originalDocs,
    value: any
  ) {
    if (this.isFileLike(value)) {
      return this.usuaService.uploadFile(this.buildFD(value)).pipe(
        map((r: any) => this.extractFileUrl(r) || ''),
        catchError(() => of(this.originalDocs[field] || ''))
      );
    }
    if (typeof value === 'string' && value.trim()) return of(value.trim());
    return of(this.originalDocs[field] || '');
  }
}
