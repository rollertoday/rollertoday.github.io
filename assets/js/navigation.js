/**
 * @file navigation.js
 * @module Navigation
 * @description Controlador cartesiano de navegación 2D para Roller Today.
 * Administra el desplazamiento vertical y horizontal mediante rieles acelerados por GPU,
 * gestos táctiles fluidos, eventos de rueda de ratón con candado cinemático, navegación
 * por teclado, reseteo de paneles (Anticubo de Rubik) y menú móvil táctil.
 * Opera 100% sobre CSS Transitions del Compositor thread para erradicar el blur en móviles.
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
 * @property {number} verticalSwipeThreshold - Distancia mínima en píxeles para validar un swipe vertical.
 * @property {number} transitionDurationMs - Duración del bloqueo cinemático durante la transición.
 */

export const Navigation = (() => {
  /**
   * Configuración inmutable del controlador.
   * @type {NavigationConfig}
   */
  const CONFIG = Object.freeze({
    swipeThreshold: 40,
    verticalSwipeThreshold: 40,
    transitionDurationMs: 800,
  });

  /**
   * Índice de la sección vertical actualmente activa (0 a 5).
   * @type {number}
   */
  let activeVerticalIndex = 0;

  /**
   * Bandera para prevenir disparos múltiples mientras se anima el riel vertical.
   * @type {boolean}
   */
  let isVerticalTransitioning = false;

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
      void railElement.offsetWidth;
      railElement.classList.remove("no-transition");
    }
  };

  /**
   * Desplaza el riel vertical hacia la sección especificada con cinemática GPU pura.
   * Actualiza la máquina de estados CSS (active, prev, next) para activar el counter-parallax
   * de texto y el parallax suave de fondos de manera totalmente independiente del hilo JS.
   * @param {number} targetIndex - Índice de la sección vertical de destino (0 a N-1).
   * @param {boolean} [silent=false] - Si es verdadero, desactiva la animación de desplazamiento.
   * @returns {void}
   */
  const setVerticalSection = (targetIndex, silent = false) => {
    const railVertical = document.getElementById("railVertical");
    const sections = document.querySelectorAll(".section-v");

    if (!railVertical || sections.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(sections.length - 1, targetIndex));

    if (clampedIndex === activeVerticalIndex && !silent) return;

    const prevIndex = activeVerticalIndex;
    activeVerticalIndex = clampedIndex;

    // 1. Candado cinemático para evitar saltos en ráfaga
    if (!silent) {
      isVerticalTransitioning = true;
      setTimeout(() => {
        isVerticalTransitioning = false;
      }, CONFIG.transitionDurationMs);
    }

    // 2. Aplicar transición instantánea o animada en el riel vertical
    if (silent) {
      railVertical.classList.add("no-transition");
    }

    railVertical.style.transform = `translate3d(0, -${clampedIndex * 100}%, 0)`;

    if (silent) {
      void railVertical.offsetWidth;
      railVertical.classList.remove("no-transition");
    }

    // 3. Actualizar estados semánticos verticales para counter-parallax CSS
    sections.forEach((section, index) => {
      /** @type {HTMLElement} */ (section).classList.toggle(
        "is-active",
        index === clampedIndex,
      );

      if (index === clampedIndex) {
        section.dataset.vState = "active";
      } else if (index < clampedIndex) {
        section.dataset.vState = "prev";
      } else {
        section.dataset.vState = "next";
      }
    });

    // 4. Regla de Reseteo Automático (Anticubo de Rubik)
    // Al abandonar una sección vertical, retornar su riel horizontal al panel H0 silenciosamente
    if (prevIndex !== clampedIndex && sections[prevIndex]) {
      const prevRail = sections[prevIndex].querySelector(".rail-horizontal");
      if (prevRail) {
        const isRightPanel =
          prevRail.getAttribute("data-active-panel") === "1" ||
          prevRail.classList.contains("is-active-right");
        if (isRightPanel) {
          setHorizontalPanel(/** @type {HTMLElement} */ (prevRail), 0, true);
        }
      }
    }

    // 5. Sincronizar enlace activo en la barra de navegación superior/móvil
    const targetSection = sections[clampedIndex];
    if (targetSection) {
      const sectionId = targetSection.getAttribute("id");
      const navLinks = document.querySelectorAll(".app-nav .nav-link");
      navLinks.forEach((link) => {
        const href = link.getAttribute("href");
        link.classList.toggle("is-active", href === `#${sectionId}`);
      });
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
   * Manejador de la rueda del ratón y touchpads con candado cinemático.
   * Dispara una sección limpia por cada impulso sin arrastre paulatino ni blur.
   * @param {WheelEvent} event - Evento de rueda de ratón.
   * @returns {void}
   */
  const handleWheel = (event) => {
    if (event.ctrlKey) return; // Permitir zoom del navegador si se solicita

    event.preventDefault();

    if (isVerticalTransitioning) return;

    // Filtrar micro-ruido de aceleración en trackpads
    if (Math.abs(event.deltaY) < 16) return;

    const direction = event.deltaY > 0 ? 1 : -1;
    setVerticalSection(activeVerticalIndex + direction);
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
      return;
    }

    const touch = event.touches[0];
    touchStartCoords = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    touchAxisLock = null;
  };

  /**
   * Manejador de movimiento táctil. Bloquea el rebote del navegador
   * y detecta tempranamente la dominancia de eje para una respuesta ágil.
   * @param {TouchEvent} event - Evento touchmove.
   * @returns {void}
   */
  const handleTouchMove = (event) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (!touchStartCoords || !event.touches || event.touches.length === 0) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartCoords.x;
    const deltaY = touch.clientY - touchStartCoords.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (!touchAxisLock) {
      if (absDeltaY > absDeltaX && absDeltaY >= 8) {
        touchAxisLock = "vertical";
      } else if (absDeltaX > absDeltaY && absDeltaX >= 8) {
        touchAxisLock = "horizontal";
      }
    }
  };

  /**
   * Evalúa el gesto táctil al levantar el dedo y ejecuta la transición cartesiana correspondiente.
   * @param {TouchEvent} event - Evento touchend.
   * @returns {void}
   */
  const handleTouchEnd = (event) => {
    const coords = touchStartCoords;
    const axisLock = touchAxisLock;

    touchStartCoords = null;
    touchAxisLock = null;

    if (!coords || !event.changedTouches || event.changedTouches.length === 0) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - coords.x;
    const deltaY = touch.clientY - coords.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Caso 1: Gesto horizontal dominante (H0 <-> H1)
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
        setHorizontalPanel(/** @type {HTMLElement} */ (rail), 1, false);
      } else if (deltaX > 0 && currentPanel === 1) {
        setHorizontalPanel(/** @type {HTMLElement} */ (rail), 0, false);
      }
      return;
    }

    // Caso 2: Gesto vertical dominante (Sección siguiente o anterior)
    if (
      axisLock === "vertical" ||
      (absDeltaY >= CONFIG.verticalSwipeThreshold && absDeltaY > absDeltaX)
    ) {
      if (isVerticalTransitioning) return;
      const direction = deltaY < 0 ? 1 : -1;
      setVerticalSection(activeVerticalIndex + direction);
    }
  };

  /**
   * Manejador de navegación por teclado accesible.
   * @param {KeyboardEvent} event - Evento de teclado.
   * @returns {void}
   */
  const handleKeyDown = (event) => {
    const activeEl = document.activeElement;
    if (
      activeEl &&
      (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")
    ) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
      case "PageDown":
        event.preventDefault();
        setVerticalSection(activeVerticalIndex + 1);
        break;

      case "ArrowUp":
      case "PageUp":
        event.preventDefault();
        setVerticalSection(activeVerticalIndex - 1);
        break;

      case "Home":
        event.preventDefault();
        setVerticalSection(0);
        break;

      case "End": {
        event.preventDefault();
        const sections = document.querySelectorAll(".section-v");
        setVerticalSection(sections.length - 1);
        break;
      }

      case "ArrowRight": {
        const sections = document.querySelectorAll(".section-v");
        const currentSec = sections[activeVerticalIndex];
        if (currentSec) {
          const rail = currentSec.querySelector(".rail-horizontal");
          if (rail) {
            setHorizontalPanel(/** @type {HTMLElement} */ (rail), 1, false);
          }
        }
        break;
      }

      case "ArrowLeft": {
        const sections = document.querySelectorAll(".section-v");
        const currentSec = sections[activeVerticalIndex];
        if (currentSec) {
          const rail = currentSec.querySelector(".rail-horizontal");
          if (rail) {
            setHorizontalPanel(/** @type {HTMLElement} */ (rail), 0, false);
          }
        }
        break;
      }

      default:
        break;
    }
  };

  /**
   * Inicializa los controles del menú desplegable inferior para dispositivos móviles
   * y delega los eventos de clic en los enlaces de navegación.
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

    toggleBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMenu();
    });

    /**
     * Manejador para la selección de enlaces en la navegación (Desktop y Móvil).
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
        const sections = Array.from(document.querySelectorAll(".section-v"));
        const targetIndex = sections.indexOf(/** @type {HTMLElement} */ (targetSection));
        if (targetIndex !== -1) {
          setVerticalSection(targetIndex);
        }
      }

      link.blur();
      toggleMenu(false);
    };

    navList.addEventListener("click", handleNavLinkClick);

    // Delegar clics en cualquier enlace de navegación que no esté en navList (ej. escritorio)
    const appNav = document.querySelector(".app-nav");
    if (appNav) {
      appNav.addEventListener("click", handleNavLinkClick);
    }

    // Cerrar menú al hacer clic fuera
    document.addEventListener("click", (event) => {
      const target = /** @type {HTMLElement} */ (event.target);
      if (!target) return;
      if (!target.closest(".app-nav")) {
        toggleMenu(false);
      }
    });

    // Desenfocar elementos tras interacción táctil
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

    // Cerrar menú con tecla Escape
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        toggleMenu(false);
      }
    });
  };

  /**
   * Inicializa el controlador cartesiano, vincula los escuchadores de eventos
   * y posiciona el estado inicial de la matriz 2D.
   * @returns {void}
   */
  const init = () => {
    const viewportTrack = document.getElementById("viewportTrack");
    const railVertical = document.getElementById("railVertical");
    const sections = document.querySelectorAll(".section-v");

    if (!viewportTrack || !railVertical || sections.length === 0) {
      return;
    }

    // 1. Delegación de clics en botones de cambio horizontal
    viewportTrack.addEventListener("click", handleButtonClick);

    // 2. Control de desplazamiento vertical por rueda del ratón con candado cinemático
    viewportTrack.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("wheel", handleWheel, { passive: false });

    // 3. Reconocimiento de gestos táctiles (Swipe Vertical / Horizontal)
    viewportTrack.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    viewportTrack.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    viewportTrack.addEventListener("touchend", handleTouchEnd, {
      passive: true,
    });

    // 4. Navegación por teclado
    window.addEventListener("keydown", handleKeyDown);

    // 5. Menú táctil inferior y enlaces de barra de navegación
    setupMobileMenu();

    // 6. Aplicar posición inicial silenciosamente (Sección 0, Panel Izquierdo)
    setVerticalSection(0, true);
  };

  /**
   * Destruye escuchadores de eventos y limpia referencias para evitar fugas de memoria.
   * @returns {void}
   */
  const destroy = () => {
    window.removeEventListener("wheel", handleWheel);
    window.removeEventListener("keydown", handleKeyDown);

    const viewportTrack = document.getElementById("viewportTrack");
    if (viewportTrack) {
      viewportTrack.removeEventListener("wheel", handleWheel);
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
    setVerticalSection,
  });
})();

export default Navigation;
