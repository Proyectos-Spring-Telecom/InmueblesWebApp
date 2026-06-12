import { Component, OnInit } from '@angular/core';
import { routeAnimation } from 'src/app/pipe/module-open.animation';

export interface Arrendatario {
  nombre: string;
  nota?: string;
  piso: string;
  modulo: string;
  m2: number;
  precioM2: number;
  inicioContrato: string;
  finContrato: string;
  estatus: 'aldia' | 'cambio' | 'finanzas' | 'incremento';
}

@Component({
  selector: 'app-rent-rol',
  templateUrl: './rent-rol.component.html',
  styleUrl: './rent-rol.component.scss',
  standalone: false,
  animations: [routeAnimation],
})
export class RentRolComponent implements OnInit {

  periodoLabel = 'Febrero 2025';
  readonly IVA = 0.16;
  readonly PORCENTAJE_MANT = 0.10;
  readonly REGISTROS_POR_PAGINA = 50;

  paginaActual$ = 1;

  estatusLabel: Record<string, string> = {
    aldia: 'Al día',
    cambio: 'Cambios',
    finanzas: 'Finanzas',
    incremento: 'Incremento',
  };

  arrendatarios: Arrendatario[] = [
    {
      nombre: 'Barona Lavín Alberto Javier',
      nota: '(Notaría 14) JUN 25-ADELANTE',
      piso: '6to', modulo: '"A1"',
      m2: 155, precioM2: 221.81,
      inicioContrato: '01 Dic 2024', finContrato: '30 Nov 2025',
      estatus: 'aldia',
    },
    {
      nombre: 'Barona Lavín Alberto Javier',
      nota: '(Notaría 14)',
      piso: '6to', modulo: '"A" es "B1"',
      m2: 258.22, precioM2: 233.72,
      inicioContrato: '01 Dic 2023', finContrato: '30 Nov 2026',
      estatus: 'aldia',
    },
    {
      nombre: 'Corporativo Jaceved SA de CV',
      nota: '(Royal Prestige)',
      piso: '6to', modulo: '"C"',
      m2: 154, precioM2: 203.56,
      inicioContrato: '01 Feb 2023', finContrato: '01 Feb 2028',
      estatus: 'cambio',
    },
    {
      nombre: 'Emilio Porter Gómez / Moment',
      nota: '(Marqueting)',
      piso: '5to', modulo: 'No.1',
      m2: 83.44, precioM2: 444.35,
      inicioContrato: '01 Jul 2023', finContrato: '20 Jun 2024',
      estatus: 'finanzas',
    },
    {
      nombre: 'Petroliferos Lobo',
      nota: '1era renta hasta feb',
      piso: '4to', modulo: 'B',
      m2: 246.91, precioM2: 239.32,
      inicioContrato: '08 Nov 2024', finContrato: '07 Nov 2027',
      estatus: 'incremento',
    },
    {
      nombre: 'MR Lana',
      nota: 'Dic a mayo — baja a 30,000 + IVA',
      piso: '3er', modulo: 'B',
      m2: 200, precioM2: 150.00,
      inicioContrato: '01 Ago 2023', finContrato: '20 May 2025',
      estatus: 'cambio',
    },
    {
      nombre: 'Apex Operadora de Proyectos Empresariales',
      nota: 'Nuevo',
      piso: '3er', modulo: '"A"',
      m2: 90, precioM2: 200.00,
      inicioContrato: '16 Ago 2024', finContrato: '15 Ago 2025',
      estatus: 'aldia',
    },
  ];

  // ── Paginación ────────────────────────────────────────────────
  get totalPaginas(): number {
    return Math.ceil(this.arrendatarios.length / this.REGISTROS_POR_PAGINA);
  }

  get paginaInicio(): number {
    return (this.paginaActual$ - 1) * this.REGISTROS_POR_PAGINA;
  }

  get paginaFin(): number {
    return Math.min(this.paginaInicio + this.REGISTROS_POR_PAGINA, this.arrendatarios.length);
  }

  get paginaActual(): Arrendatario[] {
    return this.arrendatarios.slice(this.paginaInicio, this.paginaFin);
  }

  get paginas(): number[] {
    const total = this.totalPaginas;
    const actual = this.paginaActual$;
    const delta = 2;
    const range: number[] = [];

    for (let i = Math.max(2, actual - delta); i <= Math.min(total - 1, actual + delta); i++) {
      range.push(i);
    }

    if (actual - delta > 2) range.unshift(-1);
    if (actual + delta < total - 1) range.push(-1);

    range.unshift(1);
    if (total > 1) range.push(total);

    return [...new Set(range)];
  }

  irPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas) {
      this.paginaActual$ = p;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  anterior():  void { this.irPagina(this.paginaActual$ - 1); }
  siguiente(): void { this.irPagina(this.paginaActual$ + 1); }
  irPrimera(): void { this.irPagina(1); }
  irUltima():  void { this.irPagina(this.totalPaginas); }

  // ── Cálculos Renta ────────────────────────────────────────────
  calcSubtotal(m2: number, pm2: number): number {
    return Math.round(m2 * pm2 * 100) / 100;
  }
  calcIva(m2: number, pm2: number): number {
    return Math.round(this.calcSubtotal(m2, pm2) * this.IVA * 100) / 100;
  }
  calcTotal(m2: number, pm2: number): number {
    return Math.round((this.calcSubtotal(m2, pm2) + this.calcIva(m2, pm2)) * 100) / 100;
  }

  // ── Cálculos Mantto ───────────────────────────────────────────
  calcSubtotalMant(m2: number, pm2: number): number {
    return Math.round(this.calcSubtotal(m2, pm2) * this.PORCENTAJE_MANT * 100) / 100;
  }
  calcIvaMant(m2: number, pm2: number): number {
    return Math.round(this.calcSubtotalMant(m2, pm2) * this.IVA * 100) / 100;
  }
  calcTotalMant(m2: number, pm2: number): number {
    return Math.round((this.calcSubtotalMant(m2, pm2) + this.calcIvaMant(m2, pm2)) * 100) / 100;
  }

  // ── Totales globales ──────────────────────────────────────────
  get totalRenta(): number {
    return Math.round(this.arrendatarios.reduce((s, a) => s + this.calcSubtotal(a.m2, a.precioM2), 0) * 100) / 100;
  }
  get totalIvaRenta(): number {
    return Math.round(this.totalRenta * this.IVA * 100) / 100;
  }
  get totalRentaConIva(): number {
    return Math.round((this.totalRenta + this.totalIvaRenta) * 100) / 100;
  }
  get totalMantto(): number {
    return Math.round(this.totalRenta * this.PORCENTAJE_MANT * 100) / 100;
  }
  get totalIvaMantto(): number {
    return Math.round(this.totalMantto * this.IVA * 100) / 100;
  }
  get totalManttoConIva(): number {
    return Math.round((this.totalMantto + this.totalIvaMantto) * 100) / 100;
  }
  get granTotal(): number {
    return Math.round((this.totalRentaConIva + this.totalManttoConIva) * 100) / 100;
  }

  ngOnInit(): void {
    // this.rentRolService.getArrendatarios().subscribe(data => this.arrendatarios = data);
  }
}