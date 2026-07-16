/** Lógica de captura rápida Rent-rol (reutiliza reglas de agregar-arrendatario / inmueble). */

export const RENT_ROL_IVA = 0.16;

export interface RentRolSelectOpcion {
  id: number;
  label: string;
}

export interface RentRolLocalOpcion {
  id: number;
  nombre: string;
  etiqueta: string;
}

export interface RentRolMontosConcepto {
  subTotal: number;
  iva: number;
  total: number;
  listo: boolean;
}

export interface RentRolMontosPreview {
  renta: RentRolMontosConcepto;
  mantenimiento: RentRolMontosConcepto;
  granTotal: number;
}

export function redondearMontoRentRol(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function calcularMontosRentRolCaptura(input: {
  metros: unknown;
  costoM2: unknown;
  incluyeMantenimiento: boolean;
  pctMantenimiento: unknown;
}): RentRolMontosPreview {
  const metros = Number(input.metros);
  const costo = Number(input.costoM2);
  const metrosOk = Number.isFinite(metros) && metros > 0;
  const costoOk = Number.isFinite(costo) && costo > 0;

  let renta: RentRolMontosConcepto = { subTotal: 0, iva: 0, total: 0, listo: false };
  if (metrosOk && costoOk) {
    const subTotal = redondearMontoRentRol(metros * costo);
    const iva = redondearMontoRentRol(subTotal * RENT_ROL_IVA);
    renta = {
      subTotal,
      iva,
      total: redondearMontoRentRol(subTotal + iva),
      listo: true,
    };
  }

  let mantenimiento: RentRolMontosConcepto = { subTotal: 0, iva: 0, total: 0, listo: false };
  const pct = Number(input.pctMantenimiento);
  if (renta.listo && input.incluyeMantenimiento && Number.isFinite(pct) && pct > 0) {
    const subTotal = redondearMontoRentRol(renta.subTotal * (pct / 100));
    const iva = redondearMontoRentRol(subTotal * RENT_ROL_IVA);
    mantenimiento = {
      subTotal,
      iva,
      total: redondearMontoRentRol(subTotal + iva),
      listo: true,
    };
  }

  return {
    renta,
    mantenimiento,
    granTotal: redondearMontoRentRol(renta.total + mantenimiento.total),
  };
}

function numJson(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function extraerFilasApi(resp: unknown): Record<string, unknown>[] {
  if (resp == null) return [];
  if (Array.isArray(resp)) {
    return resp.filter(
      (x): x is Record<string, unknown> =>
        x != null && typeof x === 'object' && !Array.isArray(x),
    );
  }
  if (typeof resp !== 'object') return [];
  const r = resp as Record<string, unknown>;
  const data = r['data'];
  if (Array.isArray(data)) {
    return data.filter(
      (x): x is Record<string, unknown> =>
        x != null && typeof x === 'object' && !Array.isArray(x),
    );
  }
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    const bag = data as Record<string, unknown>;
    const nested = bag['items'] ?? bag['rows'] ?? bag['content'] ?? bag['data'];
    if (Array.isArray(nested)) {
      return nested.filter(
        (x): x is Record<string, unknown> =>
          x != null && typeof x === 'object' && !Array.isArray(x),
      );
    }
  }
  const top = r['items'] ?? r['rows'] ?? r['content'];
  if (Array.isArray(top)) {
    return top.filter(
      (x): x is Record<string, unknown> =>
        x != null && typeof x === 'object' && !Array.isArray(x),
    );
  }
  return [];
}

export function mapClientesAOpciones(resp: unknown): RentRolSelectOpcion[] {
  const rows = extraerFilasApi(resp);
  return rows
    .map((row) => {
      const id = Number(row['id']);
      if (!Number.isFinite(id) || id <= 0) return null;
      const compuesto = [row['nombre'], row['apellidoPaterno'], row['apellidoMaterno']]
        .filter((x) => x != null && String(x).trim() !== '')
        .map((x) => String(x).trim())
        .join(' ');
      const label =
        compuesto ||
        String(row['razonSocial'] ?? row['cliente'] ?? '').trim() ||
        `Arrendador #${Math.trunc(id)}`;
      return { id: Math.trunc(id), label };
    })
    .filter((x): x is RentRolSelectOpcion => x != null)
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

export function mapInmueblesAOpciones(resp: unknown): RentRolSelectOpcion[] {
  return extraerFilasApi(resp)
    .map((row) => {
      const id = Number(row['id'] ?? row['idInmueble']);
      if (!Number.isFinite(id) || id <= 0) return null;
      const nombre =
        String(row['inmueble'] ?? row['nombreInmueble'] ?? row['nombre'] ?? '').trim() ||
        'Inmueble';
      const dir = String(row['direccionFiscal'] ?? row['direccion'] ?? '').trim();
      return { id: Math.trunc(id), label: dir ? `${nombre} — ${dir}` : nombre };
    })
    .filter((x): x is RentRolSelectOpcion => x != null)
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

export function mapLocalesLibresAOpciones(resp: unknown): RentRolLocalOpcion[] {
  return extraerFilasApi(resp)
    .map((row) => {
      const id = Number(row['id'] ?? row['idLocal']);
      if (!Number.isFinite(id) || id <= 0) return null;
      const nombre =
        String(row['nombre'] ?? row['nombreLocal'] ?? '').trim() || `Local ${Math.trunc(id)}`;
      return {
        id: Math.trunc(id),
        nombre,
        etiqueta: etiquetaLocalLibreRentRol(nombre, row),
      };
    })
    .filter((x): x is RentRolLocalOpcion => x != null)
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

/**
 * Misma regla que lista-inmuebles-detalle:
 * - Si hay `mensualidadIva` → renta = mensualidadIva, mant = mantenimientoIva (o 0).
 * - Si no → renta = mensualidad, mant = mantenimiento (o 0).
 * - Con mantenimiento > 0 → etiqueta «Total»; si no → «Mensualidad».
 */
function etiquetaLocalLibreRentRol(nombre: string, row: Record<string, unknown>): string {
  const partes = [`Nombre: ${nombre}`];
  const renta = rentaLocalLibreRentRol(row);
  if (renta == null) return partes.join(' - ');

  const mant = mantenimientoLocalLibreRentRol(row);
  if (mant > 0) {
    partes.push(`Total: ${formatearMontoLocalRentRol(renta + mant)}`);
  } else {
    partes.push(`Mensualidad: ${formatearMontoLocalRentRol(renta)}`);
  }
  return partes.join(' - ');
}

function aplicaIvaLocalLibreRentRol(row: Record<string, unknown>): boolean {
  const raw = row['mensualidadIva'];
  return raw != null && String(raw).trim() !== '';
}

function parsearMontoLocalRentRol(val: unknown): number | null {
  if (val == null || String(val).trim() === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function rentaLocalLibreRentRol(row: Record<string, unknown>): number | null {
  if (aplicaIvaLocalLibreRentRol(row)) {
    return parsearMontoLocalRentRol(row['mensualidadIva']);
  }
  return parsearMontoLocalRentRol(row['mensualidad']);
}

function mantenimientoLocalLibreRentRol(row: Record<string, unknown>): number {
  if (aplicaIvaLocalLibreRentRol(row)) {
    return parsearMontoLocalRentRol(row['mantenimientoIva']) ?? 0;
  }
  return parsearMontoLocalRentRol(row['mantenimiento']) ?? 0;
}

function formatearMontoLocalRentRol(val: number): string {
  const hasCentavos = Math.abs(val - Math.trunc(val)) > 0.001;
  return val.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: hasCentavos ? 2 : 0,
    maximumFractionDigits: hasCentavos ? 2 : 0,
  });
}

export function construirFormDataArrendatarioCaptura(input: {
  arrendatario: string;
  representanteLegal?: string;
  telefonoRepresentante?: string;
  correoRepresentante?: string;
  idArrendador: number;
  lat: number;
  lng: number;
  idInmueble: number;
  idLocales: number[];
  fechaInicioContrato?: string;
  fechaTerminoContrato?: string;
  metrosRentados: number;
  costoM2: number;
  incluyeMantenimiento: boolean;
  pctMantenimiento?: number;
}): FormData {
  const fd = new FormData();
  const dto: Record<string, unknown> = {
    arrendatario: input.arrendatario.trim(),
    rfc: '',
    correoRepresentante: String(input.correoRepresentante ?? '').trim(),
    telefonoRepresentante: String(input.telefonoRepresentante ?? '').trim(),
    representanteLegal: String(input.representanteLegal ?? '').trim(),
    idArrendador: Math.trunc(input.idArrendador),
    lat: input.lat,
    lng: input.lng,
  };
  fd.append('arrendatario', JSON.stringify(dto));

  // Recalcular siempre al armar el payload (evita montosPreview desfasado).
  // Misma regla que agregar-arrendatario: si incluye=1, manda % y montos.
  const montosFinal = calcularMontosRentRolCaptura({
    metros: input.metrosRentados,
    costoM2: input.costoM2,
    incluyeMantenimiento: input.incluyeMantenimiento,
    pctMantenimiento: input.pctMantenimiento,
  });

  const incluyeMantenimiento = input.incluyeMantenimiento ? 1 : 0;
  const contrato: Record<string, unknown> = {
    idInmueble: Math.trunc(input.idInmueble),
    idLocales: input.idLocales.filter((id) => Number.isFinite(id) && id > 0).map((id) => Math.trunc(id)),
    metrosRentados: input.metrosRentados,
    costoM2: input.costoM2,
    incluyeMantenimiento,
  };

  const fi = String(input.fechaInicioContrato ?? '').trim();
  if (fi) contrato['fechaInicioContrato'] = fi;
  const ft = String(input.fechaTerminoContrato ?? '').trim();
  if (ft) contrato['fechaTerminoContrato'] = ft;

  if (montosFinal.renta.listo) {
    contrato['subTotalRenta'] = montosFinal.renta.subTotal;
    contrato['ivaRenta'] = montosFinal.renta.iva;
    contrato['rentaTotal'] = montosFinal.renta.total;
  }

  if (incluyeMantenimiento === 1) {
    const pct = numJson(input.pctMantenimiento);
    if (pct !== undefined) contrato['porcentajeMantenimiento'] = pct;
    if (montosFinal.mantenimiento.listo) {
      contrato['subTotalMantenimiento'] = montosFinal.mantenimiento.subTotal;
      contrato['ivaMantenimiento'] = montosFinal.mantenimiento.iva;
      contrato['mantenimientoTotal'] = montosFinal.mantenimiento.total;
    }
  }

  fd.append('contratos', JSON.stringify([contrato]));
  return fd;
}
