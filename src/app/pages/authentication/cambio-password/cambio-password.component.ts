import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  FormsModule,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { UsuariosService } from 'src/app/services/moduleService/usuario.service';
import { catchError, throwError } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { authViewAnimation } from '../auth-view.animation';

function confirmarPasswordValidator(controlName: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const sibling = control.parent?.get(controlName);
    if (!sibling) return null;
    const match = (sibling.value ?? '').trim() === (control.value ?? '').trim();
    return match ? null : { confirmarPassword: true };
  };
}

function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = control.value;
    if (!v || typeof v !== 'string') return { passwordStrength: true };
    const p = v.trim();
    if (p.length < 7 || p.length > 15) return { passwordStrength: true };
    if (!/[A-Z]/.test(p)) return { passwordStrength: true };
    if (!/[a-z]/.test(p)) return { passwordStrength: true };
    if (!/\d/.test(p)) return { passwordStrength: true };
    if (!/[^a-zA-Z0-9]/.test(p)) return { passwordStrength: true };
    return null;
  };
}

function emailFromJwt(token: string): string | null {
  try {
    const parts = token.trim().split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload: { email?: string; sub?: string } = JSON.parse(atob(b64));
    const email = payload?.email ?? payload?.sub ?? null;
    return typeof email === 'string' && email.length > 0 ? email : null;
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-cambio-password',
  imports: [RouterModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './cambio-password.component.html',
  styleUrls: ['./cambio-password.component.scss'],
  animations: [authViewAnimation],
})
export class CambioPasswordComponent implements OnInit {
  form: FormGroup;
  loading = false;
  isDisabled = false;
  hidePassword = true;
  hideConfirm = true;
  missingRules: string[] = [];
  isPasswordStrong = false;
  nuevaPasswordFocused = false;
  confirmarPasswordFocused = false;
  liveUserName = '';
  liveNuevaPassword = '';
  liveConfirmarPassword = '';
  token: string | null = null;

  // Estado individual de cada regla
  rulesStatus: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  } = {
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false,
    };

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private usuariosService: UsuariosService,
    private toastr: ToastrService
  ) {
    this.form = this.fb.group(
      {
        userName: ['', [Validators.required, Validators.email]],
        nuevaPassword: [
          '',
          [
            Validators.required,
            Validators.minLength(7),
            Validators.maxLength(15),
            passwordStrengthValidator(),
          ],
        ],
        confirmarPassword: ['', [Validators.required, confirmarPasswordValidator('nuevaPassword')]],
      },
      { updateOn: 'blur' }
    );
  }

  ngOnInit(): void {
    this.parseToken(null);
    this.route.queryParams.subscribe((qp) => this.parseToken(qp));
    this.form.get('nuevaPassword')?.valueChanges?.subscribe((val) => {
      this.form.get('confirmarPassword')?.updateValueAndValidity();
      this.updateMissingRules(val ?? '');
    });
    this.updateMissingRules(this.form.get('nuevaPassword')?.value ?? '');
  }

  /**
   * Obtiene el token desde: 1) params emitidos por la ruta, 2) URL (search o hash), 3) árbol de rutas.
   */
  private parseToken(routeParams?: { [key: string]: unknown } | null): void {
    let t: string | null = null;

    if (routeParams && typeof routeParams['token'] === 'string') {
      t = routeParams['token'] as string;
    }
    if (t == null && typeof window !== 'undefined' && window.location?.href) {
      try {
        const url = new URL(window.location.href);
        t = url.searchParams.get('token');
        if (!t && url.hash) {
          const qi = url.hash.indexOf('?');
          if (qi !== -1) t = new URLSearchParams(url.hash.slice(qi)).get('token');
        }
      } catch {
        /* ignore */
      }
    }
    if (t == null) {
      let r: ActivatedRoute | null = this.route;
      while (r) {
        const q = r.snapshot?.queryParams;
        if (q && typeof q['token'] === 'string') {
          t = q['token'];
          break;
        }
        r = r.parent;
      }
    }

    if (typeof t === 'string') t = t.trim();
    this.token = t && t.length > 0 ? t : null;
    if (this.token) {
      const email = emailFromJwt(this.token);
      if (email && !this.form.get('userName')?.value) {
        this.form.patchValue({ userName: email });
        this.liveUserName = email;
      }
    }
  }

  onUserNameInput(ev: Event): void {
    this.liveUserName = (ev.target as HTMLInputElement)?.value ?? '';
  }

  onNuevaPasswordInput(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    const p = el?.value ?? '';
    this.liveNuevaPassword = p;
    this.updateMissingRules(p);
  }

  onConfirmarInput(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    this.liveConfirmarPassword = el?.value ?? '';
  }

  private updateMissingRules(p: string): void {
    const missing: string[] = [];

    // Actualizar estado individual de cada regla
    const lengthOk = p.length >= 7 && p.length <= 15;
    const uppercaseOk = /[A-Z]/.test(p);
    const lowercaseOk = /[a-z]/.test(p);
    const numberOk = /\d/.test(p);
    const specialOk = /[^a-zA-Z0-9]/.test(p);

    this.rulesStatus = {
      length: lengthOk,
      uppercase: uppercaseOk,
      lowercase: lowercaseOk,
      number: numberOk,
      special: specialOk,
    };

    // Solo agregar a missingRules los que NO se cumplen
    if (!lengthOk) missing.push('7-15 caracteres');
    if (!uppercaseOk) missing.push('1 mayúscula');
    if (!lowercaseOk) missing.push('1 minúscula');
    if (!numberOk) missing.push('1 número');
    if (!specialOk) missing.push('1 caracter especial');

    this.missingRules = missing;
    this.isPasswordStrong = missing.length === 0;
  }

  get f() {
    return this.form.controls;
  }

  get confirmarMatch(): boolean {
    const n = (this.form.get('nuevaPassword')?.value ?? '').trim();
    const c = (this.form.get('confirmarPassword')?.value ?? '').trim();
    return n.length > 0 && c.length > 0 && n === c;
  }

  get confirmarMatchLive(): boolean {
    return this.liveNuevaPassword.length > 0 && this.liveConfirmarPassword.length > 0 &&
      this.liveNuevaPassword === this.liveConfirmarPassword;
  }

  get canSubmit(): boolean {
    const email = (this.liveUserName || (this.form.get('userName')?.value ?? '')).trim();
    const emailOk = email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return emailOk && this.isPasswordStrong && this.confirmarMatchLive;
  }

  onSubmit() {
    if (!this.canSubmit) {
      this.form.markAllAsTouched();
      if (!this.isPasswordStrong) {
        this.toastr.warning('La contraseña debe cumplir todos los requisitos.', 'Requerido');
        return;
      }
      if (!this.confirmarMatchLive) {
        this.toastr.warning('Las contraseñas no coinciden.', 'Requerido');
        return;
      }
      return;
    }
    const userName = (this.liveUserName || (this.form.get('userName')?.value ?? '')).trim();
    const nuevaPassword = (this.liveNuevaPassword || (this.form.get('nuevaPassword')?.value ?? '')).trim();
    this.isDisabled = true;
    this.loading = true;

    this.usuariosService
      .cambiarAccesso(userName, nuevaPassword, this.token)
      .pipe(
        catchError((err) => {
          this.loading = false;
          this.isDisabled = false;
          const msg =
            err?.error?.message || err?.message || 'Error al restablecer la contraseña.';
          this.toastr.error(msg, '¡Ops!');
          return throwError(() => err);
        })
      )
      .subscribe((response) => {
        this.loading = false;
        this.isDisabled = false;
        const mensaje = response || 'Contraseña actualizada exitosamente.';
        this.toastr.success(mensaje, 'Listo', { timeOut: 8000 });
        this.router.navigate(['/login']);
      });
  }
}
