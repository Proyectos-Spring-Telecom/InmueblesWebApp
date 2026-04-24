import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { UsuariosService } from 'src/app/services/moduleService/usuario.service';
import { catchError, throwError } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { authViewAnimation } from '../auth-view.animation';

@Component({
  selector: 'app-solicitud-cambio-password',
  imports: [RouterModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './solicitud-cambio-password.component.html',
  styleUrls: ['./solicitud-cambio-password.component.scss'],
  animations: [authViewAnimation],
})
export class SolicitudCambioPasswordComponent {
  form: FormGroup;
  loading = false;
  isDisabled = false;
  solicitudEnviada = false;

  constructor(
    private fb: FormBuilder,
    private usuariosService: UsuariosService,
    private toastr: ToastrService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  get f() {
    return this.form.controls;
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isDisabled = true;
    this.loading = true;
    this.solicitudEnviada = false;
    const email = this.form.get('email')?.value?.trim() ?? '';

    this.usuariosService
      .solicitarCambioContrasena({ userName: email })
      .pipe(
        catchError((err) => {
          this.loading = false;
          this.isDisabled = false;
          const msg =
            err?.error?.message || err?.message || 'Error al solicitar el cambio de contraseña.';
          this.toastr.error(msg, '¡Ops!');
          return throwError(() => err);
        })
      )
      .subscribe(() => {
        this.loading = false;
        this.isDisabled = false;
        this.solicitudEnviada = true;
      });
  }
}
