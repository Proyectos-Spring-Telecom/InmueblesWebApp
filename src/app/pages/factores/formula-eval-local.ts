import { parseValorNumerico } from 'src/app/shared/valor-miles-format';

export interface FormulaPreviewEvalResult {
  idFormula: number;
  nombreFormula: string;
  expresionOriginal: string;
  expresionSustituida: string;
  variables: Record<string, number>;
  resultado: number;
  tipoResultado: 'MONTO' | 'PORCENTAJE';
}

export interface FactorFormulaEval {
  variable: string;
  valor: number;
}

export type FormulaEditorEvalResult =
  | {
      ok: true;
      expresionSustituida: string;
      resultado: number;
      variables: Record<string, number>;
    }
  | { ok: false; mensaje: string };

const RE_INPC_ACTIVO_PREVIEW =
  /No hay INPC activo para\s+\d+\/\d+\s+\(factor\s+"[^"]+"\)/i;

/** 400 del preview/evaluar cuando el backend no resuelve periodo INPC. */
export function esErrorInpcActivoPreview(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false;
  const e = err as { status?: number; error?: unknown };
  if (Number(e.status) !== 400) return false;
  return RE_INPC_ACTIVO_PREVIEW.test(mensajeErrorHttp(err));
}

export function mensajeErrorHttp(err: unknown): string {
  if (err == null || typeof err !== 'object') return '';
  const e = err as { message?: string; error?: unknown };
  const nested = e.error;
  if (typeof nested === 'string') return nested.trim();
  if (nested != null && typeof nested === 'object') {
    const o = nested as { message?: string; mensaje?: string };
    return String(o.message ?? o.mensaje ?? '').trim();
  }
  return String(e.message ?? '').trim();
}

function esObjetoRegistro(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function idFormulaDesdeRegistro(row: Record<string, unknown>): number | null {
  const id = Number(row['id'] ?? row['idFormula'] ?? row['Id'] ?? row['IdFormula']);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

function registroPareceFormula(row: Record<string, unknown>): boolean {
  return (
    textoExpresionFormula(row) !== '' ||
    row['nombre'] != null ||
    row['Nombre'] != null ||
    row['tipoResultado'] != null ||
    row['TipoResultado'] != null
  );
}

/** Filas de GET `/formulas/listado` o `/formulas/paginated` (`{ data: [], paginated? }`). */
export function extraerFilasFormulasListadoApi(resp: unknown): Record<string, unknown>[] {
  if (resp == null) return [];
  if (Array.isArray(resp)) {
    return resp.filter((x): x is Record<string, unknown> => esObjetoRegistro(x));
  }
  if (!esObjetoRegistro(resp)) return [];
  const rows = resp['data'];
  if (Array.isArray(rows)) {
    return rows.filter((x): x is Record<string, unknown> => esObjetoRegistro(x));
  }
  return [];
}

/**
 * Normaliza la definición de fórmula desde listado, detalle o envoltorios anidados.
 * Ejemplo listado: `{ id, nombre, formula: "INPCActual / INPCBase", tipoResultado: "PORCENTAJE", ... }`.
 */
export function extraerFormulaDetalleApi(resp: unknown, idFormula?: number): Record<string, unknown> {
  if (resp == null) return {};

  if (Array.isArray(resp)) {
    if (idFormula != null) {
      for (const item of resp) {
        if (!esObjetoRegistro(item)) continue;
        if (idFormulaDesdeRegistro(item) === idFormula) return item;
      }
    }
    const first = resp.find((item) => esObjetoRegistro(item) && registroPareceFormula(item));
    return esObjetoRegistro(first) ? first : {};
  }

  if (!esObjetoRegistro(resp)) return {};

  if (registroPareceFormula(resp)) {
    return resp;
  }

  const data = resp['data'];
  if (data != null) {
    return extraerFormulaDetalleApi(data, idFormula);
  }

  for (const key of ['item', 'row', 'formula', 'result'] as const) {
    const nested = resp[key];
    if (nested != null) {
      const extraido = extraerFormulaDetalleApi(nested, idFormula);
      if (Object.keys(extraido).length > 0) return extraido;
    }
  }

  const items = resp['items'] ?? resp['rows'] ?? resp['content'];
  if (items != null) {
    return extraerFormulaDetalleApi(items, idFormula);
  }

  return resp;
}

/** Campo `formula` tal como lo escribe el editor (variables de factores + operadores). */
export function textoExpresionFormula(row: Record<string, unknown>): string {
  for (const key of ['formula', 'Formula']) {
    const v = row[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

export function nombreFormulaDesdeRegistro(row: Record<string, unknown>, idFormula?: number): string {
  for (const key of ['nombre', 'Nombre']) {
    const v = row[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return idFormula != null ? `Fórmula #${idFormula}` : 'Fórmula';
}

export function tipoResultadoFormulaDesdeRegistro(
  row: Record<string, unknown>,
): FormulaPreviewEvalResult['tipoResultado'] {
  const raw = String(row['tipoResultado'] ?? row['TipoResultado'] ?? 'PORCENTAJE')
    .trim()
    .toUpperCase();
  return raw === 'MONTO' ? 'MONTO' : 'PORCENTAJE';
}

export function formulaActivaEnListado(row: Record<string, unknown>): boolean {
  const est = row['estatus'];
  return est == null || Number(est) === 1;
}

/** Primer factor activo por variable (misma regla que agregar-formula). */
export function factoresActivosDesdeListadoApi(rows: unknown[]): FactorFormulaEval[] {
  const ordenados = (Array.isArray(rows) ? rows : [])
    .filter((x): x is Record<string, unknown> => esObjetoRegistro(x))
    .sort((a, b) => Number(a['id'] ?? a['Id'] ?? 0) - Number(b['id'] ?? b['Id'] ?? 0));

  const vistos = new Set<string>();
  const out: FactorFormulaEval[] = [];

  for (const row of ordenados) {
    const est = Number(row['estatus'] ?? row['Estatus'] ?? 1);
    if (est === 0) continue;
    const variable = String(
      row['variable'] ?? row['Variable'] ?? row['nombre'] ?? row['Nombre'] ?? '',
    ).trim();
    if (!variable || vistos.has(variable)) continue;
    const parsed = parseValorNumerico(row['valor'] ?? row['Valor'] ?? null);
    if (!Number.isFinite(parsed)) continue;
    vistos.add(variable);
    out.push({ variable, valor: redondearFactor(parsed) });
  }

  return out;
}

/** Variables del catálogo presentes en la expresión (nombres largos primero). */
export function variablesEnExpresionFormula(
  expr: string,
  catalogo: FactorFormulaEval[],
): string[] {
  const encontradas: string[] = [];
  const ordenadas = [...catalogo].sort((a, b) => b.variable.length - a.variable.length);

  for (const factor of ordenadas) {
    const variable = factor.variable;
    if (!variable || !expr.includes(variable)) continue;
    if (!encontradas.includes(variable)) encontradas.push(variable);
  }

  return encontradas;
}

/** Tokens alfabéticos que no son variables conocidas (misma regla que agregar-formula). */
export function tokensDesconocidosEnExpresionFormula(
  expr: string,
  variablesConocidas: string[],
): string[] {
  let limpia = expr;
  const ordenadas = [...variablesConocidas].sort((a, b) => b.length - a.length);
  for (const variable of ordenadas) {
    limpia = limpia.split(variable).join(' ');
  }
  limpia = limpia.replace(/[0-9.+\-*/()\s]/g, ' ').trim();
  return [...new Set(limpia.split(/\s+/).filter(Boolean))];
}

function redondearFactor(valor: number): number {
  return parseFloat(valor.toFixed(3));
}

function formatValorFactorSubstituto(valor: number): string {
  return redondearFactor(valor).toFixed(3);
}

export function evaluarExpresionSegura(expresion: string): number {
  let pos = 0;
  const s = expresion.replace(/\s+/g, '');

  function parseExpresion(): number {
    let resultado = parseTerm();
    while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
      const op = s[pos++];
      const t = parseTerm();
      resultado = op === '+' ? resultado + t : resultado - t;
    }
    return resultado;
  }

  function parseTerm(): number {
    let resultado = parseFactor();
    while (pos < s.length && (s[pos] === '*' || s[pos] === '/')) {
      const op = s[pos++];
      const f = parseFactor();
      if (op === '/' && f === 0) throw new Error('División entre cero');
      resultado = op === '*' ? resultado * f : resultado / f;
    }
    return resultado;
  }

  function parseFactor(): number {
    if (s[pos] === '(') {
      pos++;
      const resultado = parseExpresion();
      if (s[pos] !== ')') throw new Error('Paréntesis desbalanceados');
      pos++;
      return resultado;
    }
    if (s[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    const start = pos;
    while (pos < s.length && /[0-9.]/.test(s[pos])) pos++;
    if (pos === start) throw new Error('Token inesperado en posición ' + pos);
    return parseFloat(s.slice(start, pos));
  }

  const resultado = parseExpresion();
  if (pos !== s.length) throw new Error('Expresión inválida');
  return resultado;
}

/**
 * Evalúa una expresión del editor de fórmulas:
 * variables de factores, operadores + - * /, paréntesis y literales numéricos.
 */
export function evaluarExpresionFormulaEditor(
  expr: string,
  catalogo: FactorFormulaEval[],
): FormulaEditorEvalResult {
  const trimmed = expr.trim();
  if (!trimmed) {
    return { ok: false, mensaje: 'La expresión matemática está vacía.' };
  }

  const variables = variablesEnExpresionFormula(trimmed, catalogo);
  const desconocidas = tokensDesconocidosEnExpresionFormula(trimmed, variables);
  const faltantes: string[] = [...desconocidas];
  const sinValor: string[] = [];

  for (const v of variables) {
    const factor = catalogo.find((f) => f.variable === v);
    if (!factor) faltantes.push(v);
    else if (!Number.isFinite(factor.valor)) sinValor.push(v);
  }

  if (faltantes.length) {
    const unicos = [...new Set(faltantes)];
    return {
      ok: false,
      mensaje: `Variable${unicos.length > 1 ? 's' : ''} no encontrada${unicos.length > 1 ? 's' : ''} en Factores: ${unicos.join(', ')}`,
    };
  }

  if (sinValor.length) {
    return {
      ok: false,
      mensaje: `Variable${sinValor.length > 1 ? 's' : ''} sin valor numérico: ${sinValor.join(', ')}`,
    };
  }

  let sustituida = trimmed;
  const variablesMap: Record<string, number> = {};
  const variablesOrdenadas = [...variables].sort((a, b) => b.length - a.length);

  for (const v of variablesOrdenadas) {
    const factor = catalogo.find((f) => f.variable === v)!;
    variablesMap[v] = factor.valor;
    sustituida = sustituida.split(v).join(formatValorFactorSubstituto(factor.valor));
  }

  try {
    const resultado = redondearFactor(evaluarExpresionSegura(sustituida));
    return {
      ok: true,
      expresionSustituida: sustituida.trim(),
      resultado,
      variables: variablesMap,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al evaluar la expresión';
    return { ok: false, mensaje: msg };
  }
}

/** Evalúa un registro de fórmula del listado con factores activos. */
export function evaluarFormulaLocalConFactores(
  formulaFuente: unknown,
  factoresCatalogo: FactorFormulaEval[],
  idFormula: number,
): FormulaPreviewEvalResult {
  const formulaRaw = extraerFormulaDetalleApi(formulaFuente, idFormula);
  const expr = textoExpresionFormula(formulaRaw);
  if (!expr) {
    throw new Error('La fórmula no tiene expresión.');
  }

  const evalResult = evaluarExpresionFormulaEditor(expr, factoresCatalogo);
  if (!evalResult.ok) {
    throw new Error(evalResult.mensaje);
  }

  return {
    idFormula,
    nombreFormula: nombreFormulaDesdeRegistro(formulaRaw, idFormula),
    expresionOriginal: expr,
    expresionSustituida: evalResult.expresionSustituida,
    variables: evalResult.variables,
    resultado: evalResult.resultado,
    tipoResultado: tipoResultadoFormulaDesdeRegistro(formulaRaw),
  };
}
