/**
 * Dedicated Barcode & Label Printing Service
 * Handles direct in-DOM print overlays, thermal roll (58mm/80mm) vs A4 sheet layouts,
 * high-contrast SVG vector rendering for POS barcode scanners, and cross-browser reliability.
 */

export interface PrintLabelsOptions {
  title?: string;
  layout?: 'sheet' | 'roll58' | 'roll80';
  labelSize?: 'standard' | 'compact' | 'jewelry';
  columns?: number;
}

/**
 * Checks if the app is currently running inside an iframe.
 * Browsers restrict WebUSB and WebBluetooth inside cross-origin or sandboxed iframes.
 */
export function isAppInsideIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Primary In-DOM Browser Print
 * Attaches an isolated, high-contrast print mount directly to document.body,
 * applies precise @page and @media print rules for continuous thermal roll or sticker sheets,
 * and triggers window.print(). This bypasses iframe sandbox and popup-blocker restrictions.
 */
export function printBarcodeDirectly(
  containerElement: HTMLElement,
  options: PrintLabelsOptions = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    const layout = options.layout || 'roll58';
    const title = options.title || 'Print Barcode Labels';

    // Remove any previous print mount if lingering
    const existingMount = document.getElementById('pos-thermal-print-mount');
    if (existingMount) {
      existingMount.remove();
    }
    const existingStyle = document.getElementById('pos-thermal-print-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Clone element to manipulate SVGs safely without mutating live UI
    const clonedContainer = containerElement.cloneNode(true) as HTMLElement;

    // Ensure all SVGs have proper XML namespaces and crisp vector rendering
    const svgs = clonedContainer.querySelectorAll('svg');
    svgs.forEach((svg) => {
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('shape-rendering', 'crispEdges');
      svg.style.display = 'block';
      svg.style.margin = '0 auto';
    });

    // Create mount container
    const mount = document.createElement('div');
    mount.id = 'pos-thermal-print-mount';

    // Page CSS and layout CSS based on paper format
    let pageCss = '';
    let containerWidth = '48mm';

    if (layout === 'roll58') {
      pageCss = `
        @page {
          size: 58mm auto;
          margin: 0mm !important;
        }
      `;
      containerWidth = '48mm';
    } else if (layout === 'roll80') {
      pageCss = `
        @page {
          size: 80mm auto;
          margin: 0mm !important;
        }
      `;
      containerWidth = '72mm';
    } else {
      // A4 / Letter sheet
      const cols = options.columns || 3;
      pageCss = `
        @page {
          size: A4 portrait;
          margin: 8mm 6mm !important;
        }
      `;
      containerWidth = '100%';
    }

    // Inject temporary print styles
    const styleEl = document.createElement('style');
    styleEl.id = 'pos-thermal-print-styles';
    styleEl.textContent = `
      ${pageCss}

      @media screen {
        #pos-thermal-print-mount {
          display: none !important;
        }
      }

      @media print {
        /* Hide everything in the POS except our dedicated print mount */
        body > *:not(#pos-thermal-print-mount) {
          display: none !important;
        }

        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          width: 100% !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        #pos-thermal-print-mount {
          display: block !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          background: #ffffff !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        .thermal-print-wrapper {
          width: ${containerWidth};
          margin: 0 auto;
          padding: 1mm 0 12mm 0; /* 12mm bottom buffer for clean tear-off */
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3mm;
        }

        .sheet-print-wrapper {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(${options.columns || 3}, minmax(0, 1fr));
          gap: 3.5mm;
          padding: 2mm 0;
        }

        .barcode-label-card {
          background: #ffffff !important;
          border: 1px dashed #666666 !important;
          border-radius: 4px !important;
          padding: 5px 3px !important;
          text-align: center !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: space-between !important;
          box-sizing: border-box !important;
          width: 100% !important;
        }

        .business-name {
          font-size: 8px !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          color: #222222 !important;
          line-height: 1.1 !important;
          margin-bottom: 2px !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          max-width: 100% !important;
        }

        .product-name {
          font-size: 10px !important;
          font-weight: 800 !important;
          color: #000000 !important;
          line-height: 1.2 !important;
          margin-bottom: 2px !important;
          text-align: center !important;
        }

        .barcode-wrapper {
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          width: 100% !important;
          margin: 2px 0 !important;
        }

        .barcode-wrapper svg {
          max-width: 100% !important;
          height: auto !important;
        }

        .price-tag {
          font-size: 11px !important;
          font-weight: 900 !important;
          color: #000000 !important;
          margin-top: 2px !important;
        }

        .price-tag .curr {
          font-size: 9px !important;
          font-weight: 700 !important;
          color: #444444 !important;
          margin-right: 2px !important;
        }
      }
    `;
    document.head.appendChild(styleEl);

    // Populate mount
    const wrapperClass = layout === 'sheet' ? 'sheet-print-wrapper' : 'thermal-print-wrapper';
    mount.innerHTML = `<div class="${wrapperClass}">${clonedContainer.innerHTML}</div>`;
    document.body.appendChild(mount);

    // Save previous document title temporarily for clean print job name
    const originalTitle = document.title;
    document.title = title;

    const cleanup = () => {
      document.title = originalTitle;
      setTimeout(() => {
        try {
          mount.remove();
          styleEl.remove();
        } catch {
          // ignore
        }
      }, 500);
      resolve(true);
    };

    // Clean up on afterprint event
    const handleAfterPrint = () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      cleanup();
    };
    window.addEventListener('afterprint', handleAfterPrint);

    // Small delay to ensure styles and SVGs are calculated before opening print dialog
    setTimeout(() => {
      try {
        window.focus();
        window.print();
        // Fallback cleanup if afterprint doesn't fire
        setTimeout(cleanup, 2000);
      } catch (err) {
        console.error('window.print() error:', err);
        cleanup();
      }
    }, 150);
  });
}

/**
 * Standard Print Function: Attempts In-DOM printing first,
 * with fallback to popup window if needed.
 */
export async function printBarcodeContainer(
  containerElement: HTMLElement,
  options: PrintLabelsOptions = {}
): Promise<boolean> {
  try {
    return await printBarcodeDirectly(containerElement, options);
  } catch (err) {
    console.warn('In-DOM print failed, trying popup window:', err);
    return openBarcodePrintWindow(containerElement, options);
  }
}

/**
 * Fallback to open a dedicated print window.
 * Bypasses iframe sandboxing and allows user to interact directly with the print window.
 */
export function openBarcodePrintWindow(
  containerElement: HTMLElement,
  options: PrintLabelsOptions = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const layout = options.layout || 'roll58';
      const title = options.title || 'Print Barcode Labels';
      const clonedContainer = containerElement.cloneNode(true) as HTMLElement;

      const svgs = clonedContainer.querySelectorAll('svg');
      svgs.forEach((svg) => {
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttribute('shape-rendering', 'crispEdges');
        svg.style.display = 'block';
        svg.style.margin = '0 auto';
      });

      let pageCss = '';
      let widthCss = '48mm';

      if (layout === 'roll58') {
        pageCss = `@page { size: 58mm auto; margin: 0mm; }`;
        widthCss = '48mm';
      } else if (layout === 'roll80') {
        pageCss = `@page { size: 80mm auto; margin: 0mm; }`;
        widthCss = '72mm';
      } else {
        const cols = options.columns || 3;
        pageCss = `@page { size: A4 portrait; margin: 8mm 6mm; }`;
        widthCss = '100%';
      }

      const win = window.open('', '_blank', 'width=800,height=900');
      if (!win) {
        // Popups might be blocked, use in-DOM print
        printBarcodeDirectly(containerElement, options).then(resolve);
        return;
      }

      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${title}</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              ${pageCss}
              body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #000; background: #fff; padding: 10px; }
              .print-grid {
                width: ${widthCss};
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                gap: 4mm;
                padding-bottom: 12mm;
              }
              .barcode-label-card { background: #fff !important; border: 1px dashed #666 !important; border-radius: 4px !important; padding: 6px 4px !important; text-align: center !important; page-break-inside: avoid !important; break-inside: avoid !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: space-between !important; }
              .business-name { font-size: 8px !important; font-weight: 900 !important; text-transform: uppercase !important; color: #222 !important; margin-bottom: 2px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
              .product-name { font-size: 10px !important; font-weight: 700 !important; color: #000 !important; margin-bottom: 2px !important; line-height: 1.2 !important; }
              .barcode-wrapper { display: flex !important; justify-content: center !important; margin: 2px 0 !important; }
              .price-tag { font-size: 11px !important; font-weight: 900 !important; color: #000 !important; margin-top: 2px !important; }
              .price-tag .curr { font-size: 9px !important; font-weight: 600 !important; color: #444 !important; margin-right: 2px !important; }
              @media screen {
                .screen-banner { background: #0f172a; color: white; padding: 14px; text-align: center; font-size: 14px; margin-bottom: 16px; border-radius: 12px; font-family: sans-serif; display: flex; align-items: center; justify-content: space-between; }
                .screen-banner button { background: #f59e0b; color: #0f172a; border: none; padding: 8px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; }
              }
              @media print {
                body { padding: 0 !important; }
                .screen-banner { display: none !important; }
              }
            </style>
          </head>
          <body>
            <div class="screen-banner">
              <span>Ready to print ${options.layout === 'sheet' ? 'Sticker Sheet' : 'Thermal Roll Labels'}</span>
              <button onclick="window.print()">Open Print Dialog</button>
            </div>
            <div class="print-grid">
              ${clonedContainer.innerHTML}
            </div>
          </body>
        </html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => {
        try {
          win.print();
        } catch (e) {
          console.warn('Window print trigger failed:', e);
        }
        resolve(true);
      }, 500);
    } catch (e) {
      console.warn('Popup window print failed, falling back to in-DOM print:', e);
      printBarcodeDirectly(containerElement, options).then(resolve);
    }
  });
}
