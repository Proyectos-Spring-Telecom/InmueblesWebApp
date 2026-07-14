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
      const mensualidadRaw = row['mensualidad'];
      let etiqueta = `Nombre: ${nombre}`;
      if (mensualidadRaw != null && String(mensualidadRaw).trim() !== '') {
        const n = Number(mensualidadRaw);
        if (Number.isFinite(n)) {
          const hasCentavos = Math.abs(n - Math.trunc(n)) > 0.001;
          const mxn = n.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: hasCentavos ? 2 : 0,
            maximumFractionDigits: hasCentavos ? 2 : 0,
          });
          etiqueta += ` - Mensualidad: ${mxn}`;
        }
      }
      return { id: Math.trunc(id), nombre, etiqueta };
    })
    .filter((x): x is RentRolLocalOpcion => x != null)
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

export function extraerIdDesdeRespuestaApi(resp: unknown): number | null {
  if (resp == null) return null;
  if (typeof resp === 'number' && Number.isFinite(resp) && resp > 0) {
    return Math.trunc(resp);
  }
  if (typeof resp !== 'object') return null;
  const r = resp as Record<string, unknown>;
  const candidatos = [r['id'], r['idInmueble'], r['data']];
  for (const c of candidatos) {
    if (typeof c === 'number' && Number.isFinite(c) && c > 0) return Math.trunc(c);
    if (c != null && typeof c === 'object' && !Array.isArray(c)) {
      const nested = c as Record<string, unknown>;
      const id = Number(nested['id'] ?? nested['idInmueble']);
      if (Number.isFinite(id) && id > 0) return Math.trunc(id);
    }
    if (typeof c === 'string' && Number.isFinite(Number(c)) && Number(c) > 0) {
      return Math.trunc(Number(c));
    }
  }
  return null;
}

export function construirFormDataInmuebleMinimo(input: {
  nombreInmueble: string;
  idArrendador: number;
  lat: number;
  lng: number;
}): FormData {
  const fd = new FormData();
  fd.append('inmueble', input.nombreInmueble.trim());
  fd.append('idArrendador', String(Math.trunc(input.idArrendador)));
  fd.append('lat', String(input.lat));
  fd.append('lng', String(input.lng));
  return fd;
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
  montos: RentRolMontosPreview;
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

  const contrato: Record<string, unknown> = {
    idInmueble: Math.trunc(input.idInmueble),
    idLocales: input.idLocales.filter((id) => Number.isFinite(id) && id > 0).map((id) => Math.trunc(id)),
    metrosRentados: input.metrosRentados,
    costoM2: input.costoM2,
    incluyeMantenimiento: input.incluyeMantenimiento ? 1 : 0,
  };

  const fi = String(input.fechaInicioContrato ?? '').trim();
  if (fi) contrato['fechaInicioContrato'] = fi;
  const ft = String(input.fechaTerminoContrato ?? '').trim();
  if (ft) contrato['fechaTerminoContrato'] = ft;

  if (input.montos.renta.listo) {
    contrato['subTotalRenta'] = input.montos.renta.subTotal;
    contrato['ivaRenta'] = input.montos.renta.iva;
    contrato['rentaTotal'] = input.montos.renta.total;
  }

  if (input.incluyeMantenimiento && input.montos.mantenimiento.listo) {
    const pct = numJson(input.pctMantenimiento);
    if (pct !== undefined) contrato['porcentajeMantenimiento'] = pct;
    contrato['subTotalMantenimiento'] = input.montos.mantenimiento.subTotal;
    contrato['ivaMantenimiento'] = input.montos.mantenimiento.iva;
    contrato['mantenimientoTotal'] = input.montos.mantenimiento.total;
  }

  fd.append('contratos', JSON.stringify([contrato]));
  return fd;
}
