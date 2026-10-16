import { CanDeactivateFn } from '@angular/router';
import { GenerarContratoComponent } from './generar-contrato.component';

/** Al cambiar de módulo con el formulario del contrato abierto, avisa si se perderán los datos llenados. */
export const formularioContratoGuard: CanDeactivateFn<GenerarContratoComponent> = (component) =>
  component?.puedeSalir() ?? true;
