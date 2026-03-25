import { animate, style, transition, trigger } from '@angular/animations';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { ClientesService } from 'src/app/services/moduleService/clientes.service';
import { ModulosService } from 'src/app/services/moduleService/modulos.service';
import { RolesService } from 'src/app/services/moduleService/roles.service';
import { UsuariosService } from 'src/app/services/moduleService/usuario.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-agregar-usuario',
  templateUrl: './agregar-usuario.component.html',
  styleUrl: './agregar-usuario.component.scss',
  standalone: false,
  animations: [
    routeAnimation,
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('160ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('100ms ease-in', style({ opacity: 0 }))]),
    ]),
  ],
})
export class AgregarUsuarioComponent implements OnInit {
  hideConfirm = true;
  confirmName = 'cpwd_' + Math.random().toString(36).slice(2, 12);

  hidePass = true;
  showPwdHints = false;
  animateHints = false;
  pwdValue = '';

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

  get currentRuleMsg(): string {
    switch (this.currentRuleKey) {
      case 'case':
        return 'Al menos una mayúscula y minúsculas.';
      case 'special':
        return 'Un caracter no alfanumérico (ejemplo: #?!&).';
      case 'number':
        return 'Un número.';
      case 'length':
        return 'La contraseña debe tener más de 6 caracteres y menos de 16.';
      default:
        return '';
    }
  }

  onPwdFocus() {
    this.showPwdHints = true;
    setTimeout(() => (this.animateHints = true), 0);
  }
  onPwdBlur() {
    this.showPwdHints = false;
    this.animateHints = false;
  }

  confirmValue = '';
  confirmHintVisible = false;
  confirmMatch = false;
  private confirmTimer: any;

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

  public permisosSeleccionadosIds: number[] = [];

  public submitButton: string = 'Guardar';
  public loading: boolean = false;
  public usuarioForm: FormGroup;
  public idUsuario: number;
  public inputContrasena: boolean = true;
  public title = 'Agregar Usuario';
  public listaModulos: any[] = [];
  public listaRoles: any;
  public listaClientes: any;

  public showInputsId = true;
  type = 'password';
  typeConfirm: string = 'password';

  constructor(
    private fb: FormBuilder,
    private usuaService: UsuariosService,
    private route: Router,
    private activatedRouted: ActivatedRoute,
    private moduService: ModulosService,
    private rolService: RolesService,
    private clienService: ClientesService
  ) {}

  ngOnInit(): void {
  this.obtenerClientes();
  this.obtenerRoles();
  this.obtenerModulos();
  this.initForm();

  this.activatedRouted.params.subscribe((params) => {
    this.idUsuario = params['idUsuario'];
    if (this.idUsuario) {
      this.title = 'Actualizar Usuario';
      this.obtenerUsuarioID();
      this.showInputsId = false;
      this.inputContrasena = false; // <- clave para que NO sea requerida al actualizar
    }
  });
}


  passwordsMatchValidator(formGroup: FormGroup) {
    const password = formGroup.get('passwordHash')?.value;
    const confirmPassword = formGroup.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  toggleConfirmPassword() {
    this.typeConfirm = this.typeConfirm === 'password' ? 'text' : 'password';
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
        idCliente: [null, [Validators.required]],
        permisosIds: this.fb.control<number[]>([]),
      },
      { validators: this.passwordsMatchValidator }
    );
  }

  obtenerModulos() {
    this.moduService.obtenerModulos().subscribe((response: any) => {
      let raw: any = [];

      if (Array.isArray(response?.data)) {
        raw = response.data;
      } else if (Array.isArray(response)) {
        raw = response;
      } else if (Array.isArray(response) && Array.isArray(response[0])) {
        raw = response[0];
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

      this.applyAssignedPermsToModules();
      this.syncPermisosSeleccionados();
    });
  }

  private syncPermisosSeleccionados(): void {
    const ids: number[] = [];
    this.listaModulos.forEach((m) => {
      (m.permisos || []).forEach((p: any) => {
        if (p.asignado && !ids.includes(p.id)) {
          ids.push(p.id);
        }
      });
    });
    this.permisosSeleccionadosIds = ids;
    this.usuarioForm.patchValue({ permisosIds: this.permisosSeleccionadosIds });
  }

  onPermChange(modulo: any, permiso: any, event: Event): void {
    const input = event.target as HTMLInputElement;
    const checked = input.checked;

    permiso.asignado = checked;
    const id = Number(permiso.id);

    if (checked) {
      if (!this.permisosSeleccionadosIds.includes(id)) {
        this.permisosSeleccionadosIds = [...this.permisosSeleccionadosIds, id];
      }
    } else {
      this.permisosSeleccionadosIds = this.permisosSeleccionadosIds.filter(
        (x) => x !== id
      );
    }

    this.usuarioForm.patchValue({ permisosIds: this.permisosSeleccionadosIds });
  }

  onModuleToggle(modulo: any, event: Event): void {
    const input = event.target as HTMLInputElement;
    const checked = input.checked;
    const permisos = modulo.permisos || [];

    permisos.forEach((permiso: any) => {
      permiso.asignado = checked;
      const id = Number(permiso.id);

      if (checked) {
        if (!this.permisosSeleccionadosIds.includes(id)) {
          this.permisosSeleccionadosIds = [
            ...this.permisosSeleccionadosIds,
            id,
          ];
        }
      } else {
        this.permisosSeleccionadosIds = this.permisosSeleccionadosIds.filter(
          (x) => x !== id
        );
      }
    });

    this.usuarioForm.patchValue({ permisosIds: this.permisosSeleccionadosIds });
  }

  isModuleFullyAssigned(modulo: any): boolean {
    if (
      !modulo ||
      !Array.isArray(modulo.permisos) ||
      modulo.permisos.length === 0
    ) {
      return false;
    }
    return modulo.permisos.every((p: any) => !!p.asignado);
  }

  obtenerRoles() {
    this.rolService.obtenerRoles().subscribe((response) => {
      this.listaRoles = (response as any)?.data ?? response;
    });
  }

  obtenerClientes() {
    this.clienService.obtenerClientes().subscribe((response) => {
      this.listaClientes = (response.data || []).map((c: any) => ({
        ...c,
        id: Number(c.id),
      }));
    });
  }

  private getPermisoId(p: any): number | null {
    const val = p?.idPermiso ?? p?.IdPermiso ?? p?.id ?? p?.Id ?? null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }

  trackModulo = (_: number, m: any) => m.id ?? m.Id;
  trackPermiso = (_: number, p: any) => p.id ?? p.Id;

  obtenerUsuarioID() {
    this.usuaService
      .obtenerUsuario(this.idUsuario)
      .subscribe((response: any) => {
        const data = response?.data ?? {};

        const usuarios = Array.isArray(data?.usuario)
          ? data.usuario
          : Array.isArray(data?.usuarios)
          ? data.usuarios
          : data?.usuario
          ? [data.usuario]
          : [];

        const u = usuarios[0] ?? {};

        const perms = Array.isArray(data?.permiso)
  ? data.permiso
  : Array.isArray(data?.permisos)
  ? data.permisos
  : [];

const permisosAsignadosIds: number[] = Array.from(
  new Set<number>(
    (perms || [])
      .filter((p: any) => Number(p?.estatus) === 1)
      .map((p: any) => this.getPermisoId(p))
      .filter((n: any): n is number => typeof n === 'number' && Number.isFinite(n))
  )
);


        this.permisosSeleccionadosIds = permisosAsignadosIds;
        this.usuarioForm.patchValue({ permisosIds: permisosAsignadosIds });
        this.applyAssignedPermsToModules();

        this.usuarioForm.patchValue({
          userName: u?.userName ?? '',
          telefono: u?.telefono ?? '',
          nombre: u?.nombre ?? '',
          apellidoPaterno: u?.apellidoPaterno ?? '',
          apellidoMaterno: u?.apellidoMaterno ?? '',
          fotoPerfil:
            u?.fotoPerfil ?? this.usuarioForm.get('fotoPerfil')?.value,
          emailConfirmado: Number(u?.emailConfirmado ?? 0),
          estatus: Number(u?.estatus ?? 1),
          idRol: u?.idRol != null ? Number(u.idRol) : null,
          idCliente: u?.idCliente != null ? Number(u.idCliente) : null,
        });
      });
  }

  private applyAssignedPermsToModules(): void {
    if (!Array.isArray(this.listaModulos)) return;
    const asignados = new Set((this.permisosSeleccionadosIds || []).map(Number));
    this.listaModulos = this.listaModulos.map((m) => ({
      ...m,
      permisos: (m.permisos || []).map((p: any) => {
        const idNum = Number(p?.id ?? p?.Id);
        const activo = asignados.has(idNum);
        return {
          ...p,
          id: idNum,
          estatus: activo ? 1 : 0,
          asignado: activo,
        };
      }),
    }));
  }

  allowOnlyNumbers(event: KeyboardEvent): void {
    const charCode = event.keyCode ? event.keyCode : event.which;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
    }
  }

  myFunctionPasswordCurrent() {
    this.type = this.type === 'password' ? 'text' : 'password';
  }

  submit() {
    if (this.idUsuario) {
      this.actualizar();
    } else {
      this.agregar();
    }
  }

  @ViewChild('logoFileInput') logoFileInput!: ElementRef<HTMLInputElement>;
  logoPreviewUrl: string | ArrayBuffer | null = null;
  logoDragging = false;
  private logoFile: File | null = null;
  logoFileName = '';

  private readonly MAX_MB = 3;

  private isImage(file: File) {
    return /^image\/(png|jpe?g|webp)$/i.test(file.type);
  }
  private isAllowed(file: File) {
    const okImg = this.isImage(file);
    return okImg && file.size <= this.MAX_MB * 1024 * 1024;
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
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.handleLogoFile(f);
  }

  clearLogoImage(e: Event) {
    e.stopPropagation();
    this.logoPreviewUrl = null;
    this.logoFileInput.nativeElement.value = '';
    this.logoFile = null;
    this.logoFileName = '';
    this.usuarioForm.patchValue({ fotoPerfil: null });
  }

  private handleLogoFile(file: File) {
    if (!this.isAllowed(file)) {
      this.usuarioForm.get('fotoPerfil')?.setErrors({ invalid: true });
      return;
    }

    this.logoFileName = file.name;
    this.logoFile = file;
    this.loadPreview(file, (url) => (this.logoPreviewUrl = url));
    this.usuarioForm.get('fotoPerfil')?.setErrors(null);
  }

  private buildFormDataParaAgregar(): FormData {
    const v = this.usuarioForm.value;
    const formData = new FormData();

    formData.append('userName', v.userName);
    formData.append('passwordHash', v.passwordHash);
    formData.append(
      'emailConfirmado',
      String(v.emailConfirmado ?? 0)
    );
    formData.append('nombre', v.nombre);
    formData.append('apellidoPaterno', v.apellidoPaterno);
    formData.append('apellidoMaterno', v.apellidoMaterno || '');
    formData.append('telefono', v.telefono || '');
    formData.append('estatus', String(v.estatus ?? 1));
    formData.append('idRol', String(v.idRol));
    formData.append('idCliente', String(v.idCliente));

    this.permisosSeleccionadosIds.forEach((id) =>
      formData.append('permisosIds', id.toString())
    );

    if (this.logoFile) {
      formData.append('fotoPerfil', this.logoFile, this.logoFile.name);
    } else if (v.fotoPerfil) {
      formData.append('fotoPerfil', v.fotoPerfil);
    }

    return formData;
  }

  private buildFormDataParaActualizar(): FormData {
    const v = this.usuarioForm.value;
    const formData = new FormData();

    formData.append(
      'emailConfirmado',
      String(v.emailConfirmado ?? 0)
    );
    formData.append('nombre', v.nombre);
    formData.append('apellidoPaterno', v.apellidoPaterno);
    formData.append('apellidoMaterno', v.apellidoMaterno || '');
    formData.append('telefono', v.telefono || '');
    formData.append('estatus', String(v.estatus ?? 1));
    formData.append('idRol', String(v.idRol));
    formData.append('idCliente', String(v.idCliente));

    this.permisosSeleccionadosIds.forEach((id) =>
      formData.append('permisosIds', id.toString())
    );

    if (this.logoFile) {
      formData.append('fotoPerfil', this.logoFile, this.logoFile.name);
    } else if (v.fotoPerfil) {
      formData.append('fotoPerfil', v.fotoPerfil);
    }

    if (this.inputContrasena && v.passwordHash) {
      formData.append('passwordHash', v.passwordHash);
    }

    return formData;
  }

  agregar() {
    if (this.loading) return;

    this.submitButton = 'Cargando...';
    this.loading = true;

    this.usuarioForm.markAllAsTouched();
    this.usuarioForm.patchValue({
      permisosIds: this.permisosSeleccionadosIds,
    });

    const etiquetas: Record<string, string> = {
      userName: 'Correo electrónico',
      passwordHash: 'Contraseña',
      confirmPassword: 'Confirmar contraseña',
      telefono: 'Teléfono',
      nombre: 'Nombre',
      apellidoPaterno: 'Apellido Paterno',
      apellidoMaterno: 'Apellido Materno',
      fotoPerfil: 'Foto de perfil',
      idRol: 'Rol',
      estatus: 'Estatus',
      idCliente: 'Cliente',
      permisosIds: 'Permisos',
    };

    if (this.usuarioForm.invalid || this.permisosSeleccionadosIds.length === 0) {
      const camposFaltantes: string[] = [];

      Object.keys(this.usuarioForm.controls).forEach((key) => {
        const control = this.usuarioForm.get(key);
        if (control?.errors?.['required']) {
          camposFaltantes.push(etiquetas[key] || key);
        }
      });

      if (this.permisosSeleccionadosIds.length === 0) {
        camposFaltantes.push('Permisos');
      }

      if (this.usuarioForm.hasError('passwordMismatch')) {
        camposFaltantes.push('Las contraseñas no coinciden');
      }

      const lista = camposFaltantes
        .map(
          (campo, index) => `
        <div style="padding:8px 12px;border-left:4px solid #d9534f;
                    background:#caa8a8;text-align:center;margin-bottom:8px;border-radius:4px;">
          <strong style="color:#b02a37;">${index + 1}. ${campo}</strong>
        </div>`
        )
        .join('');

      this.submitButton = 'Guardar';
      this.loading = false;

      Swal.fire({
        color: '#ffffff',
          background: '#141a21',
        title: '¡Faltan campos obligatorios!',
        html: `
        <p style="text-align:center;font-size:15px;margin-bottom:16px;color:white">
          Los siguientes <strong>campos</strong> requieren atención:
        </p>
        <div style="max-height:350px;overflow-y:auto;">${lista}</div>
      `,
        icon: 'error',
        confirmButtonText: 'Entendido',
        customClass: { popup: 'swal2-padding swal2-border' },
      });
      return;
    }

    const formData = this.buildFormDataParaAgregar();

    this.usuaService.agregarUsuario(formData).subscribe({
      next: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          title: '¡Operación Exitosa!',
          text: `Se agregó un nuevo usuario de manera exitosa.`,
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
        });
        this.regresar();
      },
      error: () => {
        this.submitButton = 'Guardar';
        this.loading = false;
        Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          title: '¡Ops!',
          text: `Ocurrió un error al agregar el usuario.`,
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
        });
      },
    });
  }

  actualizar() {
    if (this.loading) return;

    this.submitButton = 'Cargando...';
    this.loading = true;

    if (!this.inputContrasena) {
      const passCtrl = this.usuarioForm.get('passwordHash');
      const confirmCtrl = this.usuarioForm.get('confirmPassword');
      passCtrl?.clearValidators();
      passCtrl?.updateValueAndValidity({ emitEvent: false });
      confirmCtrl?.clearValidators();
      confirmCtrl?.updateValueAndValidity({ emitEvent: false });
    }

    this.usuarioForm.markAllAsTouched();
    this.usuarioForm.patchValue({
      permisosIds: this.permisosSeleccionadosIds,
    });

    const etiquetas: Record<string, string> = {
      userName: 'Correo electrónico',
      passwordHash: 'Contraseña',
      confirmPassword: 'Confirmar contraseña',
      telefono: 'Teléfono',
      nombre: 'Nombre',
      apellidoPaterno: 'Apellido Paterno',
      apellidoMaterno: 'Apellido Materno',
      idRol: 'Rol',
      estatus: 'Estatus',
      idCliente: 'Cliente',
      permisosIds: 'Permisos',
    };

    const camposFaltantes: string[] = [];
    Object.keys(this.usuarioForm.controls).forEach((key) => {
      if (
        !this.inputContrasena &&
        (key === 'passwordHash' || key === 'confirmPassword')
      ) {
        return;
      }
      const control = this.usuarioForm.get(key);
      if (control?.errors?.['required']) {
        camposFaltantes.push(etiquetas[key] || key);
      }
    });

    if (this.permisosSeleccionadosIds.length === 0) {
      camposFaltantes.push('Permisos');
    }

    if (this.inputContrasena && this.usuarioForm.hasError('passwordMismatch')) {
      camposFaltantes.push('Las contraseñas no coinciden');
    }

    if (this.usuarioForm.invalid || camposFaltantes.length > 0) {
      this.submitButton = 'Actualizar';
      this.loading = false;
      Swal.fire({
        color: '#ffffff',
          background: '#141a21',
        title: '¡Faltan campos obligatorios!',
        html: `
        <p style="text-align: center; font-size: 15px; margin-bottom: 16px; color: white">
          Los siguientes <strong>campos</strong> requieren atención:
        </p>
        <div style="max-height: 350px; overflow-y: auto;">
          ${camposFaltantes
            .map(
              (msg, idx) => `
            <div style="padding:8px 12px;border-left:4px solid #d9534f;background:#caa8a8;text-align:center;margin-bottom:8px;border-radius:4px;">
              <strong style="color:#b02a37;">${idx + 1}. ${msg}</strong>
            </div>`
            )
            .join('')}
        </div>`,
        icon: 'error',
        confirmButtonText: 'Entendido',
        customClass: { popup: 'swal2-padding swal2-border' },
      });
      return;
    }

    const formData = this.buildFormDataParaActualizar();

    this.usuaService.actualizarUsuario(this.idUsuario, formData).subscribe({
      next: () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          title: '¡Operación Exitosa!',
          text: `Los datos del usuario se actualizaron correctamente.`,
          icon: 'success',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
        });
        this.regresar();
      },
      error: () => {
        this.submitButton = 'Actualizar';
        this.loading = false;
        Swal.fire({
          color: '#ffffff',
          background: '#141a21',
          title: '¡Ops!',
          text: `Ocurrió un error al actualizar el usuario.`,
          icon: 'error',
          confirmButtonColor: '#3085d6',
          confirmButtonText: 'Confirmar',
        });
      },
    });
  }

  regresar() {
    this.route.navigateByUrl('/usuarios');
  }
}
