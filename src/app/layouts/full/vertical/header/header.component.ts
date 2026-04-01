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
    const route = resolvePanelAccessRoute(item);
    if (!route) continue;
    out.push({ ...item, route });
  }
  return out;
}

/** Mensajes / avisos (contratos, alertas generales) */
interface AvisoNotificacion {
  id: number;
  title: string;
  subtitle: string;
  urgent?: boolean;
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
    event.preventDefault();
    this.openContratoDetalleDialog(this.buildDetalleFromAviso(a));
  }

  onReciboContratoClick(r: ReciboEstadoItem, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
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
      fechaInicio: '02/01/2017',
      fechaTermino: '01/01/2019',
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
  inmueblesNotifCount = 1;
  prediosNotifCount = 0;

  avisosLista: AvisoNotificacion[] = [
    {
      id: 1,
      title: 'Contratos próximos a vencer',
      subtitle: 'Contrato : PC-0001 - Prestalana SA de CV',
      urgent: true,
    },
    {
      id: 2,
      title: 'Contrato : PC-0006 - Estilos QIU Home SA de CV',
      subtitle: 'Revisión de documentación pendiente',
      detalle: {
        contrato: 'PC-0006',
        arrendatario: 'Estilos QIU Home SA de CV',
        inmueble: 'Showroom y bodega — Zona industrial',
      },
    },
    {
      id: 3,
      title: 'Contrato : PC-0012 - Logística Norte SA de CV',
      subtitle: 'Vigencia actualizada en el sistema',
      detalle: {
        contrato: 'PC-0012',
        arrendatario: 'Logística Norte SA de CV',
        fechaInicio: '15/03/2018',
        fechaTermino: '14/03/2023',
      },
    },
    {
      id: 4,
      title: 'Contrato : PC-0020 - Inmobiliaria del Valle',
      subtitle: 'Recordatorio de pago programado',
      detalle: {
        contrato: 'PC-0020',
        arrendatario: 'Inmobiliaria del Valle',
        predio: 'Parque logístico Valle — Lote 12',
      },
    },
  ];

  /** Misma estructura de categorías para inmuebles y predios (datos demo) */
  private readonly recibosCategoriasPlantilla: ReciboEstadoItem[] = [
    {
      id: 'vencidos',
      tone: 'danger',
      icon: 'x',
      label: 'Recibos vencidos',
      detail: 'Agua — Contrato : 54035',
    },
    {
      id: 'proximos',
      tone: 'warning',
      icon: 'alert-circle',
      label: 'Recibos próximos a vencer',
    },
    {
      id: 'cinco-dias',
      tone: 'amber',
      icon: 'thumb-up',
      label: 'Recibos con más de 5 días hábiles para pagar',
    },
    {
      id: 'pagados',
      tone: 'success',
      icon: 'check',
      label: 'Recibos pagados este mes',
    },
    {
      id: 'fuera-tiempo',
      tone: 'info',
      icon: 'info-circle',
      label: 'Recibos pagados fuera de tiempo este mes',
    },
  ];

  recibosInmuebles: ReciboEstadoItem[] = [...this.recibosCategoriasPlantilla];
  recibosPredios: ReciboEstadoItem[] = this.recibosCategoriasPlantilla.map((c) =>
    c.id === 'vencidos' ? { ...c, detail: undefined } : { ...c },
  );

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
