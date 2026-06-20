import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PenTool, Type, Eraser, RotateCcw } from 'lucide-react';

export interface SignatureResult {
  type: 'drawn' | 'typed';
  /** Base64 PNG data URL for drawn signatures, or the typed text */
  signatureData: string;
  /** Always a base64 PNG data URL (for typed, we render to canvas) */
  signatureImageDataUrl: string;
  typedName: string;
}

interface SignaturePadProps {
  investorName: string;
  onSignatureChange?: (result: SignatureResult | null) => void;
  disabled?: boolean;
}

export function SignaturePad({ investorName, onSignatureChange, disabled }: SignaturePadProps) {
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typedSignature, setTypedSignature] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedFont, setSelectedFont] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const typedCanvasRef = useRef<HTMLCanvasElement>(null);

  const FONTS = [
    { family: "'Brush Script MT', 'Segoe Script', cursive", label: 'Script' },
    { family: "'Georgia', serif", label: 'Formal' },
    { family: "'Lucida Handwriting', 'Comic Sans MS', cursive", label: 'Handwritten' },
    { family: "'Palatino Linotype', 'Book Antiqua', serif", label: 'Classic' },
  ];

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution for crisp drawing
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a365d';
    ctx.lineWidth = 2.5;

    // Draw signature line
    drawSignatureLine(ctx, rect.width, rect.height);
  }, []);

  const drawSignatureLine = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, height - 30);
    ctx.lineTo(width - 20, height - 30);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px sans-serif';
    ctx.fillText('Sign above this line', 20, height - 12);
    ctx.restore();
  };

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCanvasCoords(e, canvas);
    ctx.strokeStyle = '#1a365d';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    emitSignature();
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCanvasCoords(e, canvas);
    ctx.strokeStyle = '#1a365d';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(false);
    emitSignature();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(1 / dpr, 1 / dpr);
    ctx.scale(dpr, dpr);
    drawSignatureLine(ctx, rect.width, rect.height);
    setHasDrawn(false);
    onSignatureChange?.(null);
  };

  const emitSignature = useCallback(() => {
    if (mode === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) {
        onSignatureChange?.(null);
        return;
      }
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureChange?.({
        type: 'drawn',
        signatureData: dataUrl,
        signatureImageDataUrl: dataUrl,
        typedName: investorName,
      });
    }
  }, [mode, hasDrawn, investorName, onSignatureChange]);

  // Generate typed signature image
  const generateTypedSignatureImage = useCallback((text: string): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 600, 150);

    // Signature line
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, 110);
    ctx.lineTo(580, 110);
    ctx.stroke();
    ctx.setLineDash([]);

    // Signature text
    ctx.fillStyle = '#1a365d';
    ctx.font = `italic 36px ${FONTS[selectedFont].family}`;
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, 30, 105);

    return canvas.toDataURL('image/png');
  }, [selectedFont]);

  // Emit typed signature changes
  useEffect(() => {
    if (mode === 'type') {
      if (!typedSignature.trim()) {
        onSignatureChange?.(null);
        return;
      }
      const imageDataUrl = generateTypedSignatureImage(typedSignature);
      onSignatureChange?.({
        type: 'typed',
        signatureData: typedSignature,
        signatureImageDataUrl: imageDataUrl,
        typedName: typedSignature,
      });
    }
  }, [mode, typedSignature, selectedFont, generateTypedSignatureImage, onSignatureChange]);

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2">
        <Label className="text-sm font-semibold text-gray-700 mr-2">Signature Method:</Label>
        <button
          type="button"
          onClick={() => { setMode('draw'); onSignatureChange?.(null); }}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            mode === 'draw'
              ? 'bg-[#1a365d] text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <PenTool className="w-3.5 h-3.5" />
          Draw
        </button>
        <button
          type="button"
          onClick={() => { setMode('type'); onSignatureChange?.(null); }}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            mode === 'type'
              ? 'bg-[#1a365d] text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          Type
        </button>
      </div>

      {mode === 'draw' ? (
        <div ref={containerRef} className="space-y-2">
          <div className="relative border-2 border-gray-200 rounded-xl bg-white overflow-hidden shadow-inner">
            <canvas
              ref={canvasRef}
              className="w-full cursor-crosshair touch-none"
              style={{ height: '180px' }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-300 text-lg font-medium">Draw your signature here</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Use your mouse or finger to sign</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearCanvas}
              disabled={disabled || !hasDrawn}
              className="text-xs h-7 px-2 text-gray-500 hover:text-red-600"
            >
              <Eraser className="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="typed-sig" className="text-sm text-gray-600">
              Type your full legal name exactly as: <span className="font-semibold text-gray-900">{investorName}</span>
            </Label>
            <Input
              id="typed-sig"
              value={typedSignature}
              onChange={(e) => setTypedSignature(e.target.value)}
              placeholder={investorName}
              disabled={disabled}
              className="mt-1.5 text-lg h-12"
              style={{ fontFamily: FONTS[selectedFont].family, fontStyle: 'italic' }}
              autoComplete="off"
            />
          </div>

          {/* Font selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Style:</span>
            {FONTS.map((font, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedFont(i)}
                disabled={disabled}
                className={`px-3 py-1 rounded-md text-sm transition-all ${
                  selectedFont === i
                    ? 'bg-[#1a365d] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={{ fontFamily: font.family, fontStyle: 'italic' }}
              >
                {font.label}
              </button>
            ))}
          </div>

          {/* Preview */}
          {typedSignature && (
            <div className="border-2 border-dashed border-[#d4a574]/40 rounded-xl p-4 bg-amber-50/30">
              <p className="text-xs text-gray-400 mb-2">Signature Preview:</p>
              <div className="relative">
                <p
                  className="text-3xl text-[#1a365d] pb-2"
                  style={{ fontFamily: FONTS[selectedFont].family, fontStyle: 'italic' }}
                >
                  {typedSignature}
                </p>
                <div className="border-b border-gray-300 border-dashed" />
              </div>
            </div>
          )}

          {typedSignature && typedSignature.trim().toLowerCase() !== investorName.trim().toLowerCase() && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Name should match: "{investorName}" for verification
            </p>
          )}
        </div>
      )}
    </div>
  );
}
