import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// 👇 REGISTRA TU LICENCIA DE DEVEXTREME ANTES DEL BOOTSTRAP
import config from 'devextreme/core/config';
import { locale } from 'devextreme/localization';
import { environment } from './environments/environment';
// import { installInmGridOverflowTooltip } from './app/shared/inm-grid-overflow-tooltip';

// Configurar locale de DevExtreme en español
// DevExtreme cargará automáticamente los mensajes si están disponibles en node_modules
locale('es');

if (environment?.dxLicenseKey) {
  // 'as any' evita que TypeScript se queje del tipo
  config({ licenseKey: environment.dxLicenseKey } as any);
}

// Tooltip de celdas truncadas (desactivado por ahora)
// installInmGridOverflowTooltip();

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
