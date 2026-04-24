import {
  animate,
  group,
  query,
  stagger,
  style,
  transition,
  trigger,
} from '@angular/animations';

const easeOut = 'cubic-bezier(0.22, 1, 0.36, 1)';
const easeSpring = 'cubic-bezier(0.34, 1.26, 0.64, 1)';

/**
 * Entrada de la vista de autenticación: fondo, hero, panel y mosaicos en cascada.
 * Requiere clases en la plantilla: .auth-anim-bg, .auth-anim-hero, .auth-anim-panel.
 */
export const authViewAnimation = trigger('authViewAnimation', [
  transition(':enter', [
    group([
      query(
        '.auth-anim-bg',
        [
          style({ opacity: 0, transform: 'scale(1.06)' }),
          animate(`980ms 0ms ${easeOut}`, style({ opacity: 1, transform: 'scale(1)' })),
        ],
        { optional: true }
      ),
      query(
        '.auth-anim-hero',
        [
          style({
            opacity: 0,
            transform: 'translate3d(-40px, 28px, 0) scale(0.94)',
            filter: 'blur(14px)',
          }),
          animate(
            `780ms 100ms ${easeOut}`,
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
            transform: 'translate3d(52px, 36px, 0) scale(0.92) perspective(900px) rotateY(-10deg)',
            filter: 'blur(16px)',
          }),
          animate(
            `820ms 160ms ${easeOut}`,
            style({
              opacity: 1,
              transform: 'translate3d(0, 0, 0) scale(1) perspective(900px) rotateY(0deg)',
              filter: 'blur(0)',
            })
          ),
        ],
        { optional: true }
      ),
      query(
        '.auth-anim-hero .ul-tile',
        [
          style({ opacity: 0, transform: 'translateY(26px) scale(0.9)' }),
          stagger('90ms', [
            animate(`520ms ${easeSpring}`, style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
          ]),
        ],
        { optional: true }
      ),
      query(
        '.auth-anim-hero .ul-scene__logoWrap',
        [
          style({ opacity: 0, transform: 'scale(0.82) rotate(-8deg)' }),
          animate(
            `720ms 140ms ${easeSpring}`,
            style({ opacity: 1, transform: 'scale(1) rotate(0deg)' })
          ),
        ],
        { optional: true }
      ),
      query(
        '.auth-anim-panel .ul-card__head > *',
        [
          style({ opacity: 0, transform: 'translateY(14px)' }),
          stagger('65ms', [
            animate(`400ms 280ms ${easeOut}`, style({ opacity: 1, transform: 'translateY(0)' })),
          ]),
        ],
        { optional: true }
      ),
    ]),
  ]),
]);
