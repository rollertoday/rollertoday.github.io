/**
 * @file navigation.js
 * @module Navigation
 * @description Controlador cartesiano de navegación 2D para Roller Today.
 * Administra el desplazamiento horizontal por GPU, gestos táctiles móviles,
 * reseteo silencioso con IntersectionObserver (Anticubo de Rubik) y el menú móvil táctil.
 * Cumple con los estándares de JSDoc y encapsulación IIFE nativa.
 */

/**
 * @typedef {Object} TouchCoordinates
 * @property {number} x - Coordenada horizontal en píxeles.
 * @property {number} y - Coordenada vertical en píxeles.
 * @property {number} time - Marca de tiempo en milisegundos.
 */

/**
 * @typedef {Object} NavigationConfig
 * @property {number} swipeThreshold - Distancia mínima en píxeles para validar un swipe horizontal.
 * @property {number} intersectionThreshold - Umbral de visibilidad para determinar sección activa.
 */

export const Navigation = (() => {
  /**
   * Configuración inmutable del controlador.
   * @type {NavigationConfig}
   */
  const CONFIG = Object.freeze({
    swipeThreshold: 40,
    verticalSwipeThreshold: 40,
    intersectionThreshold: 0.55,
  });

  /**
   * Referencia a coordenadas de inicio del gesto táctil.
   * @type {TouchCoordinates | null}
   */
  let touchStartCoords = null;

  /**
   * Bloqueo de eje para el toque activo ('vertical' | 'horizontal' | null).
   * @type {'vertical' | 'horizontal' | null}
   */
  let touchAxisLock = null;

  /**
   * Indica si ya se ejecutó un snap vertical durante el toque activo.
   * @type {boolean}
   */
  let touchSnapTriggered = false;

  /**
   * Referencia al IntersectionObserver activo para reseteo y sincronización.
   * @type {IntersectionObserver | null}
   */
  let sectionObserver = null;

  /**
   * Referencia al requestAnimationFrame activo para el cálculo de parallax vertical.
   * @type {number | null}
   */
  let verticalRafId = null;

  /**
   * Bandera para prevenir disparos múltiples mientras transiciona el snap vertical.
   * @type {boolean}
   */
  let isSnapScrolling = false;

  /**
   * Actualiza los puntos indicadores de posición (dots H0 / H1) dentro de una sección.
   * @param {HTMLElement} sectionElement - Elemento contenedor de la sección vertical (.section-v).
   * @param {number} activeIndex - Índice del panel activo (0 para izquierdo, 1 para derecho).
   * @returns {void}
   */
  const updateIndicators = (sectionElement, activeIndex) => {
    if (!sectionElement) return;

    const indicators = sectionElement.querySelectorAll(".indicator-dot");
    if (indicators.length === 0) return;

    indicators.forEach((dot, index) => {
      // Si el índice coincide con el panel activo o con el índice relativo del panel
      const isActive = index % 2 === activeIndex;
      dot.classList.toggle("active", isActive);
    });
  };

  /**
   * Mueve el riel horizontal a un panel específico (0: izquierdo, 1: derecho).
   * @param {HTMLElement} railElement - Contenedor .rail-horizontal a desplazar.
   * @param {number} panelIndex - Índice de destino (0 o 1).
   * @param {boolean} [silent=false] - Si es verdadero, desactiva temporalmente las transiciones CSS.
   * @returns {void}
   */
  const setHorizontalPanel = (railElement, panelIndex, silent = false) => {
    if (!railElement) return;

    const normalizedIndex = panelIndex === 1 ? 1 : 0;
    const parentSection = railElement.closest(".section-v");

    if (silent) {
      railElement.classList.add("no-transition");
    }

    railElement.dataset.activePanel = String(normalizedIndex);
    railElement.classList.toggle("is-active-right", normalizedIndex === 1);

    if (parentSection) {
      updateIndicators(parentSection, normalizedIndex);
    }

    if (silent) {
      // Forzar reflow para asegurar aplicación síncrona sin interpolación visual
      void railElement.offsetWidth;
      railElement.classList.remove("no-transition");
    }
  };

  /**
   * Manejador delegado para los botones interactivos de cambio de panel horizontal.
   * @param {MouseEvent} event - Evento del clic disparado en el árbol DOM.
   * @returns {void}
   */
  const handleButtonClick = (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (!target) return;

    const nextBtn = target.closest(".btn-next-h");
    const prevBtn = target.closest(".btn-prev-h");

    if (!nextBtn && !prevBtn) return;

    const rail = target.closest(".rail-horizontal");
    if (!rail) return;

    if (nextBtn) {
      setHorizontalPanel(/** @type {HTMLElement} */ (rail), 1, false);
    } else if (prevBtn) {
      setHorizontalPanel(/** @type {HTMLElement} */ (rail), 0, false);
    }
  };

  /**
   * Ejecuta un snap obligatorio y fluido a la sección vertical contigua (Plan B).
   * Impide el arrastre manual paulatino en pantallas táctiles y fuerza un snap limpio
   * idéntico al comportamiento cinemático de escritorio.
   * @param {number} direction - Dirección del salto (+1 para siguiente sección, -1 para anterior).
   * @returns {void}
   */
  const snapToSection = (direction) => {
    const viewportTrack = document.getElementById("viewportTrack");
    if (!viewportTrack) {
      isSnapScrolling = false;
      return;
    }

    const sections = viewportTrack.querySelectorAll(".section-v");
    if (sections.length === 0) {
      isSnapScrolling = false;
      return;
    }

    const trackHeight = viewportTrack.clientHeight || window.innerHeight;
    const currentIndex = Math.round(viewportTrack.scrollTop / trackHeight);
    const targetIndex = Math.max(
      0,
      Math.min(sections.length - 1, currentIndex + direction),
    );

    if (targetIndex !== currentIndex) {
      const targetSection = sections[targetIndex];
      if (targetSection && typeof targetSection.scrollIntoView === "function") {
        targetSection.scrollIntoView({ behavior: "smooth" });
      } else {
        viewportTrack.scrollTo({
          top: targetIndex * trackHeight,
          behavior: "smooth",
        });
      }
      setTimeout(() => {
        isSnapScrolling = false;
      }, 650);
    } else {
      setTimeout(() => {
        isSnapScrolling = false;
      }, 200);
    }
  };

  /**
   * Registra el punto de contacto inicial para el reconocimiento de gestos táctiles.
   * @param {TouchEvent} event - Evento táctil de inicio.
   * @returns {void}
   */
  const handleTouchStart = (event) => {
    if (!event.touches || event.touches.length !== 1) {
      touchStartCoords = null;
      touchAxisLock = null;
      touchSnapTriggered = false;
      return;
    }

    const touch = event.touches[0];
    touchStartCoords = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    touchAxisLock = null;
    touchSnapTriggered = false;
  };

  /**
   * Manejador del movimiento táctil.
   * Detecta tempranamente la intención vertical (desde 4px) y cancela el arrastre
   * manual paulatino de forma ininterrumpida durante toda la pulsación (Plan B).
   * @param {TouchEvent} event - Evento touchmove.
   * @returns {void}
   */
  const handleTouchMove = (event) => {
    // Si el toque ya fue bloqueado como vertical, SIEMPRE cancelamos el arrastre nativo,
    // incluso después de haber ejecutado el snap y mientras el dedo siga apoyado
    if (touchAxisLock === "vertical") {
      if (event.cancelable) {
        event.preventDefault();
      }
    }

    if (!touchStartCoords || !event.touches || event.touches.length === 0) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartCoords.x;
    const deltaY = touch.clientY - touchStartCoords.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // 1. Detección temprana de eje: Se bloquea con apenas 4px de desplazamiento vertical
    if (!touchAxisLock) {
      if (absDeltaY > absDeltaX && absDeltaY >= 4) {
        touchAxisLock = "vertical";
        if (event.cancelable) {
          event.preventDefault();
        }
      } else if (absDeltaX > absDeltaY && absDeltaX >= 6) {
        touchAxisLock = "horizontal";
      }
    }

    // 2. Ejecución vertical: Bloqueo continuo del drag y disparo de snap temprano
    if (touchAxisLock === "vertical") {
      if (event.cancelable) {
        event.preventDefault();
      }

      // Disparo temprano de snap a la sección contigua (18px)
      if (
        !touchSnapTriggered &&
        absDeltaY >= CONFIG.verticalSwipeThreshold &&
        !isSnapScrolling
      ) {
        touchSnapTriggered = true;
        const direction = deltaY < 0 ? 1 : -1;
        snapToSection(direction);
      }
    }
  };

  /**
   * Evalúa el desplazamiento del gesto táctil y aplica transición cartesiana si cumple los criterios.
   * @param {TouchEvent} event - Evento táctil de finalización.
   * @returns {void}
   */
  const handleTouchEnd = (event) => {
    const coords = touchStartCoords;
    const axisLock = touchAxisLock;
    const snapTriggered = touchSnapTriggered;

    // Reseteo de flags del toque al levantar el dedo
    touchStartCoords = null;
    touchAxisLock = null;
    touchSnapTriggered = false;

    if (!coords || !event.changedTouches || event.changedTouches.length === 0) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - coords.x;
    const deltaY = touch.clientY - coords.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Caso 1: Gesto horizontal dominante (cambio de panel H0 <-> H1)
    if (
      axisLock === "horizontal" ||
      (absDeltaX >= CONFIG.swipeThreshold && absDeltaX > absDeltaY)
    ) {
      const targetElement = /** @type {HTMLElement} */ (event.target);
      if (!targetElement) return;

      const rail = targetElement.closest(".rail-horizontal");
      if (!rail) return;

      const currentPanel = rail.dataset.activePanel === "1" ? 1 : 0;

      if (deltaX < 0 && currentPanel === 0) {
        // Desplazamiento hacia la izquierda -> avanzar al panel derecho (H1)
        setHorizontalPanel(/** @type {HTMLElement} */ (rail), 1, false);
      } else if (deltaX > 0 && currentPanel === 1) {
        // Desplazamiento hacia la derecha -> regresar al panel izquierdo (H0)
        setHorizontalPanel(/** @type {HTMLElement} */ (rail), 0, false);
      }
      return;
    }

    // Caso 2: Gesto vertical rápido (flick) que no alcanzó a dispararse en touchmove
    if (
      !snapTriggered &&
      (axisLock === "vertical" || absDeltaY > absDeltaX) &&
      absDeltaY >= CONFIG.verticalSwipeThreshold &&
      !isSnapScrolling
    ) {
      snapToSection(deltaY < 0 ? 1 : -1);
    }
  };

  /**
   * Resetea silenciosamente secciones fuera del viewport (Anticubo de Rubik)
   * y sincroniza la sección activa en los enlaces de la barra de navegación.
   * @param {IntersectionObserverEntry[]} entries - Entradas de intersección reportadas.
   * @returns {void}
   */
  const handleIntersection = (entries) => {
    if (!Array.isArray(entries) || entries.length === 0) return;

    entries.forEach((entry) => {
      const section = /** @type {HTMLElement} */ (entry.target);
      if (!section) return;

      const rail = section.querySelector(".rail-horizontal");
      const sectionId = section.getAttribute("id");

      // Regla de Reseteo Automático: Cuando abandona completamente el viewport
      if (!entry.isIntersecting && rail) {
        const isRightPanel =
          rail.getAttribute("data-active-panel") === "1" ||
          rail.classList.contains("is-active-right");

        if (isRightPanel) {
          setHorizontalPanel(/** @type {HTMLElement} */ (rail), 0, true);
        }
      }

      // Sincronización de enlace activo en la navegación
      if (
        entry.isIntersecting &&
        entry.intersectionRatio >= CONFIG.intersectionThreshold &&
        sectionId
      ) {
        const navLinks = document.querySelectorAll(".app-nav .nav-link");
        navLinks.forEach((link) => {
          const href = link.getAttribute("href");
          const isTarget = href === `#${sectionId}`;
          link.classList.toggle("is-active", isTarget);
        });
      }
    });
  };

  /**
   * Actualiza el desplazamiento vertical contra-inercial de los textos (Vertical Counter-Parallax).
   * Cuando un div sube, su texto desciende; y el div que entra desde abajo recibe su texto descendiendo desde arriba.
   * Se ejecuta simultáneamente en ambos paneles hermanos (.panel-v-motion) para total independencia cartesiana.
   * Elimina el repintado de opacidad cuadro a cuadro para mantener nitidez tipográfica absoluta en pantallas móviles.
   * @returns {void}
   */
  const updateVerticalParallax = () => {
    verticalRafId = null;

    const viewportTrack = document.getElementById("viewportTrack");
    if (!viewportTrack) return;

    const trackHeight = viewportTrack.clientHeight || window.innerHeight;
    if (trackHeight <= 0) return;

    const scrollTop = viewportTrack.scrollTop;
    const scrollRatio = scrollTop / trackHeight;
    const travelMultiplier = 1.35;
    const travelDistance = travelMultiplier * trackHeight;
    const sections = viewportTrack.querySelectorAll(".section-v");

    sections.forEach((section, index) => {
      const py = index - scrollRatio;

      let yOffset = 0;
      let isVisible = true;

      if (py <= -1) {
        yOffset = travelDistance;
        isVisible = false;
      } else if (py >= 1) {
        yOffset = -travelDistance;
        isVisible = false;
      } else {
        yOffset = -py * travelDistance;
        isVisible = true;
      }

      const transformStr = `translate3d(0, ${Math.round(yOffset)}px, 0)`;
      const motionWrappers = section.querySelectorAll(".panel-v-motion");
      motionWrappers.forEach((wrapper) => {
        /** @type {HTMLElement} */ (wrapper).style.transform = transformStr;
        // Solo alternar opacidad cuando entra o sale completamente del viewport,
        // NUNCA mutar la opacidad cuadro a cuadro para evitar la invalidación de caché de fuentes en móviles
        const targetOpacity = isVisible ? "1" : "0";
        if (/** @type {HTMLElement} */ (wrapper).style.opacity !== targetOpacity) {
          /** @type {HTMLElement} */ (wrapper).style.opacity = targetOpacity;
        }
      });
    });
  };

  /**
   * Manejador pasivo del scroll en el track vertical con throttling por requestAnimationFrame.
   * @returns {void}
   */
  const handleVerticalScroll = () => {
    if (verticalRafId === null) {
      verticalRafId = requestAnimationFrame(updateVerticalParallax);
    }
  };

  /**
   * Inicializa los controles del menú desplegable inferior para dispositivos móviles.
   * Mantiene los íconos ocultos por defecto y expone un botón para desplegar/cerrar.
   * @returns {void}
   */
  const setupMobileMenu = () => {
    const toggleBtn = document.getElementById("navToggleBtn");
    const navList = document.getElementById("navList");

    if (!toggleBtn || !navList) return;

    /**
     * Alterna la visibilidad del menú móvil.
     * @param {boolean} [forceState] - Estado forzado opcional.
     * @returns {void}
     */
    const toggleMenu = (forceState) => {
      const isOpen =
        typeof forceState === "boolean"
          ? forceState
          : !navList.classList.contains("is-open");

      navList.classList.toggle("is-open", isOpen);
      toggleBtn.setAttribute("aria-expanded", String(isOpen));
      toggleBtn.setAttribute(
        "aria-label",
        isOpen ? "Cerrar menú de navegación" : "Desplegar menú de navegación",
      );
    };

    // Evento de clic en el botón expuesto
    toggleBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMenu();
    });

    /**
     * Manejador para la selección de enlaces en la navegación (Desktop y Móvil).
     * Ejecuta scroll suave programático y remueve el foco para evitar halos congelados.
     * @param {MouseEvent} event - Evento del clic.
     * @returns {void}
     */
    const handleNavLinkClick = (event) => {
      const target = /** @type {HTMLElement} */ (event.target);
      const link = target ? target.closest(".nav-link") : null;
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href || !href.startsWith("#")) return;

      const targetSection = document.querySelector(href);
      if (targetSection) {
        event.preventDefault();
        targetSection.scrollIntoView({ behavior: "smooth" });
      }

      // Desenfocar inmediatamente para limpiar pseudo-estados :focus/:active
      link.blur();
      toggleMenu(false);
    };

    navList.addEventListener("click", handleNavLinkClick);

    // Cerrar menú al hacer clic fuera
    document.addEventListener("click", (event) => {
      const target = /** @type {HTMLElement} */ (event.target);
      if (!target) return;
      if (!target.closest(".app-nav")) {
        toggleMenu(false);
      }
    });

    // Desenfocar cualquier enlace si se suelta el puntero fuera tras un intento de arrastre
    document.addEventListener("pointerup", () => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.classList.contains("nav-link") ||
          activeEl.classList.contains("nav-toggle"))
      ) {
        /** @type {HTMLElement} */ (activeEl).blur();
      }
    });

    // Prevenir el arrastre nativo (HTML5 Drag & Drop) que congela elementos de UI
    document.addEventListener("dragstart", (event) => {
      const target = /** @type {HTMLElement} */ (event.target);
      if (
        target &&
        (target.closest(".app-nav") || target.closest(".btn-nav-h"))
      ) {
        event.preventDefault();
      }
    });

    // Cerrar con la tecla Escape
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        toggleMenu(false);
      }
    });
  };

  /**
   * Inicializa los escuchadores de eventos y observadores de intersección.
   * @returns {void}
   */
  const init = () => {
    const viewportTrack = document.getElementById("viewportTrack");
    const sections = document.querySelectorAll(".section-v");

    if (!viewportTrack || sections.length === 0) {
      return;
    }

    // 1. Delegación de clics en botones de cambio horizontal
    viewportTrack.addEventListener("click", handleButtonClick);

    // 2. Detección de gestos táctiles (Mobile Swipe Horizontal + Snap Vertical Obligatorio)
    viewportTrack.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    viewportTrack.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    viewportTrack.addEventListener("touchend", handleTouchEnd, {
      passive: true,
    });

    // 3. Configuración del IntersectionObserver (Anticubo de Rubik y Sync de Navegación)
    const observerOptions = {
      root: viewportTrack,
      threshold: [0, CONFIG.intersectionThreshold],
    };

    sectionObserver = new IntersectionObserver(
      handleIntersection,
      observerOptions,
    );
    sections.forEach((section) => sectionObserver.observe(section));

    // 4. Cinemática Vertical: Counter-Parallax reactivo a 60fps
    viewportTrack.addEventListener("scroll", handleVerticalScroll, {
      passive: true,
    });
    window.addEventListener("scroll", handleVerticalScroll, { passive: true });
    window.addEventListener("resize", handleVerticalScroll, { passive: true });
    updateVerticalParallax();
    requestAnimationFrame(updateVerticalParallax);

    // 5. Inicialización del menú táctil inferior en móvil
    setupMobileMenu();
  };

  /**
   * Destruye observadores y limpia referencias para evitar fugas de memoria si fuese necesario.
   * @returns {void}
   */
  const destroy = () => {
    if (verticalRafId !== null) {
      cancelAnimationFrame(verticalRafId);
      verticalRafId = null;
    }
    window.removeEventListener("scroll", handleVerticalScroll);
    window.removeEventListener("resize", handleVerticalScroll);

    if (sectionObserver) {
      sectionObserver.disconnect();
      sectionObserver = null;
    }
    const viewportTrack = document.getElementById("viewportTrack");
    if (viewportTrack) {
      viewportTrack.removeEventListener("scroll", handleVerticalScroll);
      viewportTrack.removeEventListener("click", handleButtonClick);
      viewportTrack.removeEventListener("touchstart", handleTouchStart);
      viewportTrack.removeEventListener("touchmove", handleTouchMove);
      viewportTrack.removeEventListener("touchend", handleTouchEnd);
    }
  };

  return Object.freeze({
    init,
    destroy,
    setHorizontalPanel,
  });
})();

export default Navigation;
