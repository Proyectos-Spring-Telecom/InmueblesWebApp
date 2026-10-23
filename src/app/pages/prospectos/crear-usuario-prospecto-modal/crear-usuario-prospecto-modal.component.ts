import { animate, style, transition, trigger } from '@angular/animations';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModulosService } from 'src/app/services/moduleService/modulos.service';
import { RolesService } from 'src/app/services/moduleService/roles.service';
import { UsuariosService } from 'src/app/services/moduleService/usuario.service';

export interface ProspectoCreadoDatos {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  correo?: string;
  telefono?: string;
  nombreCompleto?: string;
}

/**
 * Paso obligatorio tras crear un prospecto: dar de alta su usuario.
 * No tiene botón de cierre, ni cierre por backdrop/Escape: solo se
 * completa (y se cierra) cuando el usuario se crea correctamente.
 */
@Component({
  selector: 'app-crear-usuario-prospecto-modal',
  templateUrl: './crear-usuario-prospecto-modal.component.html',
  styleUrl: './crear-usuario-prospecto-modal.component.scss',
  standalone: false,
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('160ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('100ms ease-in', style({ opacity: 0 }))]),
    ]),
  ],
})
export class CrearUsuarioProspectoModalComponent implements OnInit {
  @Input() idCliente: number | null = null;
  @Input() prospecto: ProspectoCreadoDatos = {};
  @Output() usuarioCreado = new EventEmitter<void>();

  usuarioForm: FormGroup;
  listaRoles: any[] = [];
  listaModulos: any[] = [];
  listaClienteVinculado: any[] = [];
  permisosSeleccionadosIds: number[] = [];

  submitButton = 'Crear usuario';
  loading = false;
  errorEnvio = '';
  camposInvalidos: string[] = [];

  hidePass = true;
  hideConfirm = true;
  confirmName = 'cpwd_' + Math.random().toString(36).slice(2, 12);
  showPwdHints = false;
  animateHints = false;
  pwdValue = '';
  confirmValue = '';
  confirmHintVisible = false;
  confirmMatch = false;
  private confirmTimer: any;

  logoPreviewUrl: string | ArrayBuffer | null = null;
  logoDragging = false;
  logoFileName = '';
  private logoFile: File | null = null;
  private readonly MAX_MB = 3;

  constructor(
    private fb: FormBuilder,
    private usuaService: UsuariosService,
    private rolService: RolesService,
    private moduService: ModulosService,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.obtenerRoles();
    this.obtenerModulos();

    const nombreProspecto =
      this.prospecto?.nombreCompleto ||
      [this.prospecto?.nombre, this.prospecto?.apellidoPaterno, this.prospecto?.apellidoMaterno]
        .filter((x) => x != null && String(x).trim() !== '')
        .join(' ') ||
      (this.idCliente ? `Prospecto #${this.idCliente}` : 'Prospecto');

    this.listaClienteVinculado = [{ id: this.idCliente, etiqueta: nombreProspecto }];

    this.usuarioForm.patchValue({
      idCliente: this.idCliente,
      nombre: this.prospecto?.nombre ?? '',
      apellidoPaterno: this.prospecto?.apellidoPaterno ?? '',
      apellidoMaterno: this.prospecto?.apellidoMaterno ?? '',
      userName: this.prospecto?.correo ?? '',
      telefono: this.prospecto?.telefono ?? '',
    });
  }

  // ── Contraseña (misma UX que Agregar Usuario) ──────────────────
  private get hasMayus(): boolean {
    return /[A-Z]/.test(this.pwdValue);
  }
  private get hasMinus(): boolean {
    return /[a-z]/.test(this.pwdValue);
  }
  private get espCaracter(): boolean {
    return /[^A-Za-z0-9]/.test(this.pwdValue);
  }
  private get hasNumber(): boolean {
    return /\d/.test(this.pwdValue);
  }
  private get minCaracteres(): boolean {
    return this.pwdValue.length > 6;
  }
  private get maxCaracteres(): boolean {
    return this.pwdValue.length < 16;
  }

  get currentRuleKey(): 'case' | 'special' | 'number' | 'length' | 'ok' {
    if (!(this.hasMayus && this.hasMinus)) return 'case';
    if (!this.espCaracter) return 'special';
    if (!this.hasNumber) return 'number';
    if (!(this.minCaracteres && this.maxCaracteres)) return 'length';
    return 'ok';
  }

  onPwdFocus() {
    this.showPwdHints = true;
    setTimeout(() => (this.animateHints = true), 0);
  }
  onPwdBlur() {
    this.showPwdHints = false;
    this.animateHints = false;
  }
  onPwdInput(e: Event) {
    this.pwdValue = (e.target as HTMLInputElement).value || '';
    this.syncConfirmState();
  }
  onConfirmInput(e: Event) {
    this.confirmValue = (e.target as HTMLInputElement).value || '';
    clearTimeout(this.confirmTimer);
    this.confirmTimer = setTimeout(() => {
      this.validateConfirm();
      this.confirmHintVisible = this.confirmValue.length > 0;
    }, 400);
  }
  onConfirmBlur() {
    clearTimeout(this.confirmTimer);
    this.validateConfirm();
    this.confirmHintVisible = this.confirmValue.length > 0;
  }
  private validateConfirm() {
    this.confirmMatch = this.confirmValue === this.pwdValue;
  }
  private syncConfirmState() {
    if (this.confirmHintVisible) this.validateConfirm();
  }

  passwordsMatchValidator(formGroup: FormGroup) {
    const password = formGroup.get('passwordHash')?.value;
    const confirmPassword = formGroup.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  initForm() {
    this.usuarioForm = this.fb.group(
      {
        userName: ['', [Validators.required, Validators.email]],
        passwordHash: ['', [Validators.required]],
        confirmPassword: [''],
        telefono: ['', [Validators.required]],
        nombre: ['', [Validators.required]],
        apellidoPaterno: ['', [Validators.required]],
        apellidoMaterno: [''],
        fotoPerfil: [null],
        idRol: [null, [Validators.required]],
        emailConfirmado: [0, [Validators.required]],
        estatus: [1, [Validators.required]],
        idCliente: [null],
        permisosIds: this.fb.control<number[]>([]),
      },
      { validators: this.passwordsMatchValidator },
    );
  }

  // ── Catálogos ──────────────────────────────────────────────────
  obtenerRoles() {
    this.rolService.obtenerRoles().subscribe((response) => {
      this.listaRoles = (response as any)?.data ?? response;
    });
  }

  obtenerModulos() {
    this.moduService.obtenerModulos().subscribe((response: any) => {
      let raw: any = [];
      if (Array.isArray(response?.data)) {
        raw = response.data;
      } else if (Array.isArray(response)) {
        raw = response;
      }
      this.listaModulos = raw.map((m: any) => ({
        id: Number(m?.Id ?? m?.id),
        nombre: m?.NombreModulo ?? m?.nombre ?? m?.Nombre ?? '',
        descripcion: m?.Descripcion ?? m?.descripcion ?? '',
        estatus: m?.Estatus ?? m?.estatus,
        permisos: (m?.Permisos ?? m?.permisos ?? []).map((p: any) => ({
          id: p?.Id ?? p?.id,
          nombre: p?.Nombre ?? p?.nombre ?? '',
          descripcion: p?.Descripcion ?? p?.descripcion ?? '',
          estatus: p?.Estatus ?? p?.estatus,
          asignado: p?.asignado ?? false,
        })),
      }));
      this.syncPermisosSeleccionados();
    });
  }

  // ── Permisos (misma lógica que Agregar Usuario) ────────────────
  private syncPermisosSeleccionados(): void {
    const ids: number[] = [];
    this.listaModulos.forEach((m) => {
      (m.permisos || []).forEach((p: any) => {
        if (p.asignado && !ids.includes(p.id)) ids.push(p.id);
      });
    });
    this.permisosSeleccionadosIds = ids;
    this.usuarioForm?.patchValue({ permisosIds: this.permisosSeleccionadosIds });
  }

  onPermChange(modulo: any, permiso: any, event: Event): void {
    const input = event.target as HTMLInputElement;
    permiso.asignado = input.checked;
    this.sincronizarPermisoId(permiso, input.checked);
    this.usuarioForm.patchValue({ permisosIds: this.permisosSeleccionadosIds });
  }

  togglePermiso(_modulo: any, permiso: any): void {
    permiso.asignado = !permiso.asignado;
    this.sincronizarPermisoId(permiso, permiso.asignado);
    this.usuarioForm.patchValue({ permisosIds: this.permisosSeleccionadosIds });
  }

  private sincronizarPermisoId(permiso: any, checked: boolean): void {
    const id = Number(permiso.id);
    if (checked) {
      if (!this.permisosSeleccionadosIds.includes(id)) {
        this.permisosSeleccionadosIds = [...this.permisosSeleccionadosIds, id];
      }
    } else {
      this.permisosSeleccionadosIds = this.permisosSeleccionadosIds.filter((x) => x !== id);
    }
  }

  onModuleToggle(modulo: any, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    (modulo.permisos || []).forEach((permiso: any) => {
      permiso.asignado = checked;
      this.sincronizarPermisoId(permiso, checked);
    });
    this.usuarioForm.patchValue({ permisosIds: this.permisosSeleccionadosIds });
  }

  isModuleFullyAssigned(modulo: any): boolean {
    if (!modulo || !Array.isArray(modulo.permisos) || modulo.permisos.length === 0) return false;
    return modulo.permisos.every((p: any) => !!p.asignado);
  }

  trackByModuloId(index: number, modulo: any): number | string {
    return modulo?.id ?? index;
  }
  trackByPermisoId(index: number, permiso: any): number | string {
    return permiso?.id ?? index;
  }
  trackModulo = (_: number, m: any) => m.id ?? m.Id;
  trackPermiso = (_: number, p: any) => p.id ?? p.Id;

  allowOnlyNumbers(event: KeyboardEvent): void {
    const charCode = event.keyCode ? event.keyCode : event.which;
    if (charCode < 48 || charCode > 57) event.preventDefault();
  }

  // ── Foto de perfil ─────────────────────────────────────────────
  private isImage(file: File) {
    return /^image\/(png|jpe?g|webp)$/i.test(file.type);
  }
  private isAllowed(file: File) {
    return this.isImage(file) && file.size <= this.MAX_MB * 1024 * 1024;
  }
  private loadPreview(file: File, setter: (url: string | ArrayBuffer | null) => void) {
    if (!this.isImage(file)) {
      setter(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setter(reader.result);
    reader.readAsDataURL(file);
  }

  openLogoFilePicker(input: HTMLInputElement) {
    input.click();
  }
  onLogoDragOver(e: DragEvent) {
    e.preventDefault();
    this.logoDragging = true;
  }
  onLogoDragLeave(_e: DragEvent) {
    this.logoDragging = false;
  }
  onLogoDrop(e: DragEvent) {
    e.preventDefault();
    this.logoDragging = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) this.handleLogoFile(f);
  }
  onLogoFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) this.handleLogoFile(f);
    if (input) input.value = '';
  }
  clearLogoImage(e: Event) {
    e.stopPropagation();
    this.logoPreviewUrl = null;
    this.logoFile = null;
    this.logoFileName = '';
    this.usuarioForm.patchValue({ fotoPerfil: null });
    this.usuarioForm.get('fotoPerfil')?.setErrors(null);
  }
  etiquetaLogoUploader(): string {
    if (this.logoFileName) return this.logoFileName;
    return 'PNG · JPG · WEBP · Máx. 3 MB';
  }
  private handleLogoFile(file: File) {
    if (!this.isAllowed(file)) {
      this.usuarioForm.get('fotoPerfil')?.setErrors({ invalid: true });
      this.errorEnvio = 'La foto de perfil solo acepta PNG, JPG o WEBP de máximo 3 MB.';
      return;
    }
    this.errorEnvio = '';
    this.logoFileName = file.name;
    this.logoFile = file;
    this.loadPreview(file, (url) => (this.logoPreviewUrl = url));
    this.usuarioForm.patchValue({ fotoPerfil: file });
    this.usuarioForm.get('fotoPerfil')?.setErrors(null);
  }

  // ── Envío ──────────────────────────────────────────────────────
  private recolectarCamposInvalidos(): string[] {
    const etiquetas: Record<string, string> = {
      userName: 'Correo electrónico',
      passwordHash: 'Contraseña',
      confirmPassword: 'Confirmar contraseña',
      telefono: 'Teléfono',
      nombre: 'Nombre',
      apellidoPaterno: 'Apellido Paterno',
      idRol: 'Rol',
    };
    const faltantes: string[] = [];
    Object.keys(etiquetas).forEach((key) => {
      const control = this.usuarioForm.get(key);
      if (!control?.invalid || !control.errors) return;
      if (control.errors['required']) faltantes.push(etiquetas[key]);
      else if (control.errors['email']) faltantes.push(`${etiquetas[key]} (correo inválido)`);
    });
    if (this.usuarioForm.get('fotoPerfil')?.errors?.['invalid']) {
      faltantes.push('Foto de perfil (formato o tamaño no permitido)');
    }
    if (this.permisosSeleccionadosIds.length === 0) faltantes.push('Permisos (selecciona al menos uno)');
    if (this.usuarioForm.hasError('passwordMismatch')) faltantes.push('Las contraseñas no coinciden');
    return faltantes;
  }

  private buildFormData(): FormData {
    const v = this.usuarioForm.value;
    const formData = new FormData();
    formData.append('userName', v.userName);
    formData.append('passwordHash', v.passwordHash);
    formData.append('emailConfirmado', String(v.emailConfirmado ?? 0));
    formData.append('nombre', v.nombre);
    formData.append('apellidoPaterno', v.apellidoPaterno);
    formData.append('apellidoMaterno', v.apellidoMaterno || '');
    formData.append('telefono', v.telefono || '');
    formData.append('estatus', String(v.estatus ?? 1));
    formData.append('idRol', String(v.idRol));
    // El cliente es el prospecto recién creado: va automático y no se captura.
    if (this.idCliente != null && Number(this.idCliente) > 0) {
      formData.append('idCliente', String(this.idCliente));
    }
    this.permisosSeleccionadosIds.forEach((id) => formData.append('permisosIds', id.toString()));
    if (this.logoFile) {
      formData.append('fotoPerfil', this.logoFile, this.logoFile.name);
    } else if (v.fotoPerfil) {
      formData.append('fotoPerfil', v.fotoPerfil);
    }
    return formData;
  }

  crearUsuario() {
    if (this.loading) return;
    this.errorEnvio = '';
    this.usuarioForm.markAllAsTouched();
    this.usuarioForm.patchValue({ permisosIds: this.permisosSeleccionadosIds });

    this.camposInvalidos = this.recolectarCamposInvalidos();
    if (this.usuarioForm.invalid || this.camposInvalidos.length > 0) {
      return;
    }

    this.submitButton = 'Creando usuario...';
    this.loading = true;

    this.usuaService.agregarUsuario(this.buildFormData()).subscribe({
      next: () => {
        this.submitButton = 'Crear usuario';
        this.loading = false;
        this.usuarioCreado.emit();
      },
      error: (err: any) => {
        this.submitButton = 'Crear usuario';
        this.loading = false;
        this.errorEnvio =
          err?.error?.message ||
          'No fue posible crear el usuario. Revisa los datos e inténtalo de nuevo; este paso es obligatorio para concluir el alta del prospecto.';
      },
    });
  }
}
