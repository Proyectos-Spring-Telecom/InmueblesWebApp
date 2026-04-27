export interface ArrendatarioLocalDemo {
  idLocal: number;
  nombreLocal: string;
  nivel: string;
  superficieM2: number;
  estado: 'ocupado' | 'libre' | 'reservado';
  giroActividad: string;
  mensualidadMxn: number;
  vigenciaHasta: string;
  arrendatario: string;
  arrendador: string;
  numeroContrato: string;
  correoContacto: string;
  telefonoContacto: string;
}

export interface InmuebleArrendatariosDemo {
  idInmueble: number;
  nombreInmueble: string;
  direccion: string;
  arrendador: string;
  locales: ArrendatarioLocalDemo[];
}

export interface ArrendatarioFormDemo {
  id: number;
  razonSocial: string;
  nombreComercial: string;
  rfc: string;
  correo: string;
  telefono: string;
  giroPrincipal: string;
  arrendador: string;
  observaciones: string;
  locales: Array<{
    idLocal: number;
    nombreLocal: string;
    idInmueble: number;
    nombreInmueble: string;
    nivel: string;
    superficieM2: number;
    mensualidadMxn: number;
    fechaInicio: string;
    fechaTermino: string;
    estatusContrato: 'vigente' | 'por vencer' | 'vencido';
  }>;
}

export interface ArrendatarioTreeRow {
  id: string;
  parentId: string | null;
  tipoNodo: 'inmueble' | 'local';
  inmueble: string;
  local: string;
  arrendatario: string;
  arrendador: string;
  nivel: string;
  superficieM2: number | null;
  mensualidad: number | null;
  vigencia: string;
  estadoLocal: string;
}

export interface ArrendatarioLocalGridRow {
  idLocal: number;
  inmueble: string;
  local: string;
  nivel: string;
  superficieM2: number;
  estado: ArrendatarioLocalDemo['estado'];
  giroActividad: string;
  mensualidadMxn: number;
  vigenciaHasta: string;
  numeroContrato: string;
  arrendatario: string;
  arrendador: string;
  correoContacto: string;
  telefonoContacto: string;
}

export const INMUEBLES_ARRENDATARIOS_DEMO: InmuebleArrendatariosDemo[] = [
  {
    idInmueble: 101,
    nombreInmueble: 'Corporativo Pirámide',
    direccion: 'Insurgentes Sur 1458, CDMX',
    arrendador: 'Desarrollo Inmobiliario BHV SA de CV',
    locales: [
      {
        idLocal: 1001,
        nombreLocal: 'Local PB-01',
        nivel: 'Planta baja',
        superficieM2: 92,
        estado: 'ocupado',
        giroActividad: 'Retail de moda',
        mensualidadMxn: 42750,
        vigenciaHasta: '2028-01-14',
        arrendatario: 'Santory',
        arrendador: 'Desarrollo Inmobiliario BHV SA de CV',
        numeroContrato: 'PC-BHV-001',
        correoContacto: 'operaciones@santory.mx',
        telefonoContacto: '5512345678',
      },
      {
        idLocal: 1002,
        nombreLocal: 'Local PB-02',
        nivel: 'Planta baja',
        superficieM2: 128.5,
        estado: 'ocupado',
        giroActividad: 'Servicios financieros',
        mensualidadMxn: 59780,
        vigenciaHasta: '2027-09-30',
        arrendatario: 'Spring Telecom México',
        arrendador: 'Desarrollo Inmobiliario BHV SA de CV',
        numeroContrato: 'PC-BHV-014',
        correoContacto: 'administracion@springtelecom.mx',
        telefonoContacto: '5587654321',
      },
      {
        idLocal: 1003,
        nombreLocal: 'Local P1-07',
        nivel: 'Piso 1',
        superficieM2: 75,
        estado: 'reservado',
        giroActividad: 'Coworking',
        mensualidadMxn: 31900,
        vigenciaHasta: '2026-11-15',
        arrendatario: 'Reservado',
        arrendador: 'Desarrollo Inmobiliario BHV SA de CV',
        numeroContrato: 'Pendiente',
        correoContacto: 'pendiente@cliente.com',
        telefonoContacto: '5500000000',
      },
    ],
  },
  {
    idInmueble: 102,
    nombreInmueble: 'Torre Oriente',
    direccion: 'Av. Universidad 450, CDMX',
    arrendador: 'Fideicomiso Torre Oriente',
    locales: [
      {
        idLocal: 2001,
        nombreLocal: 'Local T2-03',
        nivel: 'Piso 2',
        superficieM2: 110,
        estado: 'ocupado',
        giroActividad: 'Consultoría TI',
        mensualidadMxn: 50200,
        vigenciaHasta: '2029-04-20',
        arrendatario: 'Nexo Digital Consulting',
        arrendador: 'Fideicomiso Torre Oriente',
        numeroContrato: 'TO-2024-088',
        correoContacto: 'contratos@nexodigital.mx',
        telefonoContacto: '5532167890',
      },
      {
        idLocal: 2002,
        nombreLocal: 'Local T3-01',
        nivel: 'Piso 3',
        superficieM2: 95,
        estado: 'libre',
        giroActividad: 'Disponible',
        mensualidadMxn: 0,
        vigenciaHasta: '-',
        arrendatario: 'Sin asignar',
        arrendador: 'Fideicomiso Torre Oriente',
        numeroContrato: '-',
        correoContacto: '-',
        telefonoContacto: '-',
      },
    ],
  },
];

export const ARRENDATARIOS_FORM_DEMO: ArrendatarioFormDemo[] = [
  {
    id: 1,
    razonSocial: 'Spring Telecom México SA de CV',
    nombreComercial: 'Spring Telecom México',
    rfc: 'STM240101AB1',
    correo: 'administracion@springtelecom.mx',
    telefono: '5587654321',
    giroPrincipal: 'Telecomunicaciones y tecnología',
    arrendador: 'Desarrollo Inmobiliario BHV SA de CV',
    observaciones: 'Cliente estratégico con opción de expansión a nuevos pisos.',
    locales: [
      {
        idLocal: 1002,
        nombreLocal: 'Local PB-02',
        idInmueble: 101,
        nombreInmueble: 'Corporativo Pirámide',
        nivel: 'Planta baja',
        superficieM2: 128.5,
        mensualidadMxn: 59780,
        fechaInicio: '2025-01-15',
        fechaTermino: '2027-09-30',
        estatusContrato: 'vigente',
      },
    ],
  },
];

function sumSuperficie(locales: ArrendatarioLocalDemo[]): number {
  return locales.reduce((s, l) => s + (l.superficieM2 ?? 0), 0);
}

function sumMensualidad(locales: ArrendatarioLocalDemo[]): number {
  return locales.reduce((s, l) => s + (l.mensualidadMxn ?? 0), 0);
}

function nivelesResumen(locales: ArrendatarioLocalDemo[]): string {
  const u = [...new Set(locales.map((l) => l.nivel).filter(Boolean))];
  return u.length ? u.join(' · ') : '—';
}

function vigenciaRangoInmueble(locales: ArrendatarioLocalDemo[]): string {
  const vals = locales.map((l) => l.vigenciaHasta).filter((v) => v && v !== '-');
  if (!vals.length) return '—';
  const sorted = [...vals].sort((a, b) => a.localeCompare(b));
  return sorted.length === 1 ? sorted[0] : `${sorted[0]} – ${sorted[sorted.length - 1]}`;
}

function estadoResumenInmueble(locales: ArrendatarioLocalDemo[]): string {
  const o = locales.filter((l) => l.estado === 'ocupado').length;
  const r = locales.filter((l) => l.estado === 'reservado').length;
  const i = locales.filter((l) => l.estado === 'libre').length;
  return `${o} ocup. · ${r} reserv. · ${i} libre`;
}

function arrendatariosResumen(locales: ArrendatarioLocalDemo[]): string {
  const names = [...new Set(locales.map((l) => l.arrendatario).filter(Boolean))];
  if (names.length <= 2) return names.join(' · ');
  return `${names[0]} · ${names[1]} · +${names.length - 2}`;
}

export function buildArrendatariosTreeRows(): ArrendatarioTreeRow[] {
  const rows: ArrendatarioTreeRow[] = [];
  INMUEBLES_ARRENDATARIOS_DEMO.forEach((inmueble) => {
    const inmuebleId = `inmueble-${inmueble.idInmueble}`;
    const L = inmueble.locales;
    rows.push({
      id: inmuebleId,
      parentId: null,
      tipoNodo: 'inmueble',
      inmueble: inmueble.nombreInmueble,
      local: `${L.length} ${L.length === 1 ? 'local' : 'locales'}`,
      arrendatario: arrendatariosResumen(L),
      arrendador: inmueble.arrendador,
      nivel: nivelesResumen(L),
      superficieM2: Math.round(sumSuperficie(L) * 100) / 100,
      mensualidad: sumMensualidad(L),
      vigencia: vigenciaRangoInmueble(L),
      estadoLocal: estadoResumenInmueble(L),
    });
    L.forEach((local) => {
      rows.push({
        id: `local-${local.idLocal}`,
        parentId: inmuebleId,
        tipoNodo: 'local',
        inmueble: inmueble.nombreInmueble,
        local: local.nombreLocal,
        arrendatario: local.arrendatario,
        arrendador: local.arrendador,
        nivel: local.nivel,
        superficieM2: local.superficieM2,
        mensualidad: local.mensualidadMxn,
        vigencia: local.vigenciaHasta,
        estadoLocal: local.estado.charAt(0).toUpperCase() + local.estado.slice(1),
      });
    });
  });
  return rows;
}

export function buildArrendatariosLocalesRows(): ArrendatarioLocalGridRow[] {
  return INMUEBLES_ARRENDATARIOS_DEMO.flatMap((inmueble) =>
    inmueble.locales.map((local) => ({
      idLocal: local.idLocal,
      inmueble: inmueble.nombreInmueble,
      local: local.nombreLocal,
      nivel: local.nivel,
      superficieM2: local.superficieM2,
      estado: local.estado,
      giroActividad: local.giroActividad,
      mensualidadMxn: local.mensualidadMxn,
      vigenciaHasta: local.vigenciaHasta,
      numeroContrato: local.numeroContrato,
      arrendatario: local.arrendatario,
      arrendador: local.arrendador,
      correoContacto: local.correoContacto,
      telefonoContacto: local.telefonoContacto,
    })),
  );
}
