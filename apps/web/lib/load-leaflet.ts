'use client';

const LEAFLET_SCRIPT_SRC = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_STYLESHEET_HREF = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

function ensureStylesheet(documentRef: Document) {
  if (documentRef.querySelector('link[data-leaflet="stylesheet"]')) {
    return;
  }

  const link = documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.href = LEAFLET_STYLESHEET_HREF;
  link.setAttribute('data-leaflet', 'stylesheet');
  documentRef.head.append(link);
}

function ensureScript(documentRef: Document): Promise<typeof window.L> {
  if (typeof window.L !== 'undefined') {
    return Promise.resolve(window.L);
  }

  if (window.__leafletLoaderPromise) {
    return window.__leafletLoaderPromise;
  }

  window.__leafletLoaderPromise = new Promise((resolve, reject) => {
    const existingScript = documentRef.querySelector('script[data-leaflet="script"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (typeof window.L !== 'undefined') {
          resolve(window.L);
        } else {
          reject(new Error('Leaflet failed to initialize.'));
        }
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('Failed to load Leaflet script.'));
      });
      return;
    }

    const script = documentRef.createElement('script');
    script.src = LEAFLET_SCRIPT_SRC;
    script.async = true;
    script.setAttribute('data-leaflet', 'script');

    script.addEventListener('load', () => {
      if (typeof window.L !== 'undefined') {
        resolve(window.L);
      } else {
        reject(new Error('Leaflet failed to initialize.'));
      }
    });

    script.addEventListener('error', () => {
      reject(new Error('Failed to load Leaflet script.'));
    });

    documentRef.head.append(script);
  });

  return window.__leafletLoaderPromise;
}

export async function loadLeaflet(): Promise<typeof window.L> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Leaflet can only be loaded in the browser.');
  }

  ensureStylesheet(document);
  return ensureScript(document);
}

declare global {
  interface Window {
    L: any;
    __leafletLoaderPromise?: Promise<typeof window.L>;
  }
}
