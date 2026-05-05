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
    nombreInmueble: 'San Cristóbal',
    direccion: 'C. San Cristóbal 4, San Cristobal, 62250 Cuernavaca, Mor.',
    arrendador: 'Inmuebles y Desarrollos HAC S.A de C.V.',
    locales: [
      // 🔹 NIVEL 1 (Planta baja)
      {
        idLocal: 3001,
        nombreLocal: 'Local PB-01',
        nivel: 'Planta baja',
        superficieM2: 95,
        estado: 'ocupado',
        giroActividad: 'Alimentos / Pizzería',
        mensualidadMxn: 32000,
        vigenciaHasta: '2027-11-30',
        arrendatario: 'Little Caesars',
        arrendador: 'Inmuebles y Desarrollos HAC S.A de C.V.',
        numeroContrato: 'HAC-LC-001',
        correoContacto: 'sucursales@littlecaesars.com.mx',
        telefonoContacto: '7772103344',
      },
      {
        idLocal: 3002,
        nombreLocal: 'Local PB-02',
        nivel: 'Planta baja',
        superficieM2: 120,
        estado: 'ocupado',
        giroActividad: 'Farmacia / Salud',
        mensualidadMxn: 45000,
        vigenciaHasta: '2028-06-15',
        arrendatario: 'Farmacia San Pablo',
        arrendador: 'Inmuebles y Desarrollos HAC S.A de C.V.',
        numeroContrato: 'HAC-FSP-002',
        correoContacto: 'contacto@farmaciasanpablo.com.mx',
        telefonoContacto: '7773458899',
      },

      // 🔹 NIVEL 2
      {
        idLocal: 3003,
        nombreLocal: 'Local P2-01',
        nivel: 'Segundo piso',
        superficieM2: 80,
        estado: 'ocupado',
        giroActividad: 'Joyería y catálogo',
        mensualidadMxn: 22000,
        vigenciaHasta: '2026-09-10',
        arrendatario: 'Joyerías Nice',
        arrendador: 'Inmuebles y Desarrollos HAC S.A de C.V.',
        numeroContrato: 'HAC-NICE-003',
        correoContacto: 'ventas@nice.com.mx',
        telefonoContacto: '7774567788',
      },
      {
        idLocal: 3004,
        nombreLocal: 'Local P2-02',
        nivel: 'Segundo piso',
        superficieM2: 140,
        estado: 'ocupado',
        giroActividad: 'Telecomunicaciones',
        mensualidadMxn: 38000,
        vigenciaHasta: '2029-02-01',
        arrendatario: 'Spring Telecom México',
        arrendador: 'Inmuebles y Desarrollos HAC S.A de C.V.',
        numeroContrato: 'HAC-ST-004',
        correoContacto: 'contacto@springtelecom.mx',
        telefonoContacto: '7775679900',
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
        nombreInmueble: 'San Cristóbal',
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
