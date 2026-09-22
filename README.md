# Carga de inventario desde Excel

NestJS + SQL Server + Angular.

## Cómo correrlo
1. **Base de datos:** ejecutar `database/db.sql` en SSMS.
2. **Backend**
   ```bash
   cd backend
   npm install
   # variables: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_INSTANCE (ej. SQLEXPRESS), DB_PORT
   npm run start:dev
   ```
   Endpoint: `POST http://localhost:3000/api/inventario/upload` (form-data, campo `file`).
3. **Frontend**
   ```bash
   cd frontend
   npm install
   ng serve
   ```
   Abrir http://localhost:4200
4. Archivo de prueba: `inventario_prueba.xlsx`.

## Decisiones de diseño
- **Mapeo de columnas:** los encabezados se normalizan (minúsculas, sin tildes) y se mapean con un diccionario, así las columnas pueden venir en cualquier orden.
- **Eficiencia:** las categorías se cargan en memoria con una sola consulta y los SKU existentes se consultan con una sola query (`OPENJSON`), evitando consultas N+1.
- **Transacción:** primero se validan todas las filas en memoria; luego todas las inserciones/actualizaciones de las filas válidas se ejecutan en una única transacción. Si falla cualquier operación en BD se hace `ROLLBACK` y no queda la carga a medias.
- **Errores por fila:** las filas inválidas (categoría inexistente, campos requeridos vacíos, cantidad no positiva) no se guardan y se devuelven en `errores` con su número de fila del Excel.
- **SKU existente:** se **suma** la cantidad al stock actual (carga de inventario).
- **SKU repetido en el mismo archivo:** se agrupa y se suman las cantidades.
- **Inconsistencias del enunciado:** `id_categoria` aparece como VARCHAR en `categoria` e INT en `producto`; se usó INT para mantener la FK. `Activo` se modeló como `BIT DEFAULT 1` (ACTIVO).
- **Reporte:** `insertadosPorColor` e `insertadosPorModelo` cuentan solo los productos insertados en esta subida.

## Mejoras posibles
- Usar `MERGE` o `Table-Valued Parameters` / bulk insert para cargas muy grandes.
- Docker compose con SQL Server.
