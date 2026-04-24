import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { AuthenticationService } from 'src/app/services/auth.service';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { UsuariosService } from 'src/app/services/moduleService/usuario.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-agregar-cliente',
  templateUrl: './agregar-cliente.component.html',
  styleUrl: './agregar-cliente.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class AgregarClienteComponent implements OnInit {
  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public clienteForm: FormGroup;
  public idCliente: number;
  public title = 'Agregar Arrendador';
  public listaClientes: any[] = [];
  selectedFileName: string = '';
  previewUrl: string | ArrayBuffer | null = null;
  public showRol: any;
  ineFileName: string | null = null;
  inePreviewUrl: string | ArrayBuffer | null = null;
  ineDragging = false;

  constructor(
    private fb: FormBuilder,
    private clieService: ClientesService,
    private activatedRouted: ActivatedRoute,
    private route: Router,
    private usuaService: UsuariosService,
    private users: AuthenticationService
  ) {
    const user = this.users.getUser();
  }

  ngOnInit(): void {
    this.obtenerClientes();
    this.initForm();
    this.activatedRouted.params.subscribe((params) => {
      this.idCliente = params['idCliente'];
      if (this.idCliente) {
        this.title = 'Actualizar Arrendador';
        this.obtenerClienteID();
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
          rfc: d.rfc ?? '',
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
          ineRepresentanteLegal: d.ineRepresentanteLegal ?? null,
        });
        this.originalDocs = {
          logotipo: d.logotipo ?? '',
          constanciaSituacionFiscal: d.constanciaSituacionFiscal ?? '',
          comprobanteDomicilio: d.comprobanteDomicilio ?? '',
          actaConstitutiva: d.actaConstitutiva ?? '',
          ineRepresentanteLegal: d.ineRepresentanteLegal ?? '',
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

    if (value === 1) {
      this.clienteForm
        .get('apellidoPaterno')
        ?.setValidators([Validators.required]);
      this.clienteForm
        .get('apellidoMaterno')
        ?.setValidators([Validators.required]);
    } else if (value === 2) {
      this.clienteForm.get('apellidoPaterno')?.clearValidators();
      this.clienteForm.get('apellidoMaterno')?.clearValidators();
      this.clienteForm.patchValue({
        apellidoPaterno: null,
        apellidoMaterno: null,
      });
    }

    this.clienteForm.get('apellidoPaterno')?.updateValueAndValidity();
    this.clienteForm.get('apellidoMaterno')?.updateValueAndValidity();
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
      idPadre: [null, Validators.required],
      rfc: ['', Validators.required],
      tipoPersona: [null, Validators.required],
      estatus: [1, Validators.required],
      logotipo: [null, Validators.required],
      constanciaSituacionFiscal: [null, Validators.required],
      comprobanteDomicilio: [null, Validators.required],
      actaConstitutiva: [null, Validators.required],
      ineRepresentanteLegal: [null, Validators.required],
      nombre: ['', Validators.required],
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
      nombreEncargado: ['', Validators.required],
      telefonoEncargado: ['', Validators.required],
      correoEncargado: ['', [Validators.required, Validators.email]],
      sitioWeb: [null],
      socios: this.fb.array([this.crearSocioFormGroup()]),
    });
  }

  private crearSocioFormGroup(): FormGroup {
    return this.fb.group({
      nombreSocio: ['', Validators.required],
      rfcSocio: [null],
      socioConstanciaSituacionFiscal: [null],
      socioConstanciaSituacionFiscalNombre: [''],
      socioComprobanteDomicilio: [null],
      socioComprobanteDomicilioNombre: [''],
      socioActaConstitutiva: [null],
      socioActaConstitutivaNombre: [''],
    });
  }

  get sociosFormArray(): FormArray {
    return this.clienteForm.get('socios') as FormArray;
  }

  /** Nombre del primer socio (se muestra junto al título “Socios” mientras escriben). */
  get primerNombreSocio(): string {
    const raw = this.sociosFormArray?.at(0)?.get('nombreSocio')?.value;
    if (raw == null) return '';
    return String(raw).trim();
  }

  nombreSocioEnIndice(index: number): string {
    const raw = this.sociosFormArray?.at(index)?.get('nombreSocio')?.value;
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
    field:
      | 'socioConstanciaSituacionFiscal'
      | 'socioComprobanteDomicilio'
      | 'socioActaConstitutiva',
    nameField:
      | 'socioConstanciaSituacionFiscalNombre'
      | 'socioComprobanteDomicilioNombre'
      | 'socioActaConstitutivaNombre',
  ): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const group = this.sociosFormArray.at(index) as FormGroup;

    group.patchValue({
      [field]: file,
      [nameField]: file?.name ?? '',
    });
    if (input) input.value = '';
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

  agregar() {
    this.submitButton = 'Cargando...';
    this.loading = true;

    const tipo = Number(this.clienteForm.get('tipoPersona')?.value ?? null);
    if (tipo === 1) {
      this.clienteForm
        .get('apellidoPaterno')
        ?.setValidators([Validators.required]);
      this.clienteForm
        .get('apellidoMaterno')
        ?.setValidators([Validators.required]);
    } else if (tipo === 2) {
      this.clienteForm.get('apellidoPaterno')?.clearValidators();
      this.clienteForm.get('apellidoMaterno')?.clearValidators();
      this.clienteForm.patchValue({
        apellidoPaterno: null,
        apellidoMaterno: null,
      });
    }
    this.clienteForm
      .get('apellidoPaterno')
      ?.updateValueAndValidity({ emitEvent: false });
    this.clienteForm
      .get('apellidoMaterno')
      ?.updateValueAndValidity({ emitEvent: false });

    if (this.clienteForm.invalid) {
      this.submitButton = 'Guardar';
      this.loading = false;

      const etiquetas: any = {
        idPadre: 'Cliente',
        rfc: 'RFC',
        tipoPersona: 'Tipo de Persona',
        estatus: 'Estatus',
        logotipo: 'Logotipo',
        constanciaSituacionFiscal: 'Constancia de Situación Fiscal',
        comprobanteDomicilio: 'Comprobante de Domicilio',
        actaConstitutiva: 'Acta Constitutiva',
        ineRepresentanteLegal: 'INE del Representante Legal',
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
    const v = this.clienteForm.value;
    v.tipoPersona = v.tipoPersona != null ? Number(v.tipoPersona) : null;

    const formData = new FormData();

    if (v.idPadre !== undefined && v.idPadre !== null) {
      formData.append('idPadre', String(v.idPadre));
    }
    if (v.rfc != null) formData.append('rfc', v.rfc);
    if (v.tipoPersona != null)
      formData.append('tipoPersona', String(v.tipoPersona));
    if (v.estatus != null) formData.append('estatus', String(v.estatus));

    if (v.nombre != null) formData.append('nombre', v.nombre);
    if (v.apellidoPaterno != null)
      formData.append('apellidoPaterno', v.apellidoPaterno);
    if (v.apellidoMaterno != null)
      formData.append('apellidoMaterno', v.apellidoMaterno);
    if (v.telefono != null) formData.append('telefono', v.telefono);
    if (v.correo != null) formData.append('correo', v.correo);
    if (v.estado != null) formData.append('estado', v.estado);
    if (v.municipio != null) formData.append('municipio', v.municipio);
    if (v.colonia != null) formData.append('colonia', v.colonia);
    if (v.calle != null) formData.append('calle', v.calle);
    if (v.entreCalles != null) formData.append('entreCalles', v.entreCalles);
    if (v.numeroExterior != null)
      formData.append('numeroExterior', v.numeroExterior);
    if (v.numeroInterior != null)
      formData.append('numeroInterior', v.numeroInterior);
    if (v.cp != null) formData.append('cp', v.cp);
    if (v.nombreEncargado != null)
      formData.append('nombreEncargado', v.nombreEncargado);
    if (v.telefonoEncargado != null)
      formData.append('telefonoEncargado', v.telefonoEncargado);
    if (v.correoEncargado != null)
      formData.append('correoEncargado', v.correoEncargado);
    if (v.sitioWeb != null) formData.append('sitioWeb', v.sitioWeb);

    const logotipo = v.logotipo;
    const csf = v.constanciaSituacionFiscal;
    const comp = v.comprobanteDomicilio;
    const acta = v.actaConstitutiva;
    const ine = v.ineRepresentanteLegal;

    if (logotipo instanceof File) {
      formData.append('logotipo', logotipo, logotipo.name);
    }
    if (csf instanceof File) {
      formData.append('constanciaSituacionFiscal', csf, csf.name);
    }
    if (comp instanceof File) {
      formData.append('comprobanteDomicilio', comp, comp.name);
    }
    if (acta instanceof File) {
      formData.append('actaConstitutiva', acta, acta.name);
    }
    if (ine instanceof File) {
      formData.append('ineRepresentanteLegal', ine, ine.name);
    }

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

    const tipo = Number(this.clienteForm.get('tipoPersona')?.value ?? null);
    if (tipo === 1) {
      this.clienteForm
        .get('apellidoPaterno')
        ?.setValidators([Validators.required]);
      this.clienteForm
        .get('apellidoMaterno')
        ?.setValidators([Validators.required]);
    } else if (tipo === 2) {
      this.clienteForm.get('apellidoPaterno')?.clearValidators();
      this.clienteForm.get('apellidoMaterno')?.clearValidators();
      this.clienteForm.patchValue({
        apellidoPaterno: null,
        apellidoMaterno: null,
      });
    }
    this.clienteForm
      .get('apellidoPaterno')
      ?.updateValueAndValidity({ emitEvent: false });
    this.clienteForm
      .get('apellidoMaterno')
      ?.updateValueAndValidity({ emitEvent: false });

    if (this.clienteForm.invalid) {
      this.submitButton = 'Actualizar';
      this.loading = false;

      const etiquetas: any = {
        idPadre: 'Cliente',
        rfc: 'RFC',
        tipoPersona: 'Tipo de Persona',
        estatus: 'Estatus',
        logotipo: 'Logotipo',
        constanciaSituacionFiscal: 'Constancia de Situación Fiscal',
        comprobanteDomicilio: 'Comprobante de Domicilio',
        actaConstitutiva: 'Acta Constitutiva',
        ineRepresentanteLegal: 'INE del Representante Legal',
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

    const v = this.clienteForm.value;
    v.tipoPersona = v.tipoPersona != null ? Number(v.tipoPersona) : null;

    const formData = new FormData();

    if (v.idPadre !== undefined && v.idPadre !== null) {
      formData.append('idPadre', String(v.idPadre));
    }
    if (v.rfc != null) formData.append('rfc', v.rfc);
    if (v.tipoPersona != null)
      formData.append('tipoPersona', String(v.tipoPersona));
    if (v.estatus != null) formData.append('estatus', String(v.estatus));

    if (v.nombre != null) formData.append('nombre', v.nombre);
    if (v.apellidoPaterno != null)
      formData.append('apellidoPaterno', v.apellidoPaterno);
    if (v.apellidoMaterno != null)
      formData.append('apellidoMaterno', v.apellidoMaterno);
    if (v.telefono != null) formData.append('telefono', v.telefono);
    if (v.correo != null) formData.append('correo', v.correo);
    if (v.estado != null) formData.append('estado', v.estado);
    if (v.municipio != null) formData.append('municipio', v.municipio);
    if (v.colonia != null) formData.append('colonia', v.colonia);
    if (v.calle != null) formData.append('calle', v.calle);
    if (v.entreCalles != null) formData.append('entreCalles', v.entreCalles);
    if (v.numeroExterior != null)
      formData.append('numeroExterior', v.numeroExterior);
    if (v.numeroInterior != null)
      formData.append('numeroInterior', v.numeroInterior);
    if (v.cp != null) formData.append('cp', v.cp);
    if (v.nombreEncargado != null)
      formData.append('nombreEncargado', v.nombreEncargado);
    if (v.telefonoEncargado != null)
      formData.append('telefonoEncargado', v.telefonoEncargado);
    if (v.correoEncargado != null)
      formData.append('correoEncargado', v.correoEncargado);
    if (v.sitioWeb != null) formData.append('sitioWeb', v.sitioWeb);

    const logotipo = v.logotipo;
    const csf = v.constanciaSituacionFiscal;
    const comp = v.comprobanteDomicilio;
    const acta = v.actaConstitutiva;
    const ine = v.ineRepresentanteLegal;

    if (logotipo instanceof File) {
      formData.append('logotipo', logotipo, logotipo.name);
    }
    if (csf instanceof File) {
      formData.append('constanciaSituacionFiscal', csf, csf.name);
    }
    if (comp instanceof File) {
      formData.append('comprobanteDomicilio', comp, comp.name);
    }
    if (acta instanceof File) {
      formData.append('actaConstitutiva', acta, acta.name);
    }
    if (ine instanceof File) {
      formData.append('ineRepresentanteLegal', ine, ine.name);
    }

    this.clieService.actualizarCliente(this.idCliente, formData).subscribe(
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
    actaConstitutiva: '' as string,
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
  @ViewChild('ineFileInput') ineFileInput!: ElementRef<HTMLInputElement>;

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
    if (f) this.handleCsfFile(f);
  }
  onCsfFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] || null;
    if (f) this.handleCsfFile(f);
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
  private handleCsfFile(file: File) {
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
