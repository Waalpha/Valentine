import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeSvgProps {
  value: string;
  format?: 'CODE128' | 'EAN13' | 'UPC' | 'pharmacode';
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  className?: string;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  format = 'CODE128',
  width = 1.8,
  height = 42,
  displayValue = true,
  fontSize = 12,
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (!svgRef.current || !value) {
      setRenderError(true);
      return;
    }

    try {
      setRenderError(false);
      // Clean string
      const cleanVal = String(value ?? '').trim();
      if (!cleanVal) {
        setRenderError(true);
        return;
      }
      
      // Determine format automatically if requested format might fail
      let chosenFormat = format;
      if (chosenFormat === 'EAN13' && cleanVal.length !== 13) {
        chosenFormat = 'CODE128';
      } else if (chosenFormat === 'UPC' && cleanVal.length !== 12) {
        chosenFormat = 'CODE128';
      }

      JsBarcode(svgRef.current, cleanVal, {
        format: chosenFormat,
        width,
        height,
        displayValue,
        fontSize,
        font: 'monospace',
        fontOptions: 'bold',
        textAlign: 'center',
        textPosition: 'bottom',
        textMargin: 2,
        background: '#ffffff',
        lineColor: '#000000',
        margin: 4
      });
    } catch (err) {
      // Fallback try with generic CODE128 if specific format failed
      try {
        if (svgRef.current) {
          JsBarcode(svgRef.current, String(value ?? '').trim(), {
            format: 'CODE128',
            width,
            height,
            displayValue,
            fontSize,
            font: 'monospace',
            background: '#ffffff',
            lineColor: '#000000',
            margin: 4
          });
          setRenderError(false);
        }
      } catch {
        setRenderError(true);
      }
    }
  }, [value, format, width, height, displayValue, fontSize]);

  if (!value) return null;

  if (renderError) {
    return (
      <div className={`flex flex-col items-center justify-center p-2 border border-dashed border-gray-300 rounded bg-gray-50 text-xs font-mono text-gray-600 ${className}`}>
        <span>{value}</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center justify-center overflow-hidden bg-white ${className}`}>
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        className="max-w-full h-auto block"
        style={{ shapeRendering: 'crispEdges' }}
      />
    </div>
  );
};
