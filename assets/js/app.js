/**
 * @file app.js
 * @module App
 * @description Orquestador de arranque principal para Roller Today.
 * Importa e inicializa los módulos Vanilla ES6+ una vez que el árbol DOM está completamente listo.
 */

import { Navigation } from './navigation.js';

/**
 * Función de inicialización del ciclo de vida de la aplicación.
 * @returns {void}
 */
const bootstrap = () => {
  try {
    Navigation.init();
  } catch (error) {
    // Manejo seguro de errores sin comprometer la navegación estándar del navegador
    console.error('[Roller Today] Error al inicializar el controlador de navegación:', error);
  }
};

/**
 * Escucha el evento DOMContentLoaded o ejecuta de inmediato si el documento ya está cargado.
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
