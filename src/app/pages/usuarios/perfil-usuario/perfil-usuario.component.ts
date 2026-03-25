import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { routeAnimation } from 'src/app/pipe/module-open.animation';
import { AuthenticationService } from 'src/app/services/auth.service';
import { UsuariosService } from 'src/app/services/moduleService/usuario.service';
import { ToastrService } from 'ngx-toastr';

type UserFromGetUser = {
  id?: string | number;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  telefono?: string;
  ultimoLogin?: string;
  fechaCreacion?: string;
  fotoPerfil?: string | null;
  userName?: string;
  rolNombre?: string;
  nombreCliente?: string;
  apellidoPaternoCliente?: string;
  apellidoMaternoCliente?: string;
  telefonoCliente?: any;
  emailCliente?: any;
  activo?: boolean;
};

@Component({
  selector: 'app-perfil-usuario',
  templateUrl: './perfil-usuario.component.html',
  styleUrls: ['./perfil-usuario.component.scss'],
  standalone: false,
  animations: [routeAnimation],
})
export class PerfilUsuarioComponent {
  readonly DEFAULT_AVATAR = 'https://analitica-video.s3.us-east-1.amazonaws.com/Usuarios/user.png';
  readonly SIN_REGISTRO = 'Sin registro';

  user: UserFromGetUser | null = null;

  public showNombre: any;
  public showApellidoPaterno: any;
  public showApellidoMaterno: any;
  public showImage: string;
  public showRol: any;

  constructor(
    private users: AuthenticationService,
    private router: Router,
    private usuariosService: UsuariosService,
    private toastr: ToastrService
  ) {
    const user = this.users.getUser() as UserFromGetUser | null;

    this.user = user;

    this.showNombre = user?.nombre ?? '';
    this.showApellidoPaterno = user?.apellidoPaterno ?? '';
    this.showApellidoMaterno = user?.apellidoMaterno ?? '';
    this.showRol = user?.rolNombre ?? '';

    this.showImage = this.hasValidFoto(user?.fotoPerfil)
      ? (user!.fotoPerfil as string)
      : this.DEFAULT_AVATAR;
  }

  private hasValidFoto(v: any): boolean {
    if (v == null || v === 'null') return false;
    const s = String(v).trim();
    return s.length > 0;
  }

  valueOrSinRegistro(v: any): string {
    if (v == null || v === 'null' || v === undefined) return this.SIN_REGISTRO;
    const s = String(v).trim();
    return s.length > 0 ? s : this.SIN_REGISTRO;
  }

  get showNombreCompleto(): string {
    const parts = [this.showNombre, this.showApellidoPaterno, this.showApellidoMaterno]
      .map((x) => (x != null && x !== 'null' ? String(x).trim() : ''))
      .filter((x) => x.length > 0);
    return parts.length > 0 ? parts.join(' ') : this.SIN_REGISTRO;
  }

  get nombreClienteDisplay(): string {
    const u = this.user;
    if (!u) return this.SIN_REGISTRO;
    const parts = [
      u.nombreCliente,
      u.apellidoPaternoCliente,
      u.apellidoMaternoCliente,
    ]
      .map((x) => (x != null && x !== 'null' ? String(x).trim() : ''))
      .filter((x) => x.length > 0);
    return parts.length > 0 ? parts.join(' ') : this.SIN_REGISTRO;
  }

  onAvatarError(): void {
    if (this.showImage !== this.DEFAULT_AVATAR) {
      this.showImage = this.DEFAULT_AVATAR;
    }
  }

  onCerrarSesion() {
    this.router.navigate(['/login']);
  }

  formatUltimoLogin(value?: string): string {
    if (!value || String(value).trim() === '' || value === 'null') return this.SIN_REGISTRO;
    try {
      return new Intl.DateTimeFormat('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date(value));
    } catch {
      return this.SIN_REGISTRO;
    }
  }

  passwordActual = '';
  passwordNueva = '';
  passwordConfirmar = '';
  showPasswordModal = false;
  loadingPassword = false;

  hidePasswordActual = true;
  hidePasswordNueva = true;
  hidePasswordConfirmar = true;

  isPasswordStrong = false;
  missingRules: string[] = [];

  confirmTouched = false;
  confirmFocused = false;
  isConfirmMatch = false;

  get showConfirmHint(): boolean {
    return this.confirmTouched && !this.confirmFocused && (this.passwordConfirmar?.length ?? 0) > 0;
  }

  onCambiarPassword() {
    this.showPasswordModal = true;
  }

  confirmChangePassword() {
    const actual = (this.passwordActual ?? '').trim();
    const nueva = (this.passwordNueva ?? '').trim();
    const confirmar = (this.passwordConfirmar ?? '').trim();

    if (!actual) {
      this.toastr.warning('Ingresa tu contraseña actual.', 'Requerido');
      return;
    }
    if (!this.isPasswordStrong) {
      this.toastr.warning('La nueva contraseña debe cumplir todos los requisitos.', 'Requerido');
      return;
    }
    if (confirmar !== nueva) {
      this.toastr.warning('Las contraseñas no coinciden.', 'Requerido');
      return;
    }

    const id = this.user?.id;
    if (id == null || id === '') {
      this.toastr.error('No se pudo identificar al usuario.', '¡Ops!');
      return;
    }

    this.loadingPassword = true;
    this.usuariosService
      .actualizarContrasena(Number(id), {
        passwordActual: actual,
        passwordNueva: nueva,
        passwordNuevaConfirmacion: confirmar,
      })
      .subscribe({
        next: () => {
          this.loadingPassword = false;
          this.resetPasswordFormAndClose();
          this.toastr.success('Contraseña actualizada correctamente.', 'Listo');
        },
        error: (err) => {
          this.loadingPassword = false;
          const msg =
            err?.error?.message ??
            err?.error?.error ??
            err?.message ??
            'Error al actualizar la contraseña.';
          this.toastr.error(msg, '¡Ops!');
        },
      });
  }

  onCancelPasswordChange() {
    this.resetPasswordFormAndClose();
  }

  private resetPasswordFormAndClose(): void {
    this.showPasswordModal = false;
    setTimeout(() => {
      this.passwordActual = '';
      this.passwordNueva = '';
      this.passwordConfirmar = '';
      this.hidePasswordActual = true;
      this.hidePasswordNueva = true;
      this.hidePasswordConfirmar = true;
      this.isPasswordStrong = false;
      this.missingRules = [];
      this.confirmTouched = false;
      this.confirmFocused = false;
      this.isConfirmMatch = false;
    }, 220);
  }

  onNuevaPasswordInput() {
    const p = this.passwordNueva || '';
    const missing: string[] = [];

    const lenOk = p.length >= 7 && p.length <= 15;
    const upperOk = /[A-Z]/.test(p);
    const lowerOk = /[a-z]/.test(p);
    const numberOk = /\d/.test(p);
    const specialOk = /[^a-zA-Z0-9]/.test(p);

    if (!lenOk) missing.push('7-15 caracteres');
    if (!upperOk) missing.push('1 mayúscula');
    if (!lowerOk) missing.push('1 minúscula');
    if (!numberOk) missing.push('1 número');
    if (!specialOk) missing.push('1 caracter especial');

    this.missingRules = missing;
    this.isPasswordStrong = missing.length === 0;

    if (this.confirmTouched && !this.confirmFocused) {
      this.isConfirmMatch = (this.passwordConfirmar || '') === (this.passwordNueva || '');
    }
  }

  onConfirmFocus() {
    this.confirmFocused = true;
  }

  onConfirmBlur() {
    this.confirmFocused = false;
    this.confirmTouched = true;
    this.isConfirmMatch = (this.passwordConfirmar || '') === (this.passwordNueva || '');
  }

  closePasswordModal() {
    this.resetPasswordFormAndClose();
  }

}
