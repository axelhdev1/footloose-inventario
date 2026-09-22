
IF DB_ID('InventarioDB') IS NULL
    CREATE DATABASE InventarioDB;
GO

USE InventarioDB;
GO

IF OBJECT_ID('dbo.producto', 'U') IS NOT NULL DROP TABLE dbo.producto;
IF OBJECT_ID('dbo.categoria', 'U') IS NOT NULL DROP TABLE dbo.categoria;
GO

CREATE TABLE dbo.categoria (
    id_categoria     INT IDENTITY(1,1) PRIMARY KEY,
    nombre_categoria VARCHAR(100) NOT NULL CONSTRAINT UQ_categoria_nombre UNIQUE,
    activo           BIT NOT NULL CONSTRAINT DF_categoria_activo DEFAULT 1  -- 1 = ACTIVO
);
GO

CREATE TABLE dbo.producto (
    id_producto  INT IDENTITY(1,1) PRIMARY KEY,
    nombre       VARCHAR(150) NOT NULL,
    sku          VARCHAR(50)  NOT NULL CONSTRAINT UQ_producto_sku UNIQUE,
    id_categoria INT          NOT NULL CONSTRAINT FK_producto_categoria
                              REFERENCES dbo.categoria(id_categoria),
    stock        INT          NOT NULL CONSTRAINT CK_producto_stock CHECK (stock >= 0),
    color        VARCHAR(50)  NOT NULL,
    talla        VARCHAR(20)  NULL,
    modelo       VARCHAR(100) NOT NULL,
    estado       BIT          NOT NULL CONSTRAINT DF_producto_estado DEFAULT 1  -- 1 = ACTIVO
);
GO


INSERT INTO dbo.categoria (nombre_categoria) VALUES
    ('Zapatillas'), ('Botines'), ('Sandalias'), ('Mocasines');

INSERT INTO dbo.producto (nombre, sku, id_categoria, stock, color, talla, modelo) VALUES
    ('Zapatilla Runner', 'SKU-001', 1, 25, 'Rojo', '40', 'Sport-2024');
GO

SELECT * FROM dbo.categoria;
SELECT * FROM dbo.producto;


SELECT * FROM producto

SELECT * FROM categoria