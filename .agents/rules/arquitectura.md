---
trigger: always_on
---

# Arquitectura y Especificación Técnica: Roller Today

## 1. Visión y Propósito

Despliegue de una landing page de alta fidelidad estética y rendimiento cinematográfico para la marca **Roller Today** (patines, patinetas y movilidad urbana sobre ruedas). Publicada sin coste en GitHub Pages bajo el dominio de organización `rollertoday.github.io`. El proyecto utiliza exclusivamente estándares web nativos (Vanilla), evitando cualquier dependencia, bundler o framework reactivo.

---

## 2. Stack y Restricciones Técnicas

- **HTML5:** Semántica estricta (`<header>`, `<main>`, `<section>`, `<article>`, `<figure>`, `<footer>`). Prohibidos los estilos o eventos en línea.
- **CSS Moderno:** CSS Grid, Flexbox y tokens de diseño centralizados en `:root` (`assets/css/base.css`). Responsividad fluida con `clamp()`, `min()` y `max()`.
- **JavaScript:** ES6+ modular nativo (`<script type="module">`). Código defensivo con retornos tempranos y delegación de eventos.
- **Documentación:** Formato JSDoc obligatorio en todo módulo, función, clase y firma de parámetros/retornos.
- **Fuentes de Datos:** Contrato en `assets/data/gallery.json` como única fuente de verdad para componentes dinámicos, validando claves requeridas antes de pintar el DOM.

---

## 3. Modelo de Navegación Cartesiana (2D)

El sitio opera como una matriz de pantallas completas (`100dvw` $\times$ `100dvh`), combinando navegación vertical y horizontal desacoplada:

```
Viewport Track (overflow-y: mandatory / snap vertical)
│
├── Section V1 (100dvw x 100dvh)
│   └── Rail Horizontal (translate3d / overflow: hidden)
│       ├── Panel H0 (Izquierdo / 100dvw) [Default]
│       └── Panel H1 (Derecho / 100dvw)
│
├── Section V2 (100dvw x 100dvh)
│   └── Rail Horizontal ...

```

### Reglas de los Ejes

1. **Eje Vertical (Scroll-Snap Nativo):**

- Controlado por CSS puro (`scroll-snap-type: y mandatory; overflow-y: scroll; scroll-behavior: smooth`).
- Permite cambio de sección por inercia nativa de rueda de ratón en desktop o swipe vertical en móviles.

2. **Eje Horizontal (Controlador de Estado por GPU):**

- No utiliza scrollbar horizontal nativo (`overflow: hidden`).
- Desplazamiento accionado por hardware: `transform: translate3d(-100dvw, 0, 0)` sobre un contenedor `.rail-horizontal`.
- En desktop se opera mediante botones interactivos de cambio de panel; en móviles mediante detección de gestos táctiles (`touchstart` / `touchend` con umbral $\Delta X \ge 40\text{px}$).

3. **Regla de Reseteo Automático (Anticubo de Rubik):**

- Implementada vía `IntersectionObserver`.
- Toda sección vertical que abandone el viewport debe regresar su `.rail-horizontal` al estado inicial (`Panel H0` / índice `0`) de forma transparente e inmediata para que el usuario siempre aterrice en el panel izquierdo.

4. **Composición de Parallax:**

- Cada panel contiene capas a distinta profundidad:
- **Fondo:** Escala sutil o desplazamiento atenuado ($0.5\times$).
- **Contenido:** Tipografía y llamados a la acción con ritmo de lectura estándar ($1.0\times$).

---

## 4. Estructura de Secciones

| Sección              | Panel Izquierdo (Default)                               | Panel Derecho (Secundario)                    | Objetivo de Conversión                         |
| -------------------- | ------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| **01. Onboarding**   | Patinaje Nocturno (_"Tus noches se pueden ver así..."_) | Patinaje Diurno (_"...o tus días, así."_)     | Impacto estético inicial y captura de atención |
| **02. Manifiesto**   | Quiénes somos e historia de la marca                    | Cultura del patinaje y filosofía de comunidad | Conexión e identidad de marca                  |
| **03. Gear & Merch** | Equipo técnico (patines, tablas, asesoría)              | Streetwear oficial (camisas, gorras, ropa)    | Conversión comercial y catálogo                |
| **04. Academia**     | Clases grupales y niveles iniciales                     | Entrenamiento y asesoría personalizada        | Oferta formativa                               |
| **05. Rutas**        | Rodadas de domingo (novatos / familiar)                 | Ruta urbana nocturna de jueves (avanzados)    | Activación comunitaria recurrente              |
| **06. Base Camp**    | Únete a la comunidad (WhatsApp / Telegram)              | Canales de soporte, redes sociales y contacto | Cierre, fidelización y contacto                |

---

## 5. Rendimiento Visual y Manejo de Activos

- **Formatos:** Uso prioritario de formatos modernos comprimidos (WebP / AVIF).
- **Métricas Core Web Vitals:** Prevención de Layout Shift (CLS) declarando dimensiones explícitas, `loading="lazy"` (salvo en el primer panel del onboarding que requiere `loading="eager"` o `fetchpriority="high"`) y `decoding="async"`.
- **Ajuste de Fondo:** Regla `object-fit: cover` complementada con variables de punto focal (`--focal-point: center center`) para evitar recortes críticos en dispositivos verticales móviles.

---

## 6. Estructura de Archivos del Repositorio

```text
rollertoday.github.io/
├── assets/
│   ├── css/
│   │   ├── base.css          /* Reset, tokens y tipografía */
│   │   ├── layout.css        /* Snap vertical, rieles y grillas */
│   │   └── components.css    /* Botones, badges, tarjetas, modal */
│   ├── js/
│   │   ├── app.js            /* Orquestador principal (módulo) */
│   │   ├── navigation.js     /* Controlador cartesiano (snap + riel horizontal) */
│   │   └── gallery.js        /* Consumo, validación y renderizado de JSON */
│   ├── data/
│   │   └── gallery.json      /* Esquema de datos de imágenes */
│   └── images/               /* Activos WebP/AVIF organizados por sección */
├── index.html
└── README.md

```
