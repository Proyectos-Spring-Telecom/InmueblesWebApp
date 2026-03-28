import { animate, group, query, style, transition, trigger } from '@angular/animations';

/**
 * Entrada “hero + panel”: perspectiva, desenfoque y movimiento en X (sin empujar el layout
 * en Y para no provocar scroll fantasma). Las queries son opcionales (p. ej. vista error sin hero).
 */
export const authViewAnimation = trigger('authViewAnimation', [
  transition(':enter', [
    group([
      query(
        '.auth-anim-hero',
        [
          style({
            opacity: 0,
            transform: 'translate3d(-56px, 0, 0) scale(1.06)',
            filter: 'blur(12px)',
          }),
          animate(
            '560ms cubic-bezier(0.16, 1, 0.3, 1)',
            style({
              opacity: 1,
              transform: 'translate3d(0, 0, 0) scale(1)',
              filter: 'blur(0)',
            })
          ),
        ],
        { optional: true }
      ),
      query(
        '.auth-anim-panel',
        [
          style({
            opacity: 0,
            transform: 'translate3d(64px, 0, 0) scale(0.9) rotateY(-6deg)',
            filter: 'blur(14px)',
          }),
          animate(
            '640ms 90ms cubic-bezier(0.16, 1, 0.3, 1)',
            style({
              opacity: 1,
              transform: 'translate3d(0, 0, 0) scale(1) rotateY(0deg)',
              filter: 'blur(0)',
            })
          ),
        ],
        { optional: true }
      ),
    ]),
  ]),
]);
