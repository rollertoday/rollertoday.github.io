---
trigger: always_on
---

# Directivas del Proyecto: Roller Today (Landing Page & Galería)

## 1. Rol y Filosofía de Arquitectura

- Actúa como un desarrollador frontend senior especializado en la web artesanal de alto rendimiento y fidelidad estética.
- Prioriza soluciones nativas (Vanilla) sobre dependencias externas.
- Cero tolerancia a frameworks reactivos (React, Vue), librerías de utilidad masiva (Tailwind) o bundlers innecesarios. El código debe ejecutarse de forma limpia y directa sobre GitHub Pages.
- La prioridad de diseño es "mobile first". Siempre busca optimizar la visibilidad y estética para que se vea perfecto en dispocisitivos. Los breakpoins a usar y mantener son:

```
1. Base (Sin breakpoint): Hasta 575px [1, 2]. Dispositivos: Teléfonos móviles en vertical (móvil estándar).

2. min-width: 576px (Sm): De 576px a 767px [1, 2]. Dispositivos: Teléfonos móviles grandes o en horizontal.

3. min-width: 768px (Md): De 768px a 991px [1, 2]. Dispositivos: Tablets (como el iPad estándar).

4. min-width: 992px (Lg): De 992px a 1199px [1, 2]. Dispositivos: Tablets en horizontal y portátiles pequeños.min-width: 1200px (Xl): De 1200px en adelante [1, 2]Dispositivos: Pantallas de escritorio estándar y monitores grandes.
```

## 2. Estándares Técnicos

### HTML5 Semántico

- Marcado estructurado semánticamente (`<header>`, `<main>`, `<section>`, `<article>`, `<figure>`, `<footer>`).
- Separación estricta de responsabilidades: cero estilos en línea (`style="..."`) y cero manejadores de eventos en línea (`onclick="..."`).
- Prevención de Cumulative Layout Shift (CLS): todas las imágenes deben declarar atributos `width`, `height`, `loading="lazy"` y `decoding="async"`.

### CSS Moderno

- Arquitectura basada en tokens de diseño centralizados en `assets/css/base.css` mediante CSS Custom Properties (`--color-*`, `--space-*`, `--typography-*`).
- Layouts construidos exclusivamente con CSS Grid y Flexbox.
- Tipografía y espaciados responsivos mediante funciones nativas fluidas (`clamp()`, `min()`, `max()`).
- Modularidad con `@layer` para gestionar especificidad si el proyecto escala.

### JavaScript (ES6+ Vanilla)

- Uso exclusivo de módulos ES6 (`<script type="module">`).
- Delegación de eventos para el manejo eficiente de elementos dinámicos o listas.
- Programación defensiva con validaciones tempranas (_early returns_).
- Asincronía controlada con `async/await` y manejo explícito de errores en llamadas `fetch()`.

## 3. Contrato de Datos (Single Source of Truth)

- La galería y cualquier dato dinámico se rige estrictamente por `assets/data/gallery.json`.
- Todo módulo de JS que consuma datos externos debe validar la integridad del esquema (comprobar la existencia de propiedades obligatorias: `id`, `src`, `alt`, `aspectRatio`, etc.) antes de inyectar nodos en el DOM.
- No se permiten strings de HTML concatenadas a ciegas; usa `document.createElement()`, `template`, o sanitización adecuada para evitar vulnerabilidades XSS.

## 4. Estándar de Documentación

- **JSDoc Obligatorio:** Todo archivo, función, clase o interfaz de datos debe incluir documentación exhaustiva en formato JSDoc (`@param`, `@returns`, `@typedef`, `@throws`).
- Al ser código vanilla, debe estar protegido por un IIFE para evitar contaminar el entorno global

## 5. Criterios de Respuesta del Agente

- Provee código modular, completo y directamente aplicable.
- No recomiendes bibliotecas externas salvo que sea explícitamente solicitado.
- Mantén un enfoque de eficiencia de carga, accesibilidad nativa (WAI-ARIA y navegación por teclado) y fidelidad estética refinada.
