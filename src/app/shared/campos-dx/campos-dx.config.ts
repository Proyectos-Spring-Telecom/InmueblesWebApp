/**
 * Opciones comunes del desplegable de los campos DevExtreme.
 * La clase `perm-dx-popup` sube el z-index para que el calendario / la lista queden encima de los modales
 * del proyecto (`.docs-backdrop` usa z-index 10051).
 */
export const DROPDOWN_CAMPO_DX = Object.freeze({
  wrapperAttr: { class: 'perm-dx-popup' },
});

/**
 * `displayExpr` para opciones «nombre + apellidos» (equivale a `{{ x.nombre }} {{ x.ap }} {{ x.am }}` del `<option>`):
 * une los campos con espacio y omite los vacíos.
 */
export function etiquetaNombreApellidos(
  campoPaterno = 'apellidoPaterno',
  campoMaterno = 'apellidoMaterno',
): (item: Record<string, unknown> | null) => string {
  return (item) =>
    item
      ? [item['nombre'], item[campoPaterno], item[campoMaterno]]
          .filter((v) => v != null && String(v).trim() !== '')
          .map((v) => String(v).trim())
          .join(' ')
      : '';
}
