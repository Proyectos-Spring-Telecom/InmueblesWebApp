/** Datos de constancia extraídos por POST `/pdf-ocr/constancia-fiscal`. */
export interface ConstanciaFiscalOcr {
  tipoContribuyente?: 'PERSONA_FISICA' | 'PERSONA_MORAL' | string;
  rfc?: string | null;
  nombre?: string | null;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
  razonSocial?: string | null;
  regimenCapital?: string | null;
  nombreComercial?: string | null;
  codigoPostal?: string | null;
  tipoVialidad?: string | null;
  nombreVialidad?: string | null;
  numeroExterior?: string | null;
  numeroInterior?: string | null;
  colonia?: string | null;
  localidad?: string | null;
  municipio?: string | null;
  entidadFederativa?: string | null;
  entreCalle?: string | null;
  yCalle?: string | null;
}

export interface ConstanciaFiscalOcrResponse {
  status?: string;
  message?: string;
  data?: {
    constancia?: ConstanciaFiscalOcr;
  };
}

export interface CamposInmuebleDesdeConstancia {
  direccionInmueble?: string;
}

export interface CamposArrendatarioDesdeConstancia {
  nombreInmueble?: string;
  rfc?: string;
  tipoPersona?: number;
  direccionInmueble?: string;
}

export interface CamposClienteDesdeConstancia {
  rfc?: string;
  tipoPersona?: number;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  estado?: string;
  municipio?: string;
  colonia?: string;
  calle?: string;
  entreCalles?: string;
  numeroExterior?: string;
  numeroInterior?: string;
  cp?: string;
}

function limpiarTexto(value: string | null | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function limpiarLocalidad(localidad: string): string {
  const prefix = 'Nombre del Municipio o Demarcación Territorial:';
  const t = limpiarTexto(localidad);
  if (t.toUpperCase().includes(prefix.toUpperCase())) {
    return limpiarTexto(t.split(':').slice(1).join(':'));
  }
  return t;
}

/** Arma la dirección fiscal legible a partir de los campos de domicilio fiscal. */
export function construirDireccionFiscalDesdeConstancia(c: ConstanciaFiscalOcr): string {
  const partes: string[] = [];
  const vialidad = [limpiarTexto(c.tipoVialidad), limpiarTexto(c.nombreVialidad)].filter(Boolean).join(' ');
  if (vialidad) partes.push(vialidad);

  const ext = limpiarTexto(c.numeroExterior);
  if (ext) {
    let numero = `No. ${ext}`;
    const interior = limpiarTexto(c.numeroInterior);
    if (interior) numero += ` Int. ${interior}`;
    partes.push(numero);
  }

  const colonia = limpiarTexto(c.colonia);
  if (colonia) partes.push(`Col. ${colonia}`);

  const municipio = limpiarTexto(c.municipio) || limpiarLocalidad(String(c.localidad ?? ''));
  if (municipio) partes.push(municipio);

  const entidad = limpiarTexto(c.entidadFederativa);
  if (entidad) partes.push(entidad);

  const cp = limpiarTexto(c.codigoPostal);
  if (cp) partes.push(`C.P. ${cp}`);

  return partes.join(', ');
}

/** Mapea la constancia OCR: solo dirección fiscal del inmueble. */
export function mapearConstanciaAInmueble(c: ConstanciaFiscalOcr): CamposInmuebleDesdeConstancia {
  const direccion = construirDireccionFiscalDesdeConstancia(c);
  return direccion ? { direccionInmueble: direccion } : {};
}

/** Mapea la constancia OCR a campos del formulario de arrendatario. */
export function mapearConstanciaAArrendatario(
  c: ConstanciaFiscalOcr,
): CamposArrendatarioDesdeConstancia {
  const patch: CamposArrendatarioDesdeConstancia = {};
  const direccion = construirDireccionFiscalDesdeConstancia(c);
  if (direccion) patch.direccionInmueble = direccion;

  const rfc = limpiarTexto(c.rfc).replace(/[^A-Za-z0-9]/g, '').slice(0, 13);
  if (rfc) patch.rfc = rfc;

  const tipo = String(c.tipoContribuyente ?? '').toUpperCase().trim();
  const esMoral = tipo === 'PERSONA_MORAL';
  if (tipo === 'PERSONA_MORAL' || tipo === 'PERSONA_FISICA') {
    patch.tipoPersona = esMoral ? 2 : 1;
  }

  if (esMoral) {
    const razon = limpiarTexto(c.razonSocial);
    if (razon) patch.nombreInmueble = razon;
  } else {
    const nom = limpiarTexto(c.nombre);
    const ap = limpiarTexto(c.apellidoPaterno);
    const am = limpiarTexto(c.apellidoMaterno);
    const completo = [nom, ap, am].filter(Boolean).join(' ');
    if (completo) patch.nombreInmueble = completo;
  }

  return patch;
}

/** Mapea la constancia OCR a campos del formulario de arrendador (cliente). */
export function mapearConstanciaACliente(c: ConstanciaFiscalOcr): CamposClienteDesdeConstancia {
  const tipo = String(c.tipoContribuyente ?? '').toUpperCase().trim();
  const esMoral = tipo === 'PERSONA_MORAL';
  const patch: CamposClienteDesdeConstancia = {};

  const rfc = limpiarTexto(c.rfc).toUpperCase();
  if (rfc) patch.rfc = rfc;

  if (tipo === 'PERSONA_MORAL' || tipo === 'PERSONA_FISICA') {
    patch.tipoPersona = esMoral ? 2 : 1;
  }

  if (esMoral) {
    const razon = limpiarTexto(c.razonSocial);
    if (razon) patch.nombre = razon;
  } else {
    const nom = limpiarTexto(c.nombre);
    if (nom) patch.nombre = nom;
    const ap = limpiarTexto(c.apellidoPaterno);
    if (ap) patch.apellidoPaterno = ap;
    const am = limpiarTexto(c.apellidoMaterno);
    if (am) patch.apellidoMaterno = am;
  }

  const ent = limpiarTexto(c.entidadFederativa);
  if (ent) patch.estado = ent;

  const mun = limpiarTexto(c.municipio) || limpiarLocalidad(String(c.localidad ?? ''));
  if (mun) patch.municipio = mun;

  const col = limpiarTexto(c.colonia);
  if (col) patch.colonia = col;

  const calle = [limpiarTexto(c.tipoVialidad), limpiarTexto(c.nombreVialidad)]
    .filter(Boolean)
    .join(' ');
  if (calle) patch.calle = calle;

  const entre = [limpiarTexto(c.entreCalle), limpiarTexto(c.yCalle)].filter(Boolean);
  if (entre.length) patch.entreCalles = entre.join(' y ');

  const ext = limpiarTexto(c.numeroExterior);
  if (ext) patch.numeroExterior = ext;

  const interior = limpiarTexto(c.numeroInterior);
  if (interior) patch.numeroInterior = interior;

  const cp = limpiarTexto(c.codigoPostal);
  if (cp) patch.cp = cp;

  return patch;
}

export function extraerConstanciaDeRespuestaOcr(
  res: ConstanciaFiscalOcrResponse | null | undefined,
): ConstanciaFiscalOcr | null {
  const c = res?.data?.constancia;
  return c && typeof c === 'object' ? c : null;
}
