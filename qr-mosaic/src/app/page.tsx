'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import QRCode from 'qrcode';

// ----- Types -----

interface ImageTile {
  id: string;
  name: string;
  thumb: string;     // data URL thumbnail for the UI
  bitmap: ImageBitmap; // full-res for rendering
  avgColor: [number, number, number];
}

type FillMode = 'random' | 'color-match' | 'sequential';
type LightModuleStyle = 'white' | 'faded' | 'invert';

// ----- Helpers -----

function avgColorOfBitmap(bitmap: ImageBitmap): [number, number, number] {
  const size = 32;
  const c = new OffscreenCanvas(size, size);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, size, size);
  const d = ctx.getImageData(0, 0, size, size).data;
  let r = 0, g = 0, b = 0;
  const px = size * size;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i]; g += d[i + 1]; b += d[i + 2];
  }
  return [Math.round(r / px), Math.round(g / px), Math.round(b / px)];
}

function luminance(c: [number, number, number]) {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
}

function colorDistance(a: [number, number, number], b: [number, number, number]) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

// ----- Main Component -----

export default function QRMosaicPage() {
  // State
  const [text, setText] = useState('');
  const [tiles, setTiles] = useState<ImageTile[]>([]);
  const [fillMode, setFillMode] = useState<FillMode>('random');
  const [lightStyle, setLightStyle] = useState<LightModuleStyle>('faded');
  const [tileSize, setTileSize] = useState(16);
  const [qrModules, setQrModules] = useState<boolean[][] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errorCorrection, setErrorCorrection] = useState<'L' | 'M' | 'Q' | 'H'>('H');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Image upload handling ---

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const newTiles: ImageTile[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const bitmap = await createImageBitmap(file);
        // Make square crop from center
        const minDim = Math.min(bitmap.width, bitmap.height);
        const sx = (bitmap.width - minDim) / 2;
        const sy = (bitmap.height - minDim) / 2;
        const cropped = await createImageBitmap(bitmap, sx, sy, minDim, minDim);

        // Thumbnail
        const thumbCanvas = new OffscreenCanvas(64, 64);
        const tctx = thumbCanvas.getContext('2d')!;
        tctx.drawImage(cropped, 0, 0, 64, 64);
        const blob = await thumbCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
        const thumb = await blobToDataURL(blob);

        newTiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          thumb,
          bitmap: cropped,
          avgColor: avgColorOfBitmap(cropped),
        });
      } catch {
        // Skip unreadable files
      }
    }
    setTiles(prev => [...prev, ...newTiles]);
  }, []);

  function blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const removeTile = useCallback((id: string) => {
    setTiles(prev => prev.filter(t => t.id !== id));
  }, []);

  // --- QR generation ---

  const generateQR = useCallback(async () => {
    if (!text.trim() || tiles.length === 0) return;
    setGenerating(true);

    try {
      // Generate QR matrix
      const qr = QRCode.create(text, { errorCorrectionLevel: errorCorrection });
      const modules = qr.modules;
      const size = modules.size;
      const data = modules.data;

      // Build 2D boolean matrix
      const matrix: boolean[][] = [];
      for (let row = 0; row < size; row++) {
        const rowArr: boolean[] = [];
        for (let col = 0; col < size; col++) {
          rowArr.push(data[row * size + col] === 1);
        }
        matrix.push(rowArr);
      }
      setQrModules(matrix);

      // Render on canvas
      const canvas = canvasRef.current;
      if (!canvas) return;

      const quietZone = 2; // modules of white border
      const totalModules = size + quietZone * 2;
      const canvasSize = totalModules * tileSize;
      canvas.width = canvasSize;
      canvas.height = canvasSize;

      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      // Pick tile for each module
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const isDark = matrix[row][col];
          const x = (col + quietZone) * tileSize;
          const y = (row + quietZone) * tileSize;

          if (isDark) {
            const tile = pickTile(tiles, row, col, size, fillMode);
            ctx.drawImage(tile.bitmap, x, y, tileSize, tileSize);
          } else {
            // Light module
            if (lightStyle === 'white') {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(x, y, tileSize, tileSize);
            } else if (lightStyle === 'faded') {
              const tile = pickTile(tiles, row, col, size, fillMode);
              ctx.globalAlpha = 0.12;
              ctx.drawImage(tile.bitmap, x, y, tileSize, tileSize);
              ctx.globalAlpha = 1;
              ctx.fillStyle = 'rgba(255,255,255,0.82)';
              ctx.fillRect(x, y, tileSize, tileSize);
            } else if (lightStyle === 'invert') {
              const tile = pickTile(tiles, row, col, size, fillMode);
              ctx.globalAlpha = 0.25;
              ctx.drawImage(tile.bitmap, x, y, tileSize, tileSize);
              ctx.globalAlpha = 1;
              ctx.fillStyle = 'rgba(255,255,255,0.7)';
              ctx.fillRect(x, y, tileSize, tileSize);
            }
          }
        }
      }
    } catch (err) {
      console.error('QR generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }, [text, tiles, fillMode, lightStyle, tileSize, errorCorrection]);

  // Regenerate when settings change (if we already have a QR)
  useEffect(() => {
    if (qrModules && tiles.length > 0) {
      generateQR();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillMode, lightStyle, tileSize]);

  // --- Download ---

  function downloadPNG() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `qr-mosaic-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function downloadSVG() {
    // For SVG we re-render as embedded image tiles
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `qr-mosaic-${Date.now()}.svg`;
    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
      <image href="${canvas.toDataURL('image/png')}" width="${canvas.width}" height="${canvas.height}"/>
    </svg>`;
    link.href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
    link.click();
  }

  // --- UI ---

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">QR Mosaic</h1>
          <p className="text-muted text-sm mt-1">
            Generate QR codes filled with fragments from your image library
          </p>
        </header>

        <div className="grid lg:grid-cols-[1fr,auto] gap-8">

          {/* Left: Controls */}
          <div className="space-y-6">

            {/* URL / Text input */}
            <section className="bg-surface border border-border rounded-xl p-5">
              <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-2">
                Encode
              </label>
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Enter URL or text to encode..."
                className="w-full px-4 py-3 bg-surface-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent placeholder:text-muted/50"
              />
            </section>

            {/* Image Library */}
            <section className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-muted uppercase tracking-wider">
                  Image Library
                </label>
                <span className="text-xs text-muted">{tiles.length} images</span>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragOver ? 'drop-active border-accent' : 'border-border hover:border-muted'
                }`}
              >
                <p className="text-sm text-muted">
                  Drop images here or click to browse
                </p>
                <p className="text-xs text-muted/60 mt-1">
                  JPG, PNG, WebP, GIF — any number of images
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files && processFiles(e.target.files)}
                />
              </div>

              {/* Tile grid */}
              {tiles.length > 0 && (
                <div className="mt-4">
                  <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1.5">
                    {tiles.map(tile => (
                      <div key={tile.id} className="relative group aspect-square">
                        <img
                          src={tile.thumb}
                          alt={tile.name}
                          className="w-full h-full object-cover rounded"
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); removeTile(tile.id); }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setTiles([])}
                    className="text-xs text-muted hover:text-red-400 mt-3 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </section>

            {/* Settings */}
            <section className="bg-surface border border-border rounded-xl p-5">
              <label className="text-xs font-medium text-muted uppercase tracking-wider block mb-4">
                Settings
              </label>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Fill mode */}
                <div>
                  <label className="text-xs text-muted block mb-1.5">Tile selection</label>
                  <select
                    value={fillMode}
                    onChange={e => setFillMode(e.target.value as FillMode)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
                  >
                    <option value="random">Random</option>
                    <option value="color-match">Color match (darker tiles for dark modules)</option>
                    <option value="sequential">Sequential (cycle through images)</option>
                  </select>
                </div>

                {/* Light module style */}
                <div>
                  <label className="text-xs text-muted block mb-1.5">Light modules</label>
                  <select
                    value={lightStyle}
                    onChange={e => setLightStyle(e.target.value as LightModuleStyle)}
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
                  >
                    <option value="white">Solid white</option>
                    <option value="faded">Faded image hint</option>
                    <option value="invert">Translucent overlay</option>
                  </select>
                </div>

                {/* Tile size */}
                <div>
                  <label className="text-xs text-muted block mb-1.5">
                    Tile size: {tileSize}px
                  </label>
                  <input
                    type="range"
                    min={8}
                    max={48}
                    step={2}
                    value={tileSize}
                    onChange={e => setTileSize(Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                  <div className="flex justify-between text-[10px] text-muted/60">
                    <span>8px (small)</span>
                    <span>48px (large)</span>
                  </div>
                </div>

                {/* Error correction */}
                <div>
                  <label className="text-xs text-muted block mb-1.5">Error correction</label>
                  <select
                    value={errorCorrection}
                    onChange={e => setErrorCorrection(e.target.value as 'L' | 'M' | 'Q' | 'H')}
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
                  >
                    <option value="L">Low (7%)</option>
                    <option value="M">Medium (15%)</option>
                    <option value="Q">Quartile (25%)</option>
                    <option value="H">High (30%) — recommended</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Generate button */}
            <button
              onClick={generateQR}
              disabled={!text.trim() || tiles.length === 0 || generating}
              className="w-full py-3 bg-accent-dim hover:bg-accent text-white font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              {generating ? 'Generating...' : qrModules ? 'Regenerate Mosaic' : 'Generate QR Mosaic'}
            </button>

            {!text.trim() && tiles.length === 0 && (
              <p className="text-xs text-muted text-center">Enter text and upload images to get started</p>
            )}
            {text.trim() && tiles.length === 0 && (
              <p className="text-xs text-muted text-center">Upload at least one image</p>
            )}
          </div>

          {/* Right: Canvas preview + download */}
          <div className="lg:w-[520px]">
            <div className="bg-surface border border-border rounded-xl p-5 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs font-medium text-muted uppercase tracking-wider">
                  Preview
                </label>
                {qrModules && (
                  <div className="flex gap-2">
                    <button
                      onClick={downloadPNG}
                      className="text-xs px-3 py-1.5 bg-accent-dim hover:bg-accent text-white rounded-lg transition-colors"
                    >
                      PNG
                    </button>
                    <button
                      onClick={downloadSVG}
                      className="text-xs px-3 py-1.5 border border-border text-muted hover:text-foreground hover:border-accent rounded-lg transition-colors"
                    >
                      SVG
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center bg-white rounded-lg min-h-[400px] overflow-hidden">
                {qrModules ? (
                  <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-[480px] object-contain"
                  />
                ) : (
                  <div className="text-center p-8">
                    <div className="text-6xl mb-3 opacity-20">
                      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto text-black/30">
                        <rect x="3" y="3" width="7" height="7" />
                        <rect x="14" y="3" width="7" height="7" />
                        <rect x="3" y="14" width="7" height="7" />
                        <rect x="14" y="14" width="3" height="3" />
                        <rect x="18" y="14" width="3" height="3" />
                        <rect x="14" y="18" width="3" height="3" />
                        <rect x="18" y="18" width="3" height="3" />
                      </svg>
                    </div>
                    <p className="text-sm text-black/30">Your mosaic QR will appear here</p>
                  </div>
                )}
              </div>

              {/* Hidden canvas for off-screen rendering */}
              {!qrModules && <canvas ref={canvasRef} className="hidden" />}

              {qrModules && (
                <div className="mt-3 text-xs text-muted text-center">
                  {qrModules.length}x{qrModules.length} modules &middot; {tiles.length} tile{tiles.length !== 1 ? 's' : ''} &middot; {tileSize}px each
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ----- Tile picker -----

function pickTile(
  tiles: ImageTile[],
  row: number,
  col: number,
  gridSize: number,
  mode: FillMode
): ImageTile {
  switch (mode) {
    case 'sequential':
      return tiles[(row * gridSize + col) % tiles.length];

    case 'color-match': {
      // For dark modules, prefer darker tiles
      // Sort by luminance ascending, pick from darker half with some randomness
      const sorted = [...tiles].sort(
        (a, b) => luminance(a.avgColor) - luminance(b.avgColor)
      );
      const darkerHalf = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.6)));
      return darkerHalf[Math.floor(seededRandom(row, col) * darkerHalf.length)];
    }

    case 'random':
    default:
      return tiles[Math.floor(seededRandom(row, col) * tiles.length)];
  }
}

// Deterministic random so same input gives same mosaic
function seededRandom(row: number, col: number): number {
  let seed = row * 9973 + col * 7919 + 104729;
  seed = ((seed * 16807) % 2147483647);
  return (seed & 0x7fffffff) / 0x7fffffff;
}
