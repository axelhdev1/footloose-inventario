# Carga de inventario desde Excel

App para subir un Excel de inventario y guardar los productos en SQL Server.
Backend en NestJS, frontend en Angular.

## Cómo levantarlo

1. **Base de datos:** corre `database/db.sql` en SSMS. Crea la base, las tablas y unas categorías de ejemplo.

2. **Backend**
```bash
   cd backend
   npm install
   npm run start:dev
```
   Antes, completa el `.env` con tus datos de conexión (hay un `.env.example` de guía):
   `DB_HOST`, `DB_PORT`, `DB_INSTANCE`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

   El endpoint queda en `POST http://localhost:3000/api/inventario/upload` y recibe el archivo en el campo `file` (form-data).

3. **Frontend**
```bash
   cd frontend
   npm install
   npm start
```
   Se abre en http://localhost:4200

4. Para probar puedes usar `inventario_prueba.xlsx`, que trae algunos casos con error a propósito.

## Cómo funciona y por qué lo hice así

- **Columnas en cualquier orden:** los encabezados se pasan a minúsculas y sin tildes, y se buscan en un diccionario. Da igual si viene "Categoría", "CATEGORIA" o en otra posición.
- **Menos consultas a la base:** las categorías se traen una sola vez al inicio. Los SKU que ya existen también se consultan de una vez con `OPENJSON`, en lugar de ir fila por fila.
- **Transacción:** primero valido todo en memoria. Lo que pasa la validación se guarda dentro de una sola transacción, y si algo falla se hace `ROLLBACK` para que no quede nada a medias.
- **Filas con error:** no se guardan. Salen en el arreglo `errores` con el número de fila del Excel y el motivo (categoría que no existe, campo obligatorio vacío, cantidad no válida).
- **SKU que ya existe:** se suma la cantidad al stock actual.
- **SKU repetido dentro del mismo archivo:** se juntan las cantidades en uno solo.
- **Reporte:** `insertadosPorColor` e `insertadosPorModelo` cuentan solo lo que se insertó en esa subida.

## Detalles del enunciado

- `id_categoria` aparece como VARCHAR en la tabla categoría y como INT en producto. Usé INT en las dos para que la llave foránea funcione.
- `Activo` lo dejé como `BIT` con valor por defecto 1 (ACTIVO).
- Si una fila falla, elegí guardar las demás y reportar el error. La otra opción sería rechazar todo el archivo, y eso depende de cómo lo quiera trabajar el negocio.

## Pendientes

- Para archivos muy grandes, cambiar el bucle de inserts por un `MERGE` o un bulk insert.
- Agregar un `docker-compose` con SQL Server.
- Pruebas unitarias del servicio.