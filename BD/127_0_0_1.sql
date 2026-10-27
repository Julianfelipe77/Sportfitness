-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 29-09-2026 a las 21:10:17
-- Versión del servidor: 10.4.28-MariaDB
-- Versión de PHP: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `sportfitness_db`
--
CREATE DATABASE IF NOT EXISTS `sportfitness_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `sportfitness_db`;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `carritos`
--

CREATE TABLE `carritos` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `producto_id` varchar(20) NOT NULL,
  `nombre_producto` varchar(150) NOT NULL,
  `precio_unitario` decimal(10,2) NOT NULL,
  `imagen` varchar(255) DEFAULT NULL,
  `cantidad` int(11) NOT NULL DEFAULT 1,
  `fecha_actualizacion` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `carritos`
--

INSERT INTO `carritos` (`id`, `usuario_id`, `producto_id`, `nombre_producto`, `precio_unitario`, `imagen`, `cantidad`, `fecha_actualizacion`) VALUES
(11, 3, 'mujer-3', 'Tenis Running', 269900.00, 'Imagenes/Destacados/tennis Running.jpg', 1, '2026-09-08 20:26:24'),
(12, 3, 'mujer-2', 'Licra Fitness', 119900.00, 'Imagenes/Destacados/licras deportivas.avif', 1, '2026-09-08 20:26:24'),
(13, 3, 'sup-1', 'Proteína Whey Gold', 239900.00, 'Imagenes/Destacados/proteinas whey.webp', 1, '2026-09-08 20:26:24');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `categorias`
--

CREATE TABLE `categorias` (
  `id` int(11) NOT NULL,
  `nombre` varchar(50) NOT NULL,
  `descripcion` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `categorias`
--

INSERT INTO `categorias` (`id`, `nombre`, `descripcion`) VALUES
(1, 'Hombre', 'Ropa y accesorios deportivos para hombre'),
(2, 'Mujer', 'Ropa y accesorios deportivos para mujer'),
(3, 'Suplementos', 'Proteínas, creatinas y suplementación deportiva');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `detalle_pedidos`
--

CREATE TABLE `detalle_pedidos` (
  `id` int(11) NOT NULL,
  `pedido_id` int(11) NOT NULL,
  `producto_id` varchar(20) NOT NULL,
  `nombre_producto` varchar(150) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `precio_unitario` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `detalle_pedidos`
--

INSERT INTO `detalle_pedidos` (`id`, `pedido_id`, `producto_id`, `nombre_producto`, `cantidad`, `precio_unitario`) VALUES
(1, 1, 'mujer-3', 'Tenis Running', 2, 269900.00),
(2, 1, 'mujer-1', 'Top Deportivo', 1, 89900.00),
(3, 1, 'mujer-2', 'Licra Fitness', 1, 119900.00);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pedidos`
--

CREATE TABLE `pedidos` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `direccion_envio` varchar(255) DEFAULT NULL,
  `ciudad` varchar(100) DEFAULT NULL,
  `telefono_contacto` varchar(20) DEFAULT NULL,
  `metodo_pago` varchar(50) DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `total` decimal(10,2) NOT NULL,
  `estado` enum('pendiente','pagado','enviado','cancelado') DEFAULT 'pagado',
  `fecha_pedido` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `pedidos`
--

INSERT INTO `pedidos` (`id`, `usuario_id`, `direccion_envio`, `ciudad`, `telefono_contacto`, `metodo_pago`, `notas`, `total`, `estado`, `fecha_pedido`) VALUES
(1, 3, 'carrera 8 # 4-E28', 'Neiva', '3205991285', 'Contraentrega', '', 749600.00, 'pagado', '2026-09-01 19:44:18');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `productos`
--

CREATE TABLE `productos` (
  `id` varchar(20) NOT NULL,
  `categoria_id` int(11) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `precio` decimal(10,2) NOT NULL,
  `stock` int(11) NOT NULL DEFAULT 0,
  `imagen` varchar(255) DEFAULT 'default.jpg',
  `es_destacado` tinyint(1) DEFAULT 0,
  `fecha_creacion` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `productos`
--

INSERT INTO `productos` (`id`, `categoria_id`, `nombre`, `descripcion`, `precio`, `stock`, `imagen`, `es_destacado`, `fecha_creacion`) VALUES
('hombre-1', 1, 'Camiseta Nike Pro', NULL, 129900.00, 24, 'img/hhhh.webp', 0, '2026-08-18 21:00:12'),
('hombre-10', 1, 'Camiseta de Compresión', NULL, 99900.00, 22, 'img/hhhh.webp', 0, '2026-08-18 21:00:12'),
('hombre-11', 1, 'Chaqueta Impermeable', NULL, 199900.00, 5, 'img/hhhh.webp', 0, '2026-08-18 21:00:12'),
('hombre-12', 1, 'Cinturón de Levantamiento', NULL, 119900.00, 12, 'img/hhhh.webp', 0, '2026-08-18 21:00:12'),
('hombre-2', 1, 'Pantalón Deportivo', NULL, 149900.00, 15, 'img/hhhh.webp', 0, '2026-08-18 21:00:12'),
('hombre-3', 1, 'Tenis Running', NULL, 289900.00, 0, 'img/hhhh.webp', 0, '2026-08-18 21:00:12'),
('hombre-4', 1, 'Gorra Deportiva', NULL, 59900.00, 40, 'img/gorra.webp', 0, '2026-08-18 21:00:12'),
('hombre-5', 1, 'Chaqueta Cortavientos', NULL, 179900.00, 8, 'img/hhhh.webp', 0, '2026-08-18 21:00:12'),
('hombre-6', 1, 'Short Deportivo', NULL, 79900.00, 30, 'img/hhhh.webp', 0, '2026-08-18 21:00:12'),
('hombre-7', 1, 'Medias Deportivas x3', NULL, 39900.00, 50, 'img/hhhh.webp', 0, '2026-08-18 21:00:12'),
('hombre-8', 1, 'Sudadera con Capota', NULL, 159900.00, 0, 'img/hhhh.webp', 0, '2026-08-18 21:00:12'),
('hombre-9', 1, 'Guantes de Entrenamiento', NULL, 39900.00, 18, 'img/hhhh.webp', 0, '2026-08-18 21:00:12'),
('mujer-1', 2, 'Top Deportivo', NULL, 89900.00, 27, 'img/mmm.webp', 0, '2026-08-18 21:00:12'),
('mujer-10', 2, 'Camiseta Deportiva', NULL, 79900.00, 19, 'img/mmm.webp', 0, '2026-08-18 21:00:12'),
('mujer-11', 2, 'Chaqueta Impermeable', NULL, 189900.00, 0, 'img/mmm.webp', 0, '2026-08-18 21:00:12'),
('mujer-12', 2, 'Banda de Resistencia x3', NULL, 49900.00, 60, 'img/mmm.webp', 0, '2026-08-18 21:00:12'),
('mujer-2', 2, 'Licra Fitness', NULL, 119900.00, 19, 'img/mmm.webp', 0, '2026-08-18 21:00:12'),
('mujer-3', 2, 'Tenis Running', NULL, 269900.00, 4, 'img/mmm.webp', 0, '2026-08-18 21:00:12'),
('mujer-4', 2, 'Buso Deportivo', NULL, 139900.00, 0, 'img/mmm.webp', 0, '2026-08-18 21:00:12'),
('mujer-5', 2, 'Chaqueta Deportiva', NULL, 169900.00, 10, 'img/mmm.webp', 0, '2026-08-18 21:00:12'),
('mujer-6', 2, 'Short Fitness', NULL, 89900.00, 25, 'img/mmm.webp', 0, '2026-08-18 21:00:12'),
('mujer-7', 2, 'Diadema para Cabello', NULL, 19900.00, 45, 'img/mmm.webp', 0, '2026-08-18 21:00:12'),
('mujer-8', 2, 'Chaleco Deportivo', NULL, 129900.00, 14, 'img/mmm.webp', 0, '2026-08-18 21:00:12'),
('mujer-9', 2, 'Guantes de Entrenamiento', NULL, 39900.00, 16, 'img/mmm.webp', 0, '2026-08-18 21:00:12'),
('sup-1', 3, 'Proteína Whey Gold', NULL, 239900.00, 20, 'img/ChatGPT Image 27 jul 2026, 18_21_29.png', 0, '2026-08-18 21:00:12'),
('sup-10', 3, 'Glutamina', NULL, 89900.00, 12, 'img/ChatGPT Image 27 jul 2026, 18_21_29.png', 0, '2026-08-18 21:00:12'),
('sup-11', 3, 'Quemador de Grasa', NULL, 129900.00, 8, 'img/ChatGPT Image 27 jul 2026, 18_21_29.png', 0, '2026-08-18 21:00:12'),
('sup-12', 3, 'Colágeno Hidrolizado', NULL, 99900.00, 16, 'img/ChatGPT Image 27 jul 2026, 18_21_29.png', 0, '2026-08-18 21:00:12'),
('sup-2', 3, 'Creatina Monohidratada', NULL, 109900.00, 35, 'img/ChatGPT Image 27 jul 2026, 18_21_29.png', 0, '2026-08-18 21:00:12'),
('sup-3', 3, 'Pre Entreno', NULL, 149900.00, 0, 'img/ChatGPT Image 27 jul 2026, 18_21_29.png', 0, '2026-08-18 21:00:12'),
('sup-4', 3, 'Vitaminas Deportivas', NULL, 79900.00, 25, 'img/ChatGPT Image 27 jul 2026, 18_21_29.png', 0, '2026-08-18 21:00:12'),
('sup-5', 3, 'BCAA en Polvo', NULL, 99900.00, 18, 'img/ChatGPT Image 27 jul 2026, 18_21_29.png', 0, '2026-08-18 21:00:12'),
('sup-6', 3, 'Barras de Proteína x12', NULL, 89900.00, 0, 'img/ChatGPT Image 27 jul 2026, 18_21_29.png', 0, '2026-08-18 21:00:12'),
('sup-7', 3, 'Omega 3', NULL, 69900.00, 22, 'img/ChatGPT Image 27 jul 2026, 18_21_29.png', 0, '2026-08-18 21:00:12'),
('sup-8', 3, 'Shaker Sport+Fitness', NULL, 29900.00, 50, 'img/ChatGPT Image 27 jul 2026, 18_21_29.png', 0, '2026-08-18 21:00:12'),
('sup-9', 3, 'Multivitamínico', NULL, 69900.00, 30, 'img/ChatGPT Image 27 jul 2026, 18_21_29.png', 0, '2026-08-18 21:00:12');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `rol` enum('Admin','Cliente') NOT NULL DEFAULT 'Cliente',
  `nombre` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_desactivacion` datetime DEFAULT NULL,
  `motivo_desactivacion` varchar(255) DEFAULT NULL,
  `fecha_registro` timestamp NULL DEFAULT current_timestamp(),
  `token_recuperacion` varchar(64) DEFAULT NULL,
  `token_expira` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id`, `rol`, `nombre`, `email`, `password`, `telefono`, `fecha_registro`, `token_recuperacion`, `token_expira`) VALUES
(1, 'Admin', 'Admin SportFitness', 'admin@sportfitness.com', '$2y$10$eImiTXuWVxfM37uY4JANjOL.gUTL768.hG13N0tG.y69J.35x.iO.', '3001234567', '2026-07-30 19:29:51', NULL, NULL),
(2, 'Cliente', 'Juan Pérez', 'juan.perez@email.com', '$2y$10$eImiTXuWVxfM37uY4JANjOL.gUTL768.hG13N0tG.y69J.35x.iO.', '3109876543', '2026-07-30 19:29:51', NULL, NULL),
(3, 'Cliente', 'karol Acosta', 'karol@gmail.com', '$2y$10$HjxPwdLRWtq5cySm9ZqCOODK7HG.vMk3ogasw8g4sW/lD7qcXQshq', '3205991285', '2026-08-18 21:06:35', NULL, NULL),
(4, 'Cliente', 'Karol Dayana', 'karolacosta167@gmail.com', '$2y$10$5a4mgfTsYr23qBNkQS13s.SZitrXsUlt1KYT.xlTnOaGAWpxulGdy', '3134885451', '2026-09-01 20:20:08', 'c4e0fc9c5448fb786cda524efd89645cce26d3f8468481770c3bfa2182edf293', '2026-09-01 23:45:39');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `carritos`
--
ALTER TABLE `carritos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `usuario_producto` (`usuario_id`,`producto_id`),
  ADD KEY `producto_id` (`producto_id`);

--
-- Indices de la tabla `categorias`
--
ALTER TABLE `categorias`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nombre` (`nombre`);

--
-- Indices de la tabla `detalle_pedidos`
--
ALTER TABLE `detalle_pedidos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `pedido_id` (`pedido_id`),
  ADD KEY `producto_id` (`producto_id`);

--
-- Indices de la tabla `pedidos`
--
ALTER TABLE `pedidos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_id` (`usuario_id`),
  ADD KEY `usuario_fecha` (`usuario_id`, `fecha_pedido`);

--
-- Indices de la tabla `productos`
--
ALTER TABLE `productos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `categoria_id` (`categoria_id`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `carritos`
--
ALTER TABLE `carritos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT de la tabla `categorias`
--
ALTER TABLE `categorias`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `detalle_pedidos`
--
ALTER TABLE `detalle_pedidos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `pedidos`
--
ALTER TABLE `pedidos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `carritos`
--
ALTER TABLE `carritos`
  ADD CONSTRAINT `carritos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `carritos_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `detalle_pedidos`
--
ALTER TABLE `detalle_pedidos`
  ADD CONSTRAINT `detalle_pedidos_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `detalle_pedidos_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `pedidos`
--
ALTER TABLE `pedidos`
  ADD CONSTRAINT `pedidos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `productos`
--
ALTER TABLE `productos`
  ADD CONSTRAINT `productos_ibfk_1` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
