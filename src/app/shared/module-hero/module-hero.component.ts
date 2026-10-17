import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Encabezado estándar de los módulos (mismo diseño que la portada de Generar Contrato).
 *
 * Uso:
 * ```html
 * <app-module-hero icon="contacts" eyebrow="Operación" titulo="Arrendadores"
 *   descripcion="Consulta y administra los arrendadores."></app-module-hero>
 * ```
 * Lo que se proyecte dentro (botones, datos) se muestra debajo de la descripción.
 */
@Component({
  selector: 'app-module-hero',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './module-hero.component.html',
  styleUrl: './module-hero.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModuleHeroComponent {
  /** Ícono de Material del módulo (también se usa en la ilustración). */
  @Input() icon = 'dashboard';
  /** Texto de la etiqueta superior (ej. "Operación · Arrendatarios"). */
  @Input() eyebrow = 'Sección';
  @Input() titulo = '';
  @Input() descripcion = '';
}
