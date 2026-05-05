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
    idInmueble: 201,
    nombreInmueble: 'Corporativo Pirámide',
    direccion: 'Río Balsas 106, Vista Hermosa, 62290 Cuernavaca, Mor.',
    arrendador: 'Inmuebles y Desarrollos HAC S.A de C.V.',
    locales: [
      // 🔹 Planta baja
      {
        idLocal: 3001,
        nombreLocal: 'Local PB-01',
        nivel: 'Planta baja',
        superficieM2: 110,
        estado: 'ocupado',
        giroActividad: 'Laboratorio clínico',
        mensualidadMxn: 38000,
        vigenciaHasta: '2028-03-20',
        arrendatario: 'Laboratorios Chopo',
        arrendador: 'Inmuebles y Desarrollos HAC S.A de C.V.',
        numeroContrato: 'HAC-CH-001',
        correoContacto: 'contacto@chopo.com.mx',
        telefonoContacto: '7771112233',
      },
      {
        idLocal: 3002,
        nombreLocal: 'Local PB-02',
        nivel: 'Planta baja',
        superficieM2: 90,
        estado: 'ocupado',
        giroActividad: 'Educación / Idiomas',
        mensualidadMxn: 25000,
        vigenciaHasta: '2027-08-15',
        arrendatario: 'Inglés Individual',
        arrendador: 'Inmuebles y Desarrollos HAC S.A de C.V.',
        numeroContrato: 'HAC-II-002',
        correoContacto: 'info@inglesindividual.com',
        telefonoContacto: '7772223344',
      },

      // 🔹 Segundo piso
      {
        idLocal: 3003,
        nombreLocal: 'Local P2-01',
        nivel: 'Segundo piso',
        superficieM2: 70,
        estado: 'ocupado',
        giroActividad: 'Consultorios médicos',
        mensualidadMxn: 20000,
        vigenciaHasta: '2026-12-10',
        arrendatario: 'Clínica Médica Integral',
        arrendador: 'Inmuebles y Desarrollos HAC S.A de C.V.',
        numeroContrato: 'HAC-MED-003',
        correoContacto: 'contacto@clinicaintegral.mx',
        telefonoContacto: '7773334455',
      },
      {
        idLocal: 3004,
        nombreLocal: 'Local P2-02',
        nivel: 'Segundo piso',
        superficieM2: 130,
        estado: 'ocupado',
        giroActividad: 'Oficinas gubernamentales',
        mensualidadMxn: 42000,
        vigenciaHasta: '2029-05-01',
        arrendatario: 'Poder Judicial del Estado',
        arrendador: 'Inmuebles y Desarrollos HAC S.A de C.V.',
        numeroContrato: 'HAC-PJ-004',
        correoContacto: 'oficialia@poderjudicial.gob.mx',
        telefonoContacto: '7774445566',
      }
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
