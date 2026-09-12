/**
 * Dedicated Barcode & Label Printing Service
 * Handles isolated iframe printing, cross-browser support, A4 sheet vs Thermal roll layouts,
 * and high-contrast SVG vector rendering for POS barcode scanners.
 */

export interface PrintLabelsOptions {
  title?: string;
  layout?: 'sheet' | 'roll58' | 'roll80';
  labelSize?: 'standard' | 'compact' | 'jewelry';
  columns?: number;
}

/**
 * Serializes an HTML element with full SVG graphics, high-contrast styles,
 * and page-break rules into an isolated printable document.
 */
export function printBarcodeContainer(
  containerElement: HTMLElement,
  options: PrintLabelsOptions = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    const layout = options.layout || 'sheet';
    const title = options.title || 'Print Barcode Labels';

    // Clone element to manipulate SVGs safely without mutating live UI
    const clonedContainer = containerElement.cloneNode(true) as HTMLElement;

    // Ensure all SVGs have proper XML namespaces and crisp rendering attributes
    const svgs = clonedContainer.querySelectorAll('svg');
    svgs.forEach((svg) => {
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('shape-rendering', 'crispEdges');
      svg.style.display = 'block';
      svg.style.margin = '0 auto';
    });

    // Page styling based on selected layout (A4 sticker sheet vs Thermal roll)
    let pageCss = '';
    let gridCss = '';

    if (layout === 'roll58') {
      pageCss = `
        @page {
          size: 58mm auto;
          margin: 1mm 2mm;
        }
        body {
          width: 54mm;
          max-width: 54mm;
          margin: 0 auto;
          padding: 1mm 0;
        }
      `;
      gridCss = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4mm;
        width: 100%;
      `;
    } else if (layout === 'roll80') {
      pageCss = `
        @page {
          size: 80mm auto;
          margin: 2mm 3mm;
        }
        body {
          width: 74mm;
          max-width: 74mm;
          margin: 0 auto;
          padding: 2mm 0;
        }
      `;
      gridCss = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5mm;
        width: 100%;
      `;
    } else {
      // Standard A4 / Letter sheet layout (2 to 4 columns grid)
      pageCss = `
        @page {
          size: A4 portrait;
          margin: 8mm 6mm;
        }
        body {
          margin: 0;
          padding: 0;
          background: #ffffff;
        }
      `;
      const cols = options.columns || 3;
      gridCss = `
        display: grid;
        grid-template-columns: repeat(${cols}, minmax(0, 1fr));
        gap: 3.5mm;
        width: 100%;
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            ${pageCss}
            body {
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #000000;
              background-color: #ffffff;
            }
            .print-grid {
              ${gridCss}
            }
            .barcode-label-card {
              background: #ffffff !important;
              border: 1px dashed #666666 !important;
              border-radius: 4px !important;
              padding: 6px 4px !important;
              text-align: center !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: space-between !important;
              overflow: hidden !important;
            }
            .business-name {
              font-size: 8px !important;
              font-weight: 900 !important;
              text-transform: uppercase !important;
              letter-spacing: 0.5px !important;
              color: #333333 !important;
              line-height: 1.1 !important;
              margin-bottom: 2px !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
              max-width: 100% !important;
            }
            .product-name {
              font-size: 10px !important;
              font-weight: 700 !important;
              color: #000000 !important;
              line-height: 1.2 !important;
              margin-bottom: 2px !important;
              display: -webkit-box !important;
              -webkit-line-clamp: 2 !important;
              -webkit-box-orient: vertical !important;
              overflow: hidden !important;
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
              font-weight: 600 !important;
              color: #444444 !important;
              margin-right: 2px !important;
            }
          </style>
        </head>
        <body>
          <div class="print-grid">
            ${clonedContainer.innerHTML}
          </div>
        </body>
      </html>
    `;

    // Strategy 1: Hidden Iframe Print
    // Creates an isolated frame so parent DOM / AI Studio styles don't conflict
    try {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('style', 'position:fixed;top:-10000px;left:-10000px;width:1px;height:1px;border:0;');
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!frameDoc) {
        throw new Error('Failed to acquire iframe document');
      }

      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();

      const triggerPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            try {
              document.body.removeChild(iframe);
            } catch {
              // Ignore removal failure
            }
            resolve(true);
          }, 1000);
        } catch (err) {
          console.warn('Iframe print failed, falling back to window.print():', err);
          fallbackWindowPrint(resolve);
        }
      };

      // Ensure iframe content is rendered before triggering print dialog
      if (iframe.contentWindow) {
        iframe.contentWindow.onload = () => {
          setTimeout(triggerPrint, 250);
        };
        // Safety timeout in case onload doesn't fire
        setTimeout(triggerPrint, 600);
      } else {
        triggerPrint();
      }
    } catch (e) {
      console.warn('Could not use iframe printing, attempting fallback window print:', e);
      fallbackWindowPrint(resolve);
    }
  });
}

function fallbackWindowPrint(resolve: (val: boolean) => void) {
  try {
    document.body.classList.add('is-printing-barcode-labels');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('is-printing-barcode-labels');
      resolve(true);
    }, 500);
  } catch (err) {
    console.error('All print attempts failed:', err);
    resolve(false);
  }
}
