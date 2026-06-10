import { animate, state, style, transition, trigger } from '@angular/animations';

/** Mostrar/ocultar formulario (alta ocultable; edición igual al estar visible). */
export const estacionamientoFormRevealAnimation = trigger('estacionamientoFormReveal', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(14px)' }),
    animate(
      '280ms cubic-bezier(0.33, 1, 0.68, 1)',
      style({ opacity: 1, transform: 'translateY(0)' }),
    ),
  ]),
  transition(':leave', [
    animate(
      '220ms cubic-bezier(0.4, 0, 1, 1)',
      style({ opacity: 0, transform: 'translateY(10px)' }),
    ),
  ]),
]);

/** Modal tipo contrato / pago (dim + panel). */
export const contractDimAnim = trigger('contractDimAnim', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('180ms ease-out', style({ opacity: 1 })),
  ]),
  transition(':leave', [
    animate('150ms ease-in', style({ opacity: 0 })),
  ]),
]);

/** Resumen de pago en modal Registrar renta. */
export const rentaResumenRevealAnim = trigger('rentaResumenReveal', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(12px) scale(0.985)' }),
    animate(
      '340ms 60ms cubic-bezier(0.33, 1, 0.68, 1)',
      style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
    ),
  ]),
  transition(':leave', [
    animate(
      '200ms cubic-bezier(0.4, 0, 1, 1)',
      style({ opacity: 0, transform: 'translateY(8px) scale(0.99)' }),
    ),
  ]),
]);

/** Cambio de texto en aviso del resumen (hint). */
export const rentaHintMsgAnim = trigger('rentaHintMsgAnim', [
  transition('* => *', [
    style({ opacity: 0, transform: 'translateY(10px) scale(0.96)' }),
    animate(
      '220ms cubic-bezier(0.33, 1, 0.68, 1)',
      style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
    ),
  ]),
]);

export const contractModalAnim = trigger('contractModalAnim', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(12px) scale(0.98)' }),
    animate(
      '220ms cubic-bezier(0.22, 1, 0.36, 1)',
      style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
    ),
  ]),
  transition(':leave', [
    animate(
      '170ms cubic-bezier(0.4, 0, 1, 1)',
      style({ opacity: 0, transform: 'translateY(8px) scale(0.985)' }),
    ),
  ]),
]);

export let routeAnimation = trigger('routeAnimation', [
  transition('void => *', [
    style({
      opacity: 0,
    }),
    animate('400ms 150ms ease-in-out', style({
      opacity: 1,
    }))
  ]),
]);


export let fadeOutAnimation = trigger('fadeOutAnimation', [
  state('*', style({
    position: 'absolute',
    'min-width': '100%',
    'min-height': '100%',
    'max-width': '100%',
    display: 'flex',
    'flex-direction': 'column',
    flex: '1',
    height: '100%'
  })),
  state('void', style({
    position: 'absolute',
    'min-width': '100%',
    'min-height': '100%',
    'max-width': '100%',
    display: 'flex',
    'flex-direction': 'column',
    flex: '1',
    height: '100%'
  })),
  transition('* => void', [
    style({
      opacity: 1,
    }),
    animate('150ms linear', style({
      opacity: 0,
    }))
  ]),
]);
