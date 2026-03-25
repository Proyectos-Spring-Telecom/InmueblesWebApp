import { Routes } from '@angular/router';

/**
 * Rutas de autenticación. App publicado en:
 * - Login: https://springtelecom.mx/analiticavideo/login
 * - Cambio contraseña (enlace que debe enviar el back):
 *   https://springtelecom.mx/analiticavideo/cambio-password?token={TOKEN}
 */
import { AppErrorComponent } from './error/error.component';
import { AppSideLoginComponent } from './side-login/side-login.component';
import { AppSideRegisterComponent } from './side-register/side-register.component';
import { SolicitudCambioPasswordComponent } from './solicitud-cambio-password/solicitud-cambio-password.component';
import { CambioPasswordComponent } from './cambio-password';

export const AuthenticationRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'error',
        component: AppErrorComponent,
      },
      {
        path: 'login',
        component: AppSideLoginComponent,
      },
      {
        path: 'register',
        component: AppSideRegisterComponent,
      },
      {
        path: 'solicitud-cambio-password',
        component: SolicitudCambioPasswordComponent,
      },
      {
        path: 'cambio-password',
        component: CambioPasswordComponent,
      },
    ],
  },
];
