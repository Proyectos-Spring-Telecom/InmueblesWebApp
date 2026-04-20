/** Fila de histórico INPC (grid + formulario). */
export interface InpcHistoricoItem {
  id: number;
  anio: number;
  mes: string;
  valorInpc: number;
  estatus: number;
}

export const MESES_INPC = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

export function mesNombreANumero(mes: string): number {
  const i = MESES_INPC.indexOf(mes as (typeof MESES_INPC)[number]);
  return i >= 0 ? i + 1 : 1;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Primeras filas según captura; el resto continúa hacia atrás en el tiempo. */
export const INPC_HISTORICO_DEMO: InpcHistoricoItem[] = (() => {
  const seed: Array<Pick<InpcHistoricoItem, 'anio' | 'mes' | 'valorInpc'>> = [
    { anio: 2017, mes: 'Mayo', valorInpc: 126.091 },
    { anio: 2017, mes: 'Abril', valorInpc: 126.242 },
    { anio: 2017, mes: 'Marzo', valorInpc: 126.087 },
    { anio: 2017, mes: 'Febrero', valorInpc: 125.318 },
    { anio: 2017, mes: 'Enero', valorInpc: 124.598 },
    { anio: 2016, mes: 'Diciembre', valorInpc: 122.515 },
    { anio: 2016, mes: 'Noviembre', valorInpc: 121.953 },
    { anio: 2016, mes: 'Octubre', valorInpc: 121.007 },
    { anio: 2016, mes: 'Septiembre', valorInpc: 120.277 },
    { anio: 2016, mes: 'Agosto', valorInpc: 119.547 },
  ];

  const rows: InpcHistoricoItem[] = seed.map((r, idx) => ({
    id: idx + 1,
    anio: r.anio,
    mes: r.mes,
    valorInpc: r.valorInpc,
    estatus: 1,
  }));

  let y = 2016;
  let mIdx = 6; // Julio (mes anterior a Agosto 2016 en la semilla)
  let v = 119.12;
  for (let id = 11; id <= 41; id++) {
    rows.push({
      id,
      anio: y,
      mes: MESES_INPC[mIdx],
      valorInpc: round3(v),
      estatus: 1,
    });
    if (mIdx === 0) {
      mIdx = 11;
      y--;
    } else {
      mIdx--;
    }
    v = Math.max(95, v - 0.22 - ((id * 11) % 17) / 200);
  }

  return rows;
})();

export function buscarInpcHistoricoPorId(id: number): InpcHistoricoItem | undefined {
  return INPC_HISTORICO_DEMO.find((r) => r.id === id);
}
