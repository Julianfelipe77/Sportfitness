-- ============================================================
-- SPORT+FITNESS - Migración: gestión de clientes (panel admin)
-- ============================================================
-- Agrega a la tabla `usuarios` lo necesario para poder
-- deshabilitar cuentas desde el panel de administrador.
--
-- Úsalo SOLO si ya tenías la base de datos importada de antes.
-- (En una instalación nueva ya viene incluido en 127_0_0_1.sql.)
--
--   activo               1 = cuenta habilitada, 0 = deshabilitada
--   fecha_desactivacion  cuándo se deshabilitó
--   motivo_desactivacion por qué (ej. "Inactividad: 120 días sin comprar")
-- ============================================================

USE `sportfitness_db`;

ALTER TABLE `usuarios`
  ADD COLUMN `activo` tinyint(1) NOT NULL DEFAULT 1 AFTER `telefono`,
  ADD COLUMN `fecha_desactivacion` datetime DEFAULT NULL AFTER `activo`,
  ADD COLUMN `motivo_desactivacion` varchar(255) DEFAULT NULL AFTER `fecha_desactivacion`;

-- Acelera el cálculo de "última compra" por cliente.
ALTER TABLE `pedidos`
  ADD KEY `usuario_fecha` (`usuario_id`, `fecha_pedido`);
