import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { AuthenticationService } from 'src/app/services/auth.service';
import { ClientesInmueblesService } from 'src/app/services/moduleService/clientes-inmuebles.service';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { PdfOcrService } from 'src/app/services/moduleService/pdf-ocr.service';
import { UsuariosService } from 'src/app/services/moduleService/usuario.service';
import {
  extraerConstanciaDeRespuestaOcr,
  mapearConstanciaACliente,
} from 'src/app/shared/constancia-fiscal-ocr.mapper';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-agregar-cliente-inmueble',
  templateUrl: './agregar-cliente-inmueble.component.html',
  styleUrl: './agregar-cliente-inmueble.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarClienteInmuebleComponent implements OnInit {
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
  public idCliente: number;
  public title = 'Agregar Cliente';
  public listaClientes: any[] = [];
  selectedFileName: string = '';
  previewUrl: string | ArrayBuffer | null = null;
  public showRol: any;

  resaltarAutocargaContrato = false;
  resaltarAutocargaDocs = false;
  autocargaCsfPendiente = false;
  private procesandoConstanciaOcr = false;
  private promptAutocargaMostrado = false;

  /**
   * `true` = ocultar Nombre/Teléfono/Correo Encargado en persona física.
   * `false` = mostrarlos en física y moral.
   */
  readonly ocultarEncargadoEnFisica = true;

  get mostrarCamposEncargado(): boolean {
    if (!this.ocultarEncargadoEnFisica) return true;
    return Number(this.clienteForm?.value?.tipoPersona) === 2;
  }

  constructor(
    private fb: FormBuilder,
    private clieService: ClientesInmueblesService,
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
    this.obtenerClientes();
    this.initForm();
    this.activatedRouted.params.subscribe((params) => {
      this.idCliente = params['idCliente'];
      if (this.idCliente) {
        this.title = 'Actualizar Cliente';
        this.obtenerClienteID();
      } else {
        this.mostrarPromptAutocargaContrato();
      }
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

  obtenerClienteID() {
    this.clieService
      .obtenerCliente(this.idCliente)
      .subscribe((response: any) => {
        const d = response?.data ?? {};

        this.clienteForm.patchValue({
          idPadre: Number(d.idPadre ?? 0),
          rfc: String(d.rfc ?? '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 13),
          tipoPersona: d.tipoPersona ?? null,
          estatus: d.estatus ?? 1,
          logotipo: d.logotipo ?? null,
          nombre: d.nombre ?? '',
          apellidoPaterno: d.apellidoPaterno ?? null,
          apellidoMaterno: d.apellidoMaterno ?? null,
          telefono: d.telefono ?? '',
          correo: d.correo ?? '',
          estado: d.estado ?? '',
          municipio: d.municipio ?? '',
          colonia: d.colonia ?? '',
          calle: d.calle ?? '',
          entreCalles: d.entreCalles ?? '',
          numeroExterior: d.numeroExterior ?? '',
          numeroInterior: d.numeroInterior ?? '',
          cp: d.cp ?? '',
          nombreEncargado: d.nombreEncargado ?? '',
          telefonoEncargado: d.telefonoEncargado ?? '',
          correoEncargado: d.correoEncargado ?? '',
          sitioWeb: d.sitioWeb ?? '',
          constanciaSituacionFiscal: d.constanciaSituacionFiscal ?? null,
          comprobanteDomicilio: d.comprobanteDomicilio ?? null,
          actaConstitutiva: d.actaConstitutiva ?? null,
        });
        this.originalDocs = {
          logotipo: d.logotipo ?? '',
          constanciaSituacionFiscal: d.constanciaSituacionFiscal ?? '',
          comprobanteDomicilio: d.comprobanteDomicilio ?? '',
          actaConstitutiva: d.actaConstitutiva ?? '',
        };
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

  onTipoPersonaChange(_event: any) {
    const value: number | null = this.clienteForm.get('tipoPersona')!.value;

    if (value === 2) {
      this.clienteForm.patchValue({
        apellidoPaterno: null,
        apellidoMaterno: null,
      });
    } else if (value === 1 && this.ocultarEncargadoEnFisica) {
      this.clienteForm.patchValue({
        nombreEncargado: '',
        telefonoEncargado: '',
        correoEncargado: '',
      });
    }
  }

  sanitizeInput(event: any): void {
    const inputElement = event.target as HTMLInputElement;
    const sanitizedValue = inputElement.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
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
      idPadre: [null],
      rfc: [
        '',
        [
          Validators.required,
          Validators.minLength(12),
          Validators.maxLength(13),
          Validators.pattern(/^[A-Z]{3,4}\d{6}[A-Z0-9]{3}$/),
        ],
      ],
      tipoPersona: [null, Validators.required],
      estatus: [1],
      logotipo: [null],
      constanciaSituacionFiscal: [null],
      comprobanteDomicilio: [null],
      actaConstitutiva: [null],
      nombre: ['', Validators.required],
      apellidoPaterno: [null],
      apellidoMaterno: [null],
      telefono: [''],
      correo: ['', [Validators.email]],
      estado: [''],
      municipio: [''],
      colonia: [''],
      calle: [''],
      entreCalles: [null],
      numeroExterior: [''],
      numeroInterior: [null],
      cp: [''],
      nombreEncargado: [''],
      telefonoEncargado: [''],
      correoEncargado: ['', [Validators.email]],
      sitioWeb: [null],
    });
  }

  private appendSiTieneValor(fd: FormData, key: string, val: unknown): void {
    if (val == null) return;
    if (typeof val === 'string') {
      const s = val.trim();
      if (s === '') return;
      fd.append(key, s);
      return;
    }
    if (typeof val === 'number') {
      if (!Number.isFinite(val)) return;
      fd.append(key, String(val));
      return;
    }
    if (val instanceof File) {
      fd.append(key, val, val.name);
    }
  }

  private buildClienteFormData(): FormData {
    const v = this.clienteForm.value;
    const tipo =
      v.tipoPersona != null && String(v.tipoPersona).trim() !== ''
        ? Number(v.tipoPersona)
        : null;

    const fd = new FormData();

    this.appendSiTieneValor(fd, 'idPadre', v.idPadre != null ? Number(v.idPadre) : null);
    this.appendSiTieneValor(fd, 'rfc', v.rfc);
    this.appendSiTieneValor(fd, 'tipoPersona', tipo);
    this.appendSiTieneValor(fd, 'estatus', v.estatus != null ? Number(v.estatus) : null);
    this.appendSiTieneValor(fd, 'nombre', v.nombre);

    if (tipo !== 2) {
      this.appendSiTieneValor(fd, 'apellidoPaterno', v.apellidoPaterno);
      this.appendSiTieneValor(fd, 'apellidoMaterno', v.apellidoMaterno);
    }

    this.appendSiTieneValor(fd, 'telefono', v.telefono);
    this.appendSiTieneValor(fd, 'correo', v.correo);
    this.appendSiTieneValor(fd, 'estado', v.estado);
    this.appendSiTieneValor(fd, 'municipio', v.municipio);
    this.appendSiTieneValor(fd, 'colonia', v.colonia);
    this.appendSiTieneValor(fd, 'calle', v.calle);
    this.appendSiTieneValor(fd, 'entreCalles', v.entreCalles);
    this.appendSiTieneValor(fd, 'numeroExterior', v.numeroExterior);
    this.appendSiTieneValor(fd, 'numeroInterior', v.numeroInterior);
    this.appendSiTieneValor(fd, 'cp', v.cp);
    this.appendSiTieneValor(fd, 'sitioWeb', v.sitioWeb);

    if (!this.ocultarEncargadoEnFisica || tipo === 2) {
      this.appendSiTieneValor(fd, 'nombreEncargado', v.nombreEncargado);
      this.appendSiTieneValor(fd, 'telefonoEncargado', v.telefonoEncargado);
      this.appendSiTieneValor(fd, 'correoEncargado', v.correoEncargado);
    }

    // Solo archivos nuevos; no reenviar URLs ya guardadas
    if (v.logotipo instanceof File) {
      fd.append('logotipo', v.logotipo, v.logotipo.name);
    }
    if (v.constanciaSituacionFiscal instanceof File) {
      fd.append(
        'constanciaSituacionFiscal',
        v.constanciaSituacionFiscal,
        v.constanciaSituacionFiscal.name,
      );
    }
    if (v.comprobanteDomicilio instanceof File) {
      fd.append(
        'comprobanteDomicilio',
        v.comprobanteDomicilio,
        v.comprobanteDomicilio.name,
      );
    }
    if (v.actaConstitutiva instanceof File) {
      fd.append('actaConstitutiva', v.actaConstitutiva, v.actaConstitutiva.name);
    }

    return fd;
  }

  submit() {
    this.submitButton = 'Cargando...';
    this.loading = true;
    if (this.idCliente) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  private recolectarCamposInvalidos(): string[] {
    const etiquetas: Record<string, string> = {
      rfc: 'RFC',
      tipoPersona: 'Tipo de Persona',
      nombre: 'Nombre / Razón Social',
      correo: 'Correo Electrónico',
      correoEncargado: 'Email del Encargado',
    };

    const camposFaltantes: string[] = [];
    Object.keys(this.clienteForm.controls).forEach((key) => {
      const control = this.clienteForm.get(key);
      if (!control?.invalid || !control.errors) return;

      const etiqueta = etiquetas[key] || key;
      if (control.errors['required']) {
        camposFaltantes.push(etiqueta);
      } else if (control.errors['email']) {
        camposFaltantes.push(`${etiqueta} (correo inválido)`);
      } else if (key === 'rfc' && (control.errors['minlength'] || control.errors['maxlength'])) {
        camposFaltantes.push(`${etiqueta} (debe tener 12 o 13 caracteres)`);
      } else if (key === 'rfc' && control.errors['pattern']) {
        camposFaltantes.push(`${etiqueta} (formato inválido)`);
      }
    });
    return camposFaltantes;
  }

  private mostrarSwalCamposInvalidos(esActualizar: boolean): void {
    this.submitButton = esActualizar ? 'Actualizar' : 'Guardar';
    this.loading = false;

    const camposFaltantes = this.recolectarCamposInvalidos();
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
      title: '¡Revisa los campos!',
      html: `
        <p style="text-align:center;font-size:15px;margin-bottom:16px;color:white">
          Los siguientes campos tienen errores o están vacíos.<br>
          Por favor corrígelos antes de continuar:
        </p>
        <div style="max-height:350px;overflow-y:auto;">${lista}</div>
      `,
      icon: 'error',
      confirmButtonText: 'Entendido',
      customClass: { popup: 'swal2-padding swal2-border' },
    });
  }

  agregar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    const tipo = Number(this.clienteForm.get('tipoPersona')?.value ?? null);
    if (tipo === 2) {
      this.clienteForm.patchValue({
        apellidoPaterno: null,
        apellidoMaterno: null,
      });
    } else if (tipo === 1 && this.ocultarEncargadoEnFisica) {
      this.clienteForm.patchValue({
        nombreEncargado: '',
        telefonoEncargado: '',
        correoEncargado: '',
      });
    }

    if (this.clienteForm.invalid) {
      this.mostrarSwalCamposInvalidos(false);
      return;
    }

    if (this.clienteForm.contains('id')) this.clienteForm.removeControl('id');
    const formData = this.buildClienteFormData();

    this.clieService.agregarCliente(formData).subscribe(
      () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          title: '¡Operación Exitosa!',
          text: 'Se agregó un nuevo cliente de manera exitosa.',
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

    const tipo = Number(this.clienteForm.get('tipoPersona')?.value ?? null);
    if (tipo === 2) {
      this.clienteForm.patchValue({
        apellidoPaterno: null,
        apellidoMaterno: null,
      });
    } else if (tipo === 1 && this.ocultarEncargadoEnFisica) {
      this.clienteForm.patchValue({
        nombreEncargado: '',
        telefonoEncargado: '',
        correoEncargado: '',
      });
    }

    if (this.clienteForm.invalid) {
      this.mostrarSwalCamposInvalidos(true);
      return;
    }

    const formData = this.buildClienteFormData();

    this.clieService.actualizarCliente(this.idCliente, formData).subscribe(
      () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          title: '¡Operación Exitosa!',
          text: 'Los datos del cliente se actualizaron correctamente.',
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
          text: 'Ocurrió un error al actualizar el cliente.',
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
        });
      }
    );
  }

  regresar() {
    this.route.navigateByUrl('/clientes-inmuebles');
  }

  private originalDocs = {
    logotipo: '' as string,
    constanciaSituacionFiscal: '' as string,
    comprobanteDomicilio: '' as string,
    actaConstitutiva: '' as string,
  };

  private isFileLike(v: any): v is File {
    return v instanceof File;
  }

  @ViewChild('logoFileInput') logoFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('csfFileInput') csfFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('compDomFileInput')
  compDomFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('actaFileInput') actaFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('autocargaCsfCardCliente')
  autocargaCsfCardCliente?: ElementRef<HTMLElement>;
  @ViewChild('inicioFormularioCliente')
  inicioFormularioCliente?: ElementRef<HTMLElement>;
  @ViewChild('docsSectionCliente')
  docsSectionCliente?: ElementRef<HTMLElement>;

  logoPreviewUrl: string | ArrayBuffer | null = null;
  csfPreviewUrl: string | ArrayBuffer | null = null;
  compDomPreviewUrl: string | ArrayBuffer | null = null;
  actaPreviewUrl: string | ArrayBuffer | null = null;

  logoDragging = false;
  csfDragging = false;
  compDomDragging = false;
  actaDragging = false;

  csfFileName: string | null = null;
  compDomFileName: string | null = null;
  actaFileName: string | null = null;

  private readonly MAX_MB = 3;

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
    const okType = this.isLogoImage(file);
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
      if (!this.isLogoImage(file)) {
        Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          icon: 'warning',
          title: 'Formato no permitido',
          text: 'El logotipo solo acepta PNG, JPG o JPEG.'
        });
      }
      return;
    }

    this.validateLogoDimensions(file, 799, 286).then(isValid => {
      if (!isValid) {
        this.logoPreviewUrl = null;
        this.clienteForm.patchValue({ logotipo: null });
        this.clienteForm.get('logotipo')?.setErrors({ invalidDimensions: true });

        Swal.fire({
          color: '#ffffff',
        background: '#141a21',
          icon: 'warning',
          title: '¡Dimensiones Inválidas!',
          text: 'El logotipo debe medir exactamente 799 x 286 px.'
        });

        return;
      }

      this.loadPreview(file, (url) => (this.logoPreviewUrl = url));
      this.clienteForm.patchValue({ logotipo: file });
      this.clienteForm.get('logotipo')?.setErrors(null);
    });
  }

  private validateLogoDimensions(file: File, width: number, height: number): Promise<boolean> {
    return new Promise(resolve => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        const isValid = img.width === width && img.height === height;
        URL.revokeObjectURL(objectUrl);
        resolve(isValid);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(false);
      };

      img.src = objectUrl;
    });
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
    this.scrollSuaveAElemento(
      this.inicioFormularioCliente?.nativeElement,
      'start',
    );
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
      if (key === 'rfc') {
        valores[key] = String(valor)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 13);
        continue;
      }
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
