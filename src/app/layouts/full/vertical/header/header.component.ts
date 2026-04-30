import {
  Component,
  Output,
  EventEmitter,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { navItems } from '../sidebar/sidebar-data';
import { TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { BrandingComponent } from '../sidebar/branding.component';
import { AppSettings } from 'src/app/config';
import { AuthenticationService } from 'src/app/services/auth.service';
import { NavItem } from '../sidebar/nav-item/nav-item';
import {
  ContratoDetalleDialogComponent,
  ContratoDetalleDialogData,
} from './contrato-detalle-dialog/contrato-detalle-dialog.component';

/** Rutas mostradas en Panel de accesos para ítems que en sidebar usan `/menu-level`. */
const PANEL_ROUTE_FOR_MENU_LEVEL: Record<string, string> = {
  Administración: '/modulos',
  Clientes: '/clientes',
  Usuarios: '/usuarios',
  Roles: '/roles',
};

/** Texto secundario del Panel de accesos (no mostrar rutas). */
const PANEL_SUBTEXT_BY_DISPLAY_NAME: Record<string, string> = {
  Administración: 'Configuración general del sistema y gestión de módulos.',
  Usuarios: 'Alta, edición y control de usuarios del sistema.',
  Roles: 'Definición de permisos y niveles de acceso.',
  Arrendadores: 'Monitoreo y gestión de inmuebles y arrendatarios.',
  Catálogos: 'Administración arrendadores, inmuebles y arrendatarios.',
  'Perfil Usuario': 'Configuración y actualización de tu información personal.',
};

function isPanelLogoutItem(item: NavItem): boolean {
  return (
    item?.route === '/login' &&
    /cerrar sesi[oó]n|sign out/i.test(item?.displayName || '')
  );
}

function resolvePanelAccessRoute(item: NavItem): string | undefined {
  if (!item.displayName || item.external) return undefined;
  const r = item.route;
  if (!r) return undefined;
  if (r !== '/menu-level') return r;
  const mapped = PANEL_ROUTE_FOR_MENU_LEVEL[item.displayName];
  if (mapped) return mapped;
  const first = item.children?.find((c) => c.route && !c.external);
  return first?.route;
}

function buildPanelAccessItems(items: NavItem[]): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    if (!item.displayName) continue;
    if (isPanelLogoutItem(item)) continue;
    const route = resolvePanelAccessRoute(item);
    if (!route) continue;
    const subtext = PANEL_SUBTEXT_BY_DISPLAY_NAME[item.displayName] ?? item.subtext;
    out.push({ ...item, route, subtext });
  }
  return out;
}

/** Mensajes / avisos (contratos, alertas generales) */
interface AvisoNotificacion {
  id: number;
  title: string;
  subtitle: string;
  /** Semáforo: success = bien (verde), warning = próximo (amarillo), danger = crítico (rojo). */
  tone?: 'success' | 'warning' | 'amber' | 'danger';
  /** Días restantes para vencer (si aplica). */
  daysLeft?: number;
  detalle?: Partial<ContratoDetalleDialogData>;
}

/** Categorías de estado de recibos (inmuebles / predios) */
interface ReciboEstadoItem {
  id: string;
  tone: 'danger' | 'warning' | 'amber' | 'success' | 'info';
  icon: string;
  label: string;
  detail?: string;
}

interface profiledd {
  id: number;
  title: string;
  link?: string;
  new?: boolean;
}

interface apps {
  id: number;
  icon: string;
  color: string;
  title: string;
  subtitle: string;
  link: string;
}

interface quicklinks {
  id: number;
  title: string;
  link: string;
}

@Component({
  selector: 'app-header',
  imports: [
    RouterModule,
    CommonModule,
    NgScrollbarModule,
    TablerIconsModule,
    MaterialModule,
    BrandingComponent,
  ],
  templateUrl: './header.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class HeaderComponent {
  titleCase(input: unknown): string {
    const s = String(input ?? '').trim();
    if (!s) return '';
    // Primera mayúscula y resto minúsculas por palabra (mantiene separadores y números).
    return s
      .toLowerCase()
      .replace(/\p{L}[\p{L}\p{M}'’]*/gu, (w) => {
        const first = w.charAt(0).toUpperCase();
        return first + w.slice(1);
      });
  }

  @Input() showToggle = true;
  @Input() toggleChecked = false;
  @Output() toggleMobileNav = new EventEmitter<void>();
  @Output() toggleMobileFilterNav = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();

  isCollapse: boolean = false; // Initially hidden

  toggleCollpase() {
    this.isCollapse = !this.isCollapse; // Toggle visibility
  }

  showFiller = false;

  public selectedLanguage: any = {
    language: 'English',
    code: 'en',
    type: 'US',
    icon: 'assets/images/flag/icon-flag-en.svg',
  };

  public languages: any[] = [
    {
      language: 'English',
      code: 'en',
      type: 'US',
      icon: 'assets/images/flag/icon-flag-en.svg',
    },
    {
      language: 'Español',
      code: 'es',
      icon: 'assets/images/flag/icon-flag-es.svg',
    },
    {
      language: 'Français',
      code: 'fr',
      icon: 'assets/images/flag/icon-flag-fr.svg',
    },
    {
      language: 'German',
      code: 'de',
      icon: 'assets/images/flag/icon-flag-de.svg',
    },
  ];
  public showNombre: any;
  public showApellidoPaterno: any;
  public showApellidoMaterno: any;
  public showRol: any;
  public showEmail: any;

  @Output() optionsChange = new EventEmitter<AppSettings>();

  options = this.settings.getOptions();

  constructor(
    private settings: CoreService,
    private vsidenav: CoreService,
    public dialog: MatDialog,
    private translate: TranslateService,
    private users: AuthenticationService,
  ) {
    const user = this.users.getUser();
    this.showNombre = user?.nombre;
    this.showApellidoPaterno = user?.apellidoPaterno || '';
    this.showApellidoMaterno = user?.apellidoMaterno || '';
    this.showRol = user?.rolNombre;
    this.showEmail = user?.userName;
    translate.setDefaultLang('en');

    // Semáforo: asignar tonos para avisos con daysLeft.
    this.avisosLista = this.avisosLista.map((a) => ({
      ...a,
      tone: a.tone ?? this.toneByDaysLeft(a.daysLeft),
    }));
  }

  openDialog() {
    const dialogRef = this.dialog.open(AppSearchDialogComponent);

    dialogRef.afterClosed().subscribe((result) => {
      console.log(`Dialog result: ${result}`);
    });
  }

  changeLanguage(lang: any): void {
    this.translate.use(lang.code);
    this.selectedLanguage = lang;
  }

  setlightDark(theme: string) {
    this.options.theme = theme;
    this.emitOptions();
  }

  private emitOptions() {
    this.optionsChange.emit(this.options);
  }

  isLogoutProfile(profile: profiledd): boolean {
    return profile?.link === '/login' && /cerrar sesi[oó]n|sign out/i.test(profile?.title || '');
  }

  onProfileAction(profile: profiledd, event: Event): void {
    if (!this.isLogoutProfile(profile)) return;
    event.preventDefault();
    this.users.logout().subscribe();
  }

  onAvisoContratoClick(a: AvisoNotificacion, event: Event): void {
    event.stopPropagation();
    this.openContratoDetalleDialog(this.buildDetalleFromAviso(a));
  }

  onReciboContratoClick(r: ReciboEstadoItem, event: Event): void {
    event.stopPropagation();
    this.openContratoDetalleDialog(this.buildDetalleFromRecibo(r));
  }

  private openContratoDetalleDialog(data: ContratoDetalleDialogData): void {
    this.dialog.open(ContratoDetalleDialogComponent, {
      data,
      panelClass: 'contrato-detalle-dialog-shell',
      autoFocus: false,
      maxWidth: '95vw',
      width: 'min(600px, 95vw)',
    });
  }

  private defaultContratoDetalle(): ContratoDetalleDialogData {
    return {
      predio: 'Desarrollo Inmobiliario BHV SA de CV',
      inmueble: 'Oficinas corporativas — Torre B, Piso 4',
      arrendatario: 'Prestalana SA de CV',
      arrendador: 'Desarrollo Inmobiliario BHV SA de CV',
      contrato: 'PC-0001',
      fechaInicio: '01/01/2025',
      fechaTermino: '31/12/2027',
    };
  }

  private buildDetalleFromAviso(a: AvisoNotificacion): ContratoDetalleDialogData {
    const base = this.defaultContratoDetalle();
    const parsed = this.parseSubtitleContrato(a.subtitle);
    return {
      titulo: 'Detalles de Contrato',
      ...base,
      ...a.detalle,
      contrato: a.detalle?.contrato ?? parsed.codigo ?? base.contrato,
      arrendatario: a.detalle?.arrendatario ?? parsed.razonSocial ?? base.arrendatario,
    };
  }

  private buildDetalleFromRecibo(r: ReciboEstadoItem): ContratoDetalleDialogData {
    const base = this.defaultContratoDetalle();
    const codigo = r.detail?.match(/Contrato\s*:\s*([\w-]+)/i)?.[1];
    const servicio = r.detail?.split(/[—\-]/)[0]?.trim();
    return {
      titulo: 'Detalles de Contrato',
      ...base,
      contrato: codigo ?? base.contrato,
      inmueble: servicio && servicio !== codigo ? servicio : base.inmueble,
    };
  }

  private parseSubtitleContrato(subtitle: string): { codigo?: string; razonSocial?: string } {
    const m = subtitle.match(/Contrato\s*:\s*([^\s-]+)\s*[-\u2014]\s*(.+)/i);
    if (m) {
      return { codigo: m[1].trim(), razonSocial: m[2].trim() };
    }
    const m2 = subtitle.match(/Contrato\s*:\s*(\S+)/i);
    if (m2) {
      return { codigo: m2[1].trim() };
    }
    return {};
  }

  /** Contador sobre el ícono de sobre (demo; enlazar a API cuando exista) */
  avisosCount = 13;
  /** Re-usamos estos contadores para: Arrendadores / Arrendatarios (sin tocar estilos del header). */
  inmueblesNotifCount = 5;
  prediosNotifCount = 5;

  private toneByDaysLeft(daysLeft?: number): 'success' | 'warning' | 'amber' | 'danger' {
    const n = Number(daysLeft);
    if (!Number.isFinite(n)) return 'success';
    // Reglas (semáforo):
    // - Mayor a 30 días: verde
    // - Menor a 15 días: naranja
    // - Menor a 7 días: amarillo
    // - Menor a 3 días: rojo
    if (n < 3) return 'danger';
    if (n < 7) return 'amber';
    if (n < 15) return 'warning';
    return 'success';
  }

  avisosLista: AvisoNotificacion[] = [
    {
      id: 1,
      title: 'Contratos próximos a vencer',
      subtitle: 'Contrato: PC-0001 — Arrendatario: Prestalana SA de CV — Vence: 12 días',
      daysLeft: 12,
    },
    {
      id: 2,
      title: 'Renovación pendiente',
      subtitle: 'Contrato: PC-0006 — Arrendatatario: Estilos QIU Home SA de CV — Documentación pendiente',
      daysLeft: 2,
      detalle: {
        contrato: 'PC-0006',
        arrendatario: 'Estilos QIU Home SA de CV',
        inmueble: 'Showroom y bodega — Zona industrial',
      },
    },
    {
      id: 3,
      title: 'Contrato actualizado',
      subtitle: 'Contrato: PC-0012 — Logística Norte SA de CV — Vigencia registrada en sistema',
      daysLeft: 40,
      detalle: {
        contrato: 'PC-0012',
        arrendatario: 'Logística Norte SA de CV',
        fechaInicio: '01/03/2025',
        fechaTermino: '28/02/2028',
      },
    },
    {
      id: 4,
      title: 'Aviso urgente',
      subtitle: 'Contrato: PC-0020 — Inmobiliaria del Valle — Vence: 1 día',
      daysLeft: 1,
      detalle: {
        contrato: 'PC-0020',
        arrendatario: 'Inmobiliaria del Valle',
        predio: 'Parque logístico Valle — Lote 12',
      },
    },
  ];

  /**
   * Misma estructura visual (notify-hub-recibo), pero con información de:
   * - Pagos de servicios (menuNotifInmuebles)
   * - Arrendatarios (menuNotifPredios)
   */
  private readonly recibosCategoriasPlantilla: ReciboEstadoItem[] = [
    {
      id: 'critico',
      tone: 'danger',
      icon: 'x',
      label: 'Pagos vencidos',
      detail: 'Servicio: Agua — Contrato: SV-1020 — Último día: 25/04/2026',
    },
    {
      id: 'proximos',
      tone: 'warning',
      icon: 'alert-circle',
      label: 'Pagos por vencer',
      detail: 'Servicio: Luz — Último día: 02/05/2026 — Comprobante pendiente',
    },
    {
      id: 'estables',
      tone: 'amber',
      icon: 'thumb-up',
      label: 'Pagos en revisión',
      detail: 'Servicio: Mantenimiento — 2 comprobantes por validar',
    },
    {
      id: 'ok',
      tone: 'success',
      icon: 'check',
      label: 'Pagos al corriente',
      detail: 'Último pago registrado: 28/04/2026',
    },
  ];

  /** Menu "inmuebles" -> ahora Pagos de servicios */
  recibosInmuebles: ReciboEstadoItem[] = [...this.recibosCategoriasPlantilla];
  /** Menu "predios" -> ahora Arrendatarios */
  recibosPredios: ReciboEstadoItem[] = [
    {
      id: 'critico-loc',
      tone: 'danger',
      icon: 'x',
      label: 'Arrendatarios con adeudo',
      detail: 'Arrendatario: Servicios Urbanos — Servicio: Renta — Último día: 25/04/2026',
    },
    {
      id: 'prox-loc',
      tone: 'warning',
      icon: 'alert-circle',
      label: 'Pagos próximos de arrendatarios',
      detail: 'Arrendatario: Prestalana SA de CV — Servicio: Mantenimiento — Último día: 02/05/2026',
    },
    {
      id: 'mid-loc',
      tone: 'amber',
      icon: 'thumb-up',
      label: 'Renovaciones en proceso',
      detail: 'Arrendatario: Logística Norte — 1 renovación en validación',
    },
    {
      id: 'ok-loc',
      tone: 'success',
      icon: 'check',
      label: 'Arrendatarios al corriente',
      detail: 'Último pago registrado: 28/04/2026',
    },
  ];

  profiledd: profiledd[] = [
    {
      id: 1,
      title: 'Perfil de Usuario',
      // link: '/',
    },
    // {
    //   id: 2,
    //   title: 'My Projects',
    //   link: '/',
    // },
    // {
    //   id: 3,
    //   title: 'Inbox',
    //   new: true,
    //   link: '/',
    // },
    // {
    //   id: 4,
    //   title: ' Mode',
    //   link: '/',
    // },
    // {
    //   id: 5,
    //   title: ' Account Settings',
    //   link: '/',
    // },
    {
      id: 6,
      title: 'Cerrar Sesión',
      link: '/login',
    },
  ];

  apps: apps[] = [
    {
      id: 1,
      icon: 'message',
      color: 'primary',
      title: 'Chat Application',
      subtitle: 'Messages & Emails',
      link: '/',
    },
    {
      id: 2,
      icon: 'list-check',
      color: 'secondary',
      title: 'Todo App',
      subtitle: 'Completed task',
      link: '/',
    },
    {
      id: 3,
      icon: 'file-invoice',
      color: 'success',
      title: 'Invoice App',
      subtitle: 'Get latest invoice',
      link: '/',
    },
    {
      id: 4,
      icon: 'calendar',
      color: 'error',
      title: 'Calendar App',
      subtitle: 'Get Dates',
      link: '/',
    },
    {
      id: 5,
      icon: 'device-mobile',
      color: 'warning',
      title: 'Contact Application',
      subtitle: '2 Unsaved Contacts',
      link: '/',
    },
    {
      id: 6,
      icon: 'ticket',
      color: 'primary',
      title: 'Tickets App',
      subtitle: 'Create new ticket',
      link: '/',
    },
    {
      id: 7,
      icon: 'mail',
      color: 'secondary',
      title: 'Email App',
      subtitle: 'Get new emails',
      link: '/',
    },
    {
      id: 8,
      icon: 'book-2',
      color: 'warning',
      title: 'Courses',
      subtitle: 'Create new course',
      link: '/',
    },
  ];
  quicklinks: quicklinks[] = [
    {
      id: 1,
      title: 'Pricing Page',
      link: '/',
    },
    {
      id: 2,
      title: 'Authentication Design',
      link: '/',
    },
    {
      id: 3,
      title: 'Register Now',
      link: '/authentication/register',
    },
    {
      id: 4,
      title: '404 Error Page',
      link: '/authentication/error',
    },
    {
      id: 5,
      title: 'Notes App',
      link: '/',
    },
    {
      id: 6,
      title: 'Employee App',
      link: '/',
    },
    {
      id: 7,
      title: 'Todo Application',
      link: '/',
    },
  ];
}

@Component({
  selector: 'search-dialog',
  imports: [RouterModule, MaterialModule, TablerIconsModule, FormsModule],
  templateUrl: 'search-dialog.component.html',
})
export class AppSearchDialogComponent {
  searchText: string = '';
  navItems = navItems;

  readonly navItemsData: NavItem[] = buildPanelAccessItems(navItems);

  constructor(
    private auth: AuthenticationService,
    private dialogRef: MatDialogRef<AppSearchDialogComponent>,
  ) {}

  isLogoutItem(item: NavItem): boolean {
    return (
      item?.route === '/login' &&
      /cerrar sesi[oó]n|sign out/i.test(item?.displayName || '')
    );
  }

  onLogoutClick(event: Event): void {
    event.preventDefault();
    this.dialogRef.close();
    this.auth.logout().subscribe();
  }
}
