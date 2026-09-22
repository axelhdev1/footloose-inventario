import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as sql from 'mssql';
import * as XLSX from 'xlsx';
import { DatabaseService } from '../database/database.service';
import { ErrorFila, ProductoFila, ReporteCarga } from './inventario.types';

type Campo = 'nombre' | 'sku' | 'categoria' | 'stock' | 'color' | 'talla' | 'modelo' | 'estado';


const MAPA_COLUMNAS: Record<string, Campo> = {
  'nombre producto': 'nombre',
  'nombre del producto': 'nombre',
  nombre: 'nombre',
  producto: 'nombre',
  sku: 'sku',
  categoria: 'categoria',
  cantidad: 'stock',
  stock: 'stock',
  color: 'color',
  talla: 'talla',
  modelo: 'modelo',
  activo: 'estado',
  estado: 'estado',
};

const COLUMNAS_REQUERIDAS: Campo[] = ['nombre', 'sku', 'categoria', 'stock', 'color', 'modelo'];

@Injectable()
export class InventarioService {
  private readonly logger = new Logger(InventarioService.name);

  constructor(private readonly db: DatabaseService) {}

  async procesarArchivo(buffer: Buffer): Promise<ReporteCarga> {
    // 1. Leer Excel (primera hoja)
    const libro = XLSX.read(buffer, { type: 'buffer' });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    if (!hoja) throw new BadRequestException('El archivo no contiene hojas.');

    const filasCrudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: null });
    if (filasCrudas.length === 0) throw new BadRequestException('El archivo no contiene registros.');

    // 2. Mapear encabezados -> campos
    const mapeo = this.mapearEncabezados(Object.keys(filasCrudas[0]));

    // 3. Pre-cargar categorías en memoria (1 sola consulta, evita N+1)
    const pool = this.db.getPool();
    const categorias = await this.cargarCategorias(pool);

    // 4. Validar filas
    const errores: ErrorFila[] = [];
    const validos = new Map<string, ProductoFila>(); // clave = SKU (agrupa SKUs repetidos en el archivo)

    filasCrudas.forEach((cruda, i) => {
      const fila = i + 2; // +1 por base 0, +1 por fila de encabezado
      const resultado = this.validarFila(cruda, mapeo, categorias, fila);
      if ('errores' in resultado) {
        errores.push(resultado);
        return;
      }
      const existente = validos.get(resultado.sku);
      if (existente) {
        existente.stock += resultado.stock; // mismo SKU repetido en el archivo: se suma
      } else {
        validos.set(resultado.sku, resultado);
      }
    });

    // 5. Guardar en BD dentro de una transacción
    const { insertados, actualizados } = await this.guardar(pool, [...validos.values()]);

    // 6. Reporte
    const insertadosPorColor: Record<string, number> = {};
    const insertadosPorModelo: Record<string, number> = {};
    for (const p of insertados) {
      insertadosPorColor[p.color] = (insertadosPorColor[p.color] ?? 0) + 1;
      insertadosPorModelo[p.modelo] = (insertadosPorModelo[p.modelo] ?? 0) + 1;
    }

    return {
      mensaje: 'Carga de inventario completada.',
      totalRegistrosLeidos: filasCrudas.length,
      totalRegistrosInsertados: insertados.length,
      totalRegistrosActualizados: actualizados,
      erroresEncontrados: errores.length,
      detalle: { insertadosPorColor, insertadosPorModelo },
      errores,
    };
  }

  // ---------------------------------------------------------------------------

  private normalizar(texto: string): string {
    return texto
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // quita tildes
      .replace(/\s+/g, ' ');
  }

  private mapearEncabezados(encabezados: string[]): Partial<Record<Campo, string>> {
    const mapeo: Partial<Record<Campo, string>> = {};
    for (const encabezado of encabezados) {
      const campo = MAPA_COLUMNAS[this.normalizar(encabezado)];
      if (campo && !mapeo[campo]) mapeo[campo] = encabezado;
    }
    const faltantes = COLUMNAS_REQUERIDAS.filter((c) => !mapeo[c]);
    if (faltantes.length) {
      throw new BadRequestException(`Faltan columnas obligatorias en el Excel: ${faltantes.join(', ')}`);
    }
    return mapeo;
  }

  private async cargarCategorias(pool: sql.ConnectionPool): Promise<Map<string, number>> {
    const res = await pool
      .request()
      .query<{ id_categoria: number; nombre_categoria: string }>(
        'SELECT id_categoria, nombre_categoria FROM dbo.categoria WHERE activo = 1',
      );
    return new Map(res.recordset.map((c) => [this.normalizar(c.nombre_categoria), c.id_categoria]));
  }

  private texto(valor: unknown): string {
    return valor === null || valor === undefined ? '' : String(valor).trim();
  }

  private parsearEstado(valor: unknown): boolean | null {
    const v = this.normalizar(this.texto(valor));
    if (v === '') return true; // por defecto ACTIVO
    if (['1', 'true', 'si', 'activo', 'verdadero'].includes(v)) return true;
    if (['0', 'false', 'no', 'inactivo', 'falso'].includes(v)) return false;
    return null;
  }

  private validarFila(
    cruda: Record<string, unknown>,
    mapeo: Partial<Record<Campo, string>>,
    categorias: Map<string, number>,
    fila: number,
  ): ProductoFila | ErrorFila {
    const get = (campo: Campo) => (mapeo[campo] ? cruda[mapeo[campo]!] : null);
    const errores: string[] = [];

    const nombre = this.texto(get('nombre'));
    const sku = this.texto(get('sku')).toUpperCase();
    const nombreCategoria = this.texto(get('categoria'));
    const color = this.texto(get('color'));
    const modelo = this.texto(get('modelo'));
    const talla = this.texto(get('talla')) || null;
    const stock = Number(get('stock'));
    const estado = this.parsearEstado(get('estado'));

    if (!nombre) errores.push('Nombre Producto es requerido.');
    if (!sku) errores.push('SKU es requerido.');
    if (!color) errores.push('Color es requerido.');
    if (!modelo) errores.push('Modelo es requerido.');
    if (!Number.isInteger(stock) || stock <= 0) errores.push('Cantidad debe ser un número entero positivo.');
    if (estado === null) errores.push('Activo tiene un valor no válido.');

    let idCategoria: number | undefined;
    if (!nombreCategoria) {
      errores.push('Categoría es requerida.');
    } else {
      idCategoria = categorias.get(this.normalizar(nombreCategoria));
      if (idCategoria === undefined) errores.push(`La categoría "${nombreCategoria}" no existe.`);
    }

    if (errores.length) return { fila, errores };

    return { fila, nombre, sku, idCategoria: idCategoria!, stock, color, talla, modelo, estado: estado! };
  }

  private async guardar(
    pool: sql.ConnectionPool,
    productos: ProductoFila[],
  ): Promise<{ insertados: ProductoFila[]; actualizados: number }> {
    const insertados: ProductoFila[] = [];
    let actualizados = 0;
    if (productos.length === 0) return { insertados, actualizados };

    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      // SKUs existentes en 1 sola consulta (OPENJSON evita el límite de 2100 parámetros)
      const existentesRes = await new sql.Request(tx)
        .input('skus', sql.NVarChar(sql.MAX), JSON.stringify(productos.map((p) => p.sku)))
        .query<{ sku: string }>(
          'SELECT sku FROM dbo.producto WITH (UPDLOCK) WHERE sku IN (SELECT value FROM OPENJSON(@skus))',
        );
      const existentes = new Set(existentesRes.recordset.map((r) => r.sku.toUpperCase()));

      for (const p of productos) {
        if (existentes.has(p.sku)) {
          // SKU existe -> se actualiza (suma) el stock
          await new sql.Request(tx)
            .input('sku', sql.VarChar(50), p.sku)
            .input('stock', sql.Int, p.stock)
            .query('UPDATE dbo.producto SET stock = stock + @stock WHERE sku = @sku');
          actualizados++;
        } else {
          await new sql.Request(tx)
            .input('nombre', sql.VarChar(150), p.nombre)
            .input('sku', sql.VarChar(50), p.sku)
            .input('idCategoria', sql.Int, p.idCategoria)
            .input('stock', sql.Int, p.stock)
            .input('color', sql.VarChar(50), p.color)
            .input('talla', sql.VarChar(20), p.talla)
            .input('modelo', sql.VarChar(100), p.modelo)
            .input('estado', sql.Bit, p.estado)
            .query(
              `INSERT INTO dbo.producto (nombre, sku, id_categoria, stock, color, talla, modelo, estado)
               VALUES (@nombre, @sku, @idCategoria, @stock, @color, @talla, @modelo, @estado)`,
            );
          insertados.push(p);
        }
      }

      await tx.commit();
      return { insertados, actualizados };
    } catch (error) {
      await tx.rollback(); // atomicidad: si algo falla, no queda nada a medias
      this.logger.error('Error en la carga, se hizo rollback', error as Error);
      throw error;
    }
  }
}
