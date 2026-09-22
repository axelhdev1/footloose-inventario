export interface ProductoFila {
  fila: number; // número de fila en el Excel
  nombre: string;
  sku: string;
  idCategoria: number;
  stock: number;
  color: string;
  talla: string | null;
  modelo: string;
  estado: boolean;
}

export interface ErrorFila {
  fila: number;
  errores: string[];
}

export interface ReporteCarga {
  mensaje: string;
  totalRegistrosLeidos: number;
  totalRegistrosInsertados: number;
  totalRegistrosActualizados: number;
  erroresEncontrados: number;
  detalle: {
    insertadosPorColor: Record<string, number>;
    insertadosPorModelo: Record<string, number>;
  };
  errores: ErrorFila[];
}
