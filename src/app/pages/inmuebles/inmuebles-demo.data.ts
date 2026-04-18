import {
  ARRENDATARIOS_FORM_DEMO,
  ArrendatarioFormDemo,
  ArrendatarioTreeRow,
  buildArrendatariosTreeRows,
} from '../arrendatarios/arrendatarios-demo.data';

export type InmuebleTreeRow = ArrendatarioTreeRow;
export type InmuebleFormDemo = ArrendatarioFormDemo;

export const INMUEBLES_FORM_DEMO: InmuebleFormDemo[] = ARRENDATARIOS_FORM_DEMO;

export function buildInmueblesTreeRows(): InmuebleTreeRow[] {
  return buildArrendatariosTreeRows();
}
