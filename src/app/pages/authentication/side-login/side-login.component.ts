import { Component, OnInit } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import {
  FormGroup,
  FormControl,
  Validators,
  FormsModule,
  ReactiveFormsModule,
  UntypedFormGroup,
  FormBuilder,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { AppAuthBrandingComponent } from '../../../layouts/full/vertical/sidebar/auth-branding.component';
import { Credentials } from 'src/app/entities/Credentials';
import { User } from 'src/app/entities/User';
import { AuthenticationService } from 'src/app/services/auth.service';
import { catchError, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { ToastrService } from 'ngx-toastr';
import { Permiso } from 'src/app/entities/permiso.enum';
import { authViewAnimation } from '../auth-view.animation';
import { AuthTransitionService } from 'src/app/services/auth-transition.service';
import { LoginSuccessSoundService } from 'src/app/services/login-success-sound.service';
const LOGIN_SUCCESS_SOUND_MS = 10_000;

@Component({
  selector: 'app-side-login',
  imports: [RouterModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './side-login.component.html',
  styleUrls: ['./side-login.component.scss'],
  animations: [authViewAnimation],
})
export class AppSideLoginComponent implements OnInit {
  options = this.settings.getOptions();
  public isDisabled = false;

  constructor(
    private router: Router,
    private settings: CoreService,
    private auth: AuthenticationService,
    private fb: FormBuilder,
    private toastr: ToastrService,
    private authService: AuthenticationService,
    private authTransition: AuthTransitionService,
    private loginSuccessSound: LoginSuccessSoundService,
  ) {}

  form = new FormGroup({
    uname: new FormControl('', [Validators.required, Validators.minLength(6)]),
    password: new FormControl('', [Validators.required]),
  });

  get f() {
    return this.form.controls;
  }

  submit() {
    // console.log(this.form.value);
    this.router.navigate(['/monitoreo']);
  }

  initForm() {
    this.loginForm = this.fb.group({
      userName: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      // email: ['admin@themesbrand.com', [Validators.required, Validators.email]],
      // password: ['123456', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.initForm();
  }

  loginForm: UntypedFormGroup;
  public credentials: Credentials;
  hidePass = true;

  public correoUsuario: string = '';
  public textLogin: string = 'iniciar sesión';
  public loading: boolean = false;

  onSubmit() {
    if (this.isDisabled || this.loginForm.invalid) {
      return;
    }
    this.isDisabled = true;
    this.loading = true;
    this.textLogin = 'cargando...';
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
    // this.loading = true;
    this.credentials = this.loginForm.value;

    this.authService
      .login({
        userName: this.credentials.userName,
        password: this.credentials.password,
      })
      .pipe(
        catchError((error: any) => {
          this.loading = false;
          this.textLogin = 'iniciar sesión';
          // Obtener el mensaje del servidor desde error.error.message
          const errorMessage = error?.error?.message || error?.message || 'Error al iniciar sesión';
          this.toastr.error(errorMessage, '¡Ops!');
          this.isDisabled = false;
          return throwError(() => '');
        })
      )
      .subscribe(() => {
        const perms = this.authService.getPermissions() || [];
        const hasMonitoreo = perms.includes(String(Permiso.CONSULTAR_ARRENDADORES_MAPA));
        const route = hasMonitoreo ? ['/monitoreo'] : ['/usuarios/perfil-usuario'];
        this.completeLoginNavigation(route);
      });
  }

  private completeLoginNavigation(route: string[]): void {
    this.toastr.success('Bienvenido al Sistema.', '¡Credenciales Correctas!');
    this.loginSuccessSound.beginLoginSequence();
    void this.router.navigate(route).then(() => {
      this.authTransition.startAppReveal();
      // Sonido + resaltado cuando ya está el header (después del fade de entrada).
      // Solo sonará si la API de notificaciones devuelve elementos pendientes.
      window.setTimeout(() => {
        this.loginSuccessSound.armLoginSound(LOGIN_SUCCESS_SOUND_MS);
      }, 580);
    });

    this.loading = false;
    this.textLogin = 'iniciar sesión';
    this.isDisabled = false;
  }

  onSubmits() {
    // console.log(this.form.value);
    this.router.navigate(['/monitoreo']);
  }

  openFacebook() {
    window.open('https://www.facebook.com/profile.php?id=61579119466053', '_blank');
  }

  openInstagram() {
    window.open(
      'https://www.instagram.com/spring_telecom?fbclid=IwY2xjawPgd-ZleHRuA2FlbQIxMABicmlkETFWcXA1TlhHNEkza3VHQW16c3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHhKPqP9x7y6kKduncrL3ZWgMV5pl48pdF_VN8yg9so_O9zZdq0q1_G-wMD54_aem_lEOCii1Rjv-RdeLXoTG6rA',
      '_blank'
    );
  }
}
