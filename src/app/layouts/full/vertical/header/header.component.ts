import {
  Component,
  DestroyRef,
  Output,
  EventEmitter,
  Input,
  OnInit,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CoreService } from 'src/app/services/core.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { navItems } from '../sidebar/sidebar-data';
import { TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { BrandingComponent } from '../sidebar/branding.component';
import { AppSettings } from 'src/app/config';
import { AuthenticationService } from 'src/app/services/auth.service';
import { NavItem } from '../sidebar/nav-item/nav-item';
import {
  NotificacionesService,
  NotificacionesResponse,
  PagoSeguimientoDto,
  PagoServicioInmuebleDto,
  VencimientoRenovacionContratoDto,
  tonePorDiasFaltantesNotificacion as tonePorDiasFaltantes,
} from 'src/app/services/moduleService/notificaciones.service';
import { formatearFecha, diasRestantesCalendarioApi } from 'src/app/pages/inmuebles/inmuebles-list.mapper';
import { LoginSuccessSoundService } from 'src/app/services/login-success-sound.service';
import { AppThemeMode, ThemeService } from 'src/app/services/theme.service';

/** Rutas mostradas en Panel de accesos para ítems que en sidebar usan `/menu-level`. */
const PANEL_ROUTE_FOR_MENU_LEVEL: Record<string, string> = {
  Administración: '/modulos',
  Prospectos: '/prospectos',
  Clientes: '/clientes',
  Usuarios: '/usuarios',
  Roles: '/roles',
  Catálogos: '/clientes',
};

/** Texto secundario del Panel de accesos (no mostrar rutas). */
const PANEL_SUBTEXT_BY_DISPLAY_NAME: Record<string, string> = {
  Administración: 'Configuración general del sistema y gestión de módulos.',
  Usuarios: 'Alta, edición y control de usuarios del sistema.',
  Prospectos: 'Alta, edición y consulta de prospectos.',
  Clientes: 'Alta, edición y consulta de clientes.',
  Embudo: 'Seguimiento del embudo de ventas de prospectos.',
  'Generar Contrato': 'Captura y genera el contrato de subarrendamiento en PDF.',
  Roles: 'Definición de permisos y niveles de acceso.',
  Bitácora: 'Consulta del historial de movimientos del sistema.',
  Propiedades: 'Monitoreo geográfico de arrendadores e inmuebles.',
  'Lista Arrendadores': 'Consulta y administración de arrendadores registrados.',
  'Lista Inmuebles': 'Consulta y administración del catálogo de inmuebles.',
  Arrendatarios: 'Gestión de arrendatarios, pagos del mes e histórico.',
  'Rent Rol': 'Consulta del rent roll de arrendatarios.',
  'Servicios Inmuebles': 'Registro y seguimiento de servicios por inmueble.',
  'Servicios Arrendatarios': 'Registro y seguimiento de servicios por arrendatario.',
  'Perfil Usuario': 'Configuración y actualización de tu información personal.',
};

const PANEL_SUBTEXT_FALLBACK = 'Acceso rápido a este módulo del sistema.';

function panelSubtextFor(item: NavItem): string {
  const byName = item.displayName
    ? PANEL_SUBTEXT_BY_DISPLAY_NAME[item.displayName]
    : undefined;
  const custom = typeof item.subtext === 'string' ? item.subtext.trim() : '';
  if (byName) return byName;
  if (custom && !custom.startsWith('/')) return custom;
  return PANEL_SUBTEXT_FALLBACK;
}

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
    const subtext = panelSubtextFor(item);
    out.push({ ...item, route, subtext });
  }
  return out;
}

type NotifTone = 'success' | 'warning' | 'amber' | 'danger' | 'expired';

type NotifTabId = 'contratos' | 'servicios' | 'arrendatarios';

/** Fila del centro de notificaciones (las tres bandejas comparten forma). */
interface NotifItem {
  id: string;
  tone: NotifTone;
  title: string;
  subtitle: string;
  subtitleIcon: string;
  fechaLabel: string;
  /** Texto de la franja del mini calendario según el estado (Venció / Hoy / Vence…). */
  calHead: string;
  fechaIso?: string | null;
  fecha: string;
  fechaDia: string;
  fechaMes: string;
  fechaAnio: string;
  contrato?: string;
  dias: number | null;
  statusText: string;
}

interface NotifTab {
  id: NotifTabId;
  label: string;
  icon: string;
  items: NotifItem[];
}

interface NotifResumen {
  vencidos: number;
  urgentes: number;
  proximos: number;
  alDia: number;
  total: number;
}

const NOTIF_TONE_ORDER: Record<NotifTone, number> = {
  expired: 0,
  danger: 1,
  amber: 2,
  warning: 3,
  success: 4,
};

const NOTIF_MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

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
export class HeaderComponent implements OnInit {
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

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private settings: CoreService,
    public dialog: MatDialog,
    private translate: TranslateService,
    private users: AuthenticationService,
    private router: Router,
    private notificacionesService: NotificacionesService,
    public loginSuccessSound: LoginSuccessSoundService,
    private themeService: ThemeService,
  ) {
    this.options = this.settings.getOptions();
    const user = this.users.getUser();
    this.showNombre = user?.nombre;
    this.showApellidoPaterno = user?.apellidoPaterno || '';
    this.showApellidoMaterno = user?.apellidoMaterno || '';
    this.showRol = user?.rolNombre;
    this.showEmail = user?.userName;
    translate.setDefaultLang('en');
  }

  /** Alias para plantilla: resaltado post-login. */
  readonly notifLoginSpotlight = this.loginSuccessSound.highlightNotificaciones;

  ngOnInit(): void {
    this.cargarNotificaciones(true);
    this.notificacionesService.refrescar$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cargarNotificaciones(false));
  }

  private cargarNotificaciones(avisarLoginSound: boolean): void {
    this.notificacionesService.obtenerNotificaciones().subscribe({
      next: (data) => {
        this.aplicarNotificacionesDesdeApi(data);
        if (avisarLoginSound) {
          this.loginSuccessSound.notificacionesCargadas(this.totalNotificaciones > 0);
        }
      },
      error: (err) => {
        console.error('[notificaciones]', err);
        this.aplicarNotificacionesDesdeApi({
          vencimientosRenovacionesContrato: [],
          pagoServiciosInmuebles: [],
          pagosSeguimiento: [],
        });
        if (avisarLoginSound) {
          this.loginSuccessSound.notificacionesCargadas(false);
        }
      },
    });
  }

  private aplicarNotificacionesDesdeApi(data: NotificacionesResponse): void {
    const v = data.vencimientosRenovacionesContrato ?? [];
    const p = data.pagoServiciosInmuebles ?? [];
    const s = data.pagosSeguimiento ?? [];

    const tabs: NotifTab[] = [
      {
        id: 'contratos',
        label: 'Contratos',
        icon: 'file-description',
        items: this.ordenarPorUrgencia(v.map((item) => this.mapVencimiento(item))),
      },
      {
        id: 'servicios',
        label: 'Servicios',
        icon: 'receipt',
        items: this.ordenarPorUrgencia(p.map((item) => this.mapPagoServicio(item))),
      },
      {
        id: 'arrendatarios',
        label: 'Arrendatarios',
        icon: 'users',
        items: this.ordenarPorUrgencia(s.map((item) => this.mapSeguimiento(item))),
      },
    ];

    this.notifTabs = tabs;
    this.totalNotificaciones = tabs.reduce((acc, t) => acc + t.items.length, 0);
    this.resumenPorTab = {
      contratos: this.calcularResumen(tabs[0].items),
      servicios: this.calcularResumen(tabs[1].items),
      arrendatarios: this.calcularResumen(tabs[2].items),
    };
    this.tonoMasUrgente = this.calcularTonoMasUrgente(tabs.flatMap((t) => t.items));
  }

  private mapVencimiento(v: VencimientoRenovacionContratoDto): NotifItem {
    const dias = this.diasFaltantesEfectivos(v.diasFaltantes, v.fechaTerminoContrato);
    return this.construirItem({
      id: `c-${v.id}`,
      tone: this.toneDesdeColorApi(v.color, dias),
      dias,
      title: String(v.inmueble ?? '').trim() || 'Inmueble',
      subtitle: String(v.arrendatario ?? '').trim() || 'Sin arrendatario',
      subtitleIcon: 'user',
      fechaLabel: 'Término',
      fechaIso: v.fechaTerminoContrato,
    });
  }

  private mapPagoServicio(p: PagoServicioInmuebleDto): NotifItem {
    const dias = this.diasFaltantesEfectivos(p.diasFaltantes, p.fechaPago);
    return this.construirItem({
      id: `s-${p.id}`,
      tone: this.toneDesdeColorApi(p.color, dias),
      dias,
      title: String(p.tipoServicio ?? '').trim() || 'Servicio',
      subtitle: String(p.inmueble ?? '').trim() || 'Sin inmueble',
      subtitleIcon: 'building',
      fechaLabel: 'Pago',
      fechaIso: p.fechaPago,
      contrato: String(p.numeroContrato ?? '').trim() || undefined,
    });
  }

  private mapSeguimiento(s: PagoSeguimientoDto): NotifItem {
    const dias = this.diasFaltantesEfectivos(s.diasFaltantes, s.fechaPago);
    return this.construirItem({
      id: `a-${s.id}`,
      tone: this.toneDesdeColorApi(s.color, dias),
      dias,
      title: String(s.tipoServicio ?? '').trim() || 'Servicio',
      subtitle: String(s.arrendatario ?? '').trim() || 'Arrendatario',
      subtitleIcon: 'user',
      fechaLabel: 'Pago',
      fechaIso: s.fechaPago,
      contrato: String(s.numeroContrato ?? '').trim() || undefined,
    });
  }

  private construirItem(
    base: Omit<NotifItem, 'fecha' | 'fechaDia' | 'fechaMes' | 'fechaAnio' | 'statusText' | 'calHead'>,
  ): NotifItem {
    const { dias } = base;
    const esPago = base.fechaLabel === 'Pago';
    let statusText = 'Sin fecha';
    let calHead = base.fechaLabel;

    if (dias != null && Number.isFinite(dias)) {
      if (dias < 0) {
        const n = Math.abs(dias);
        statusText = n === 1 ? 'Vencido hace 1 día' : `Vencido hace ${n} días`;
        calHead = esPago ? 'Vencido' : 'Venció';
      } else if (dias === 0) {
        statusText = 'Vence hoy';
        calHead = 'Hoy';
      } else {
        statusText = dias === 1 ? 'Vence mañana' : `Faltan ${dias} días`;
        calHead = esPago ? 'Pagar' : 'Vence';
      }
    }

    const fecha = this.formatNotifyDate(base.fechaIso);
    return { ...base, ...this.partesFecha(fecha), fecha, statusText, calHead };
  }

  /** Día, mes abreviado y año (desde `dd/mm/aaaa`) para el mini calendario de la tarjeta. */
  private partesFecha(fecha: string): Pick<NotifItem, 'fechaDia' | 'fechaMes' | 'fechaAnio'> {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha);
    if (!m) return { fechaDia: '—', fechaMes: '', fechaAnio: '' };
    return { fechaDia: m[1], fechaMes: NOTIF_MESES[Number(m[2]) - 1] ?? '', fechaAnio: m[3] };
  }

  private ordenarPorUrgencia(items: NotifItem[]): NotifItem[] {
    return [...items].sort((a, b) => {
      const byTone = NOTIF_TONE_ORDER[a.tone] - NOTIF_TONE_ORDER[b.tone];
      if (byTone !== 0) return byTone;
      return (a.dias ?? Number.MAX_SAFE_INTEGER) - (b.dias ?? Number.MAX_SAFE_INTEGER);
    });
  }

  private calcularResumen(items: NotifItem[]): NotifResumen {
    const r: NotifResumen = { vencidos: 0, urgentes: 0, proximos: 0, alDia: 0, total: items.length };
    for (const it of items) {
      if (it.tone === 'expired') r.vencidos++;
      else if (it.tone === 'danger') r.urgentes++;
      else if (it.tone === 'success') r.alDia++;
      else r.proximos++;
    }
    return r;
  }

  private calcularTonoMasUrgente(items: NotifItem[]): NotifTone | null {
    if (!items.length) return null;
    return items.reduce<NotifTone>(
      (peor, it) => (NOTIF_TONE_ORDER[it.tone] < NOTIF_TONE_ORDER[peor] ? it.tone : peor),
      'success',
    );
  }

  get tabActual(): NotifTab | undefined {
    return this.notifTabs.find((t) => t.id === this.notifTabActiva);
  }

  get resumenActual(): NotifResumen {
    return this.resumenPorTab[this.notifTabActiva];
  }

  seleccionarNotifTab(id: NotifTabId): void {
    this.notifTabActiva = id;
  }

  /** Al abrir el panel, si la pestaña actual está vacía salta a la primera con avisos. */
  onNotificacionesAbiertas(): void {
    if (this.tabActual?.items.length) return;
    const conItems = this.notifTabs.find((t) => t.items.length > 0);
    if (conItems) this.notifTabActiva = conItems.id;
  }

  porcentajeResumen(valor: number): number {
    const total = this.resumenActual.total;
    return total ? (valor / total) * 100 : 0;
  }

  /**
   * Prioriza el día de calendario de la fecha del API (0 = vence hoy).
   * Evita que un `diasFaltantes: 1` inclusivo del backend diga «Días: 1» el día del término.
   */
  private diasFaltantesEfectivos(
    diasApi: unknown,
    fechaIso?: string | null,
  ): number | null {
    const calc = diasRestantesCalendarioApi(fechaIso);
    if (calc != null) return calc;
    const d = Number(diasApi);
    return Number.isFinite(d) ? d : null;
  }

  /**
   * Semáforo para las tres bandejas (vencimientos, pagos servicio, seguimiento).
   * <0 → expired, ≤2 → rojo, ≤6 → amarillo, ≤15 → naranja, resto → verde.
   */
  private tonePorDiasFaltantesNotificacion(
    dias: number | undefined | null,
  ): 'success' | 'warning' | 'amber' | 'danger' | 'expired' {
    return tonePorDiasFaltantes(dias);
  }

  /**
   * Usa el `color` del API (rojo / amarillo / naranja / verde).
   * Si ya venció (días &lt; 0) prioriza `expired`. Sin color válido, cae al semáforo por días.
   */
  private toneDesdeColorApi(
    color: string | undefined | null,
    dias: number | null,
  ): 'success' | 'warning' | 'amber' | 'danger' | 'expired' {
    if (dias != null && dias < 0) return 'expired';
    const c = String(color ?? '').trim().toLowerCase();
    switch (c) {
      case 'rojo':
      case 'danger':
      case 'red':
        return 'danger';
      case 'amarillo':
      case 'amber':
      case 'yellow':
        return 'amber';
      case 'naranja':
      case 'orange':
      case 'warning':
        return 'warning';
      case 'verde':
      case 'green':
      case 'success':
        return 'success';
      default:
        return this.tonePorDiasFaltantesNotificacion(dias);
    }
  }

  private formatNotifyDate(iso: string | undefined | null): string {
    const fmt = formatearFecha(iso ?? undefined);
    return fmt || '—';
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

  /** Muestra u oculta el botón sol/luna del header (true = visible). */
  mostrarToggleTema = true;

  setlightDark(theme: string) {
    const mode: AppThemeMode = theme === 'light' ? 'light' : 'dark';
    void this.themeService.setTheme(mode).then(() => {
      this.options = this.settings.getOptions();
      this.emitOptions();
    });
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

  /** Pie del menú Contratos: lista completa de contratos. */
  verTodoAvisos(): void {
    void this.router.navigate(['/contratos']);
  }

  /** Pie del menú Inmuebles: listado de inmuebles (pagos de servicios). */
  verTodoInmueblesNotif(): void {
    void this.router.navigate(['/inmuebles']);
  }

  /** Pie del menú Arrendatarios: listado de arrendatarios. */
  verTodoArrendatariosNotif(): void {
    void this.router.navigate(['/arrendatarios']);
  }

  /** Centro de notificaciones (se llena desde GET /notificaciones). */
  notifTabs: NotifTab[] = [];
  notifTabActiva: NotifTabId = 'contratos';
  totalNotificaciones = 0;
  tonoMasUrgente: NotifTone | null = null;
  resumenPorTab: Record<NotifTabId, NotifResumen> = {
    contratos: { vencidos: 0, urgentes: 0, proximos: 0, alDia: 0, total: 0 },
    servicios: { vencidos: 0, urgentes: 0, proximos: 0, alDia: 0, total: 0 },
    arrendatarios: { vencidos: 0, urgentes: 0, proximos: 0, alDia: 0, total: 0 },
  };

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
