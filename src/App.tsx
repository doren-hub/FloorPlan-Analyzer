import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Upload, 
  Ruler, 
  Square, 
  Trash2, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Info,
  Sparkles,
  MousePointer2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";

// --- Types ---

interface Point {
  x: number;
  y: number;
}

interface Measurement {
  id: string;
  type: "line" | "rect";
  points: Point[];
  label?: string;
  meters?: number;
  area?: number;
}

interface Calibration {
  pixels: number;
  meters: number;
}

// --- Constants ---

const AI_MODEL = "gemini-3-flash-preview";

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [mode, setMode] = useState<"select" | "calibrate" | "measure-line" | "measure-rect">("select");
  const [calibrationType, setCalibrationType] = useState<"line" | "area" | "tatami">("line");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const [zoom, setZoom] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showCalibrationDialog, setShowCalibrationDialog] = useState(false);
  const [calibrationValue, setCalibrationValue] = useState("1.0");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Image Handling ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImageSize({ width: img.width, height: img.height });
          setImage(event.target?.result as string);
          setMeasurements([]);
          setCalibration(null);
          
          // Calculate initial zoom to fit container
          if (containerRef.current) {
            const padding = 64;
            const containerWidth = containerRef.current.clientWidth - padding;
            const containerHeight = containerRef.current.clientHeight - padding;
            const scaleX = containerWidth / img.width;
            const scaleY = containerHeight / img.height;
            const initialZoom = Math.min(scaleX, scaleY, 1);
            setZoom(initialZoom);
          } else {
            setZoom(1);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const fitToScreen = () => {
    if (!imageSize || !containerRef.current) return;
    const padding = 64;
    const containerWidth = containerRef.current.clientWidth - padding;
    const containerHeight = containerRef.current.clientHeight - padding;
    const scaleX = containerWidth / imageSize.width;
    const scaleY = containerHeight / imageSize.height;
    setZoom(Math.min(scaleX, scaleY, 1));
  };

  // --- Canvas Logic ---

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = image;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Draw measurements
      measurements.forEach((m) => {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 5 / zoom;
        ctx.fillStyle = "rgba(59, 130, 246, 0.2)";

        if (m.type === "line") {
          ctx.beginPath();
          ctx.moveTo(m.points[0].x, m.points[0].y);
          ctx.lineTo(m.points[1].x, m.points[1].y);
          ctx.stroke();
          
          // Draw endpoints
          m.points.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8 / zoom, 0, Math.PI * 2);
            ctx.fillStyle = "#3b82f6";
            ctx.fill();
          });

          // Label
          if (m.meters) {
            const midX = (m.points[0].x + m.points[1].x) / 2;
            const midY = (m.points[0].y + m.points[1].y) / 2;
            drawLabel(ctx, `${m.meters.toFixed(2)}m`, midX, midY);
          }
        } else if (m.type === "rect") {
          const [p1, p2] = m.points;
          const w = p2.x - p1.x;
          const h = p2.y - p1.y;
          ctx.strokeRect(p1.x, p1.y, w, h);
          ctx.fillRect(p1.x, p1.y, w, h);

          // Label
          if (m.meters && m.area) {
            const jo = m.area / 1.62;
            drawLabel(ctx, `${m.area.toFixed(2)}m² (${jo.toFixed(1)}畳)`, p1.x + w / 2, p1.y + h / 2);
          }
        }
      });

      // Draw current temp points
      if (tempPoints.length > 0) {
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 3 / zoom;
        if (mode === "measure-line" || (mode === "calibrate" && calibrationType === "line")) {
          if (tempPoints.length === 2) {
            ctx.beginPath();
            ctx.moveTo(tempPoints[0].x, tempPoints[0].y);
            ctx.lineTo(tempPoints[1].x, tempPoints[1].y);
            ctx.stroke();
          }
        } else if ((mode === "measure-rect" || (mode === "calibrate" && (calibrationType === "area" || calibrationType === "tatami"))) && tempPoints.length === 2) {
          const [p1, p2] = tempPoints;
          ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        }
        
        tempPoints.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6 / zoom, 0, Math.PI * 2);
          ctx.fillStyle = "#f59e0b";
          ctx.fill();
        });
      }
    };
  }, [image, measurements, tempPoints, mode, zoom, calibrationType]);

  const drawLabel = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number) => {
    ctx.font = `bold ${24 / zoom}px Inter, sans-serif`;
    const metrics = ctx.measureText(text);
    const padding = 10 / zoom;
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(
      x - metrics.width / 2 - padding,
      y - 15 / zoom - padding,
      metrics.width + padding * 2,
      30 / zoom + padding * 2
    );
    
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  };

  useEffect(() => {
    draw();
  }, [draw]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!canvasRef.current || mode === "select") return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (rect.width / canvasRef.current.width);
    const y = (e.clientY - rect.top) / (rect.height / canvasRef.current.height);

    if (tempPoints.length === 0) {
      setTempPoints([{ x, y }]);
    } else {
      const p2 = { x, y };
      const p1 = tempPoints[0];
      
      if (mode === "calibrate") {
        setTempPoints([p1, p2]);
        setShowCalibrationDialog(true);
      } else if (mode === "measure-line") {
        if (!calibration) {
          alert("Please calibrate first!");
          setTempPoints([]);
          return;
        }
        const distPx = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const meters = (distPx / calibration.pixels) * calibration.meters;
        
        setMeasurements([...measurements, {
          id: Math.random().toString(36).substr(2, 9),
          type: "line",
          points: [p1, p2],
          meters
        }]);
        setTempPoints([]);
      } else if (mode === "measure-rect") {
        if (!calibration) {
          alert("Please calibrate first!");
          setTempPoints([]);
          return;
        }
        const wPx = Math.abs(p2.x - p1.x);
        const hPx = Math.abs(p2.y - p1.y);
        const wM = (wPx / calibration.pixels) * calibration.meters;
        const hM = (hPx / calibration.pixels) * calibration.meters;
        
        setMeasurements([...measurements, {
          id: Math.random().toString(36).substr(2, 9),
          type: "rect",
          points: [p1, p2],
          meters: Math.sqrt(wM*wM + hM*hM), // Diagonal just in case
          area: wM * hM
        }]);
        setTempPoints([]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (tempPoints.length === 1 && mode !== "select") {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / (rect.width / canvasRef.current!.width);
      const y = (e.clientY - rect.top) / (rect.height / canvasRef.current!.height);
      setTempPoints([tempPoints[0], { x, y }]);
    }
  };

  const confirmCalibration = () => {
    const p1 = tempPoints[0];
    const p2 = tempPoints[1];
    const val = parseFloat(calibrationValue);
    
    if (!isNaN(val) && val > 0) {
      if (calibrationType === "line") {
        const distPx = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        setCalibration({ pixels: distPx, meters: val });
      } else {
        const wPx = Math.abs(p2.x - p1.x);
        const hPx = Math.abs(p2.y - p1.y);
        const areaPx = wPx * hPx;
        
        // Convert tatami to m2 if needed
        const areaM2 = calibrationType === "tatami" ? val * 1.62 : val;
        
        // Scale: pixels per meter = sqrt(areaPx / areaM2)
        setCalibration({ pixels: Math.sqrt(areaPx), meters: Math.sqrt(areaM2) });
      }
      setShowCalibrationDialog(false);
      setTempPoints([]);
      setMode("select");
    }
  };

  // --- AI Analysis ---

  const analyzeWithAI = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const base64 = image.split(",")[1];
      
      const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: [
          {
            parts: [
              { text: "This is a floor plan. Please identify all room names, their sizes in '畳' (Jo) or '帖', and any visible dimensions mentioned in the text. List them clearly in Japanese." },
              { inlineData: { mimeType: "image/jpeg", data: base64 } }
            ]
          }
        ]
      });

      const text = response.text;
      if (text) {
        setAiSuggestions(text.split("\n").filter(line => line.trim().length > 0));
      }
    } catch (error) {
      console.error("AI Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Render Helpers ---

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Maximize size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">FloorPlan Analyzer</h1>
              <p className="text-[10px] text-black/40 uppercase tracking-widest font-semibold">Pixel-Level Precision</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!image ? (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all shadow-md hover:shadow-lg active:scale-95"
              >
                <Upload size={16} />
                Upload Plan
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setImage(null)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors text-black/60"
                  title="Clear Image"
                >
                  <Trash2 size={20} />
                </button>
                <button 
                  onClick={analyzeWithAI}
                  disabled={isAnalyzing}
                  className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2 rounded-full text-sm font-medium hover:bg-amber-100 transition-all disabled:opacity-50"
                >
                  <Sparkles size={16} className={isAnalyzing ? "animate-pulse" : ""} />
                  {isAnalyzing ? "Analyzing..." : "AI Assist"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Controls */}
        <aside className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-black/40 uppercase tracking-widest">Tools</h3>
              <div className="grid grid-cols-2 gap-2">
                <ToolButton 
                  active={mode === "select"} 
                  onClick={() => setMode("select")}
                  icon={<MousePointer2 size={18} />}
                  label="Select"
                />
                <div className="relative group/cal">
                  <ToolButton 
                    active={mode === "calibrate"} 
                    onClick={() => setMode("calibrate")}
                    icon={<Ruler size={18} />}
                    label="Calibrate"
                    subLabel={calibration ? "Ready" : "Required"}
                    status={calibration ? "success" : "warning"}
                  />
                  <div className="absolute left-0 right-0 top-full hidden group-hover/cal:block z-20 pt-1">
                    <div className="bg-white rounded-xl shadow-xl border border-black/5 p-1">
                      <button 
                        onClick={() => { setCalibrationType("line"); setMode("calibrate"); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase ${calibrationType === "line" ? "bg-blue-50 text-blue-600" : "hover:bg-black/5"}`}
                      >
                        By Length (m)
                      </button>
                      <button 
                        onClick={() => { setCalibrationType("area"); setMode("calibrate"); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase ${calibrationType === "area" ? "bg-blue-50 text-blue-600" : "hover:bg-black/5"}`}
                      >
                        By Area (m²)
                      </button>
                      <button 
                        onClick={() => { setCalibrationType("tatami"); setMode("calibrate"); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase ${calibrationType === "tatami" ? "bg-blue-50 text-blue-600" : "hover:bg-black/5"}`}
                      >
                        By Tatami (畳)
                      </button>
                    </div>
                  </div>
                </div>
                <ToolButton 
                  active={mode === "measure-line"} 
                  onClick={() => setMode("measure-line")}
                  icon={<Ruler size={18} />}
                  label="Line"
                  disabled={!calibration}
                />
                <ToolButton 
                  active={mode === "measure-rect"} 
                  onClick={() => setMode("measure-rect")}
                  icon={<Square size={18} />}
                  label="Area"
                  disabled={!calibration}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-black/40 uppercase tracking-widest">View</h3>
              <div className="flex items-center justify-between bg-black/5 rounded-2xl p-2">
                <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm"><ZoomOut size={18} /></button>
                <span className="text-sm font-mono font-bold">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(5, z + 0.1))} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm"><ZoomIn size={18} /></button>
              </div>
            </div>

            {/* Calibration Guide */}
            {!calibration && image && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
                <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-blue-900">Calibration Required</p>
                  <p className="text-[10px] text-blue-800/70 leading-relaxed">
                    Draw a line over a known dimension (e.g., a 1.8m wall) to set the scale. 
                    1畳 is calculated as 1.62m².
                  </p>
                </div>
              </div>
            )}

            {measurements.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-black/5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-black/40 uppercase tracking-widest">Measurements</h3>
                  <button onClick={() => setMeasurements([])} className="text-[10px] text-red-500 font-bold hover:underline">CLEAR ALL</button>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {measurements.map((m) => (
                    <div key={m.id} className="bg-black/5 rounded-2xl p-3 flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                          {m.type === "line" ? <Ruler size={14} className="text-blue-500" /> : <Square size={14} className="text-green-500" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold">
                            {m.type === "line" 
                              ? `${m.meters?.toFixed(2)}m` 
                              : `${m.area?.toFixed(2)}m² (${(m.area! / 1.62).toFixed(1)}畳)`}
                          </p>
                          <p className="text-[10px] text-black/40 font-medium uppercase">{m.type}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setMeasurements(measurements.filter(x => x.id !== m.id))}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 text-red-500 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Suggestions Panel */}
          <AnimatePresence>
            {aiSuggestions.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-amber-50 rounded-3xl p-6 border border-amber-200 space-y-4"
              >
                <div className="flex items-center gap-2 text-amber-800">
                  <Sparkles size={16} />
                  <h3 className="text-xs font-bold uppercase tracking-widest">AI Insights</h3>
                </div>
                <div className="space-y-2">
                  {aiSuggestions.map((s, i) => (
                    <p key={i} className="text-xs text-amber-900/70 leading-relaxed font-medium">• {s}</p>
                  ))}
                </div>
                <button 
                  onClick={() => setAiSuggestions([])}
                  className="text-[10px] text-amber-800 font-bold hover:underline"
                >
                  DISMISS
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        {/* Main Canvas Area */}
        <div className="lg:col-span-3">
          <div 
            ref={containerRef}
            className="bg-white rounded-[32px] border border-black/5 shadow-sm overflow-hidden relative min-h-[600px] flex items-center justify-center group"
            style={{ cursor: mode === "select" ? "default" : "crosshair" }}
          >
            {!image ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-6 p-12 text-center cursor-pointer hover:bg-black/[0.02] transition-colors w-full h-full justify-center"
              >
                <div className="w-20 h-20 bg-black/5 rounded-3xl flex items-center justify-center text-black/20 group-hover:scale-110 transition-transform">
                  <Upload size={40} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight">Upload Floor Plan</h2>
                  <p className="text-black/40 max-w-xs mx-auto text-sm leading-relaxed">
                    Drag and drop your JPEG or PNG floor plan here to start measuring.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-black/20 uppercase tracking-widest">
                  <span>JPEG</span>
                  <span>•</span>
                  <span>PNG</span>
                  <span>•</span>
                  <span>PDF</span>
                </div>
              </div>
            ) : (
              <div 
                className="relative overflow-auto w-full h-full flex items-center justify-center p-8 custom-scrollbar"
                onMouseMove={handleMouseMove}
              >
                <div 
                  style={{ 
                    transform: `scale(${zoom})`, 
                    transformOrigin: "center",
                    transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                  }}
                >
                  <canvas 
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className="shadow-2xl rounded-sm"
                  />
                </div>
              </div>
            )}

            {/* Floating Info */}
            {image && (
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between pointer-events-none">
                <div className="bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 pointer-events-auto shadow-xl">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${calibration ? "bg-green-500" : "bg-amber-500 animate-pulse"}`} />
                    {calibration ? `Scale: 1m = ${Math.round(calibration.pixels / calibration.meters)}px` : "Calibration Required"}
                  </div>
                  <div className="w-px h-3 bg-white/20" />
                  <div>{imageSize?.width} x {imageSize?.height} px</div>
                </div>

                <div className="flex gap-2 pointer-events-auto">
                  <button 
                    onClick={fitToScreen}
                    className="bg-white/90 backdrop-blur-md p-3 rounded-full shadow-xl hover:bg-white transition-all active:scale-90 flex items-center gap-2 text-[10px] font-bold uppercase px-4"
                    title="Fit to Screen"
                  >
                    <Maximize size={18} />
                    Fit
                  </button>
                  <button 
                    onClick={() => setZoom(1)}
                    className="bg-white/90 backdrop-blur-md p-3 rounded-full shadow-xl hover:bg-white transition-all active:scale-90"
                    title="100% Zoom"
                  >
                    <ZoomIn size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload} 
      />

      {/* Calibration Dialog */}
      <AnimatePresence>
        {showCalibrationDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCalibrationDialog(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] p-10 shadow-2xl relative z-10 max-w-md w-full space-y-8"
            >
              <div className="space-y-2 text-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  {calibrationType === "line" ? <Ruler size={32} /> : <Square size={32} />}
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Set Scale</h2>
                <p className="text-black/40 text-sm">
                  {calibrationType === "line" 
                    ? "Enter the real-world length of the line." 
                    : calibrationType === "area"
                    ? "Enter the real-world area of the rectangle."
                    : "Enter the number of tatami mats (畳) for this area."}
                </p>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <input 
                    type="number" 
                    value={calibrationValue}
                    onChange={(e) => setCalibrationValue(e.target.value)}
                    className="w-full bg-black/5 border-none rounded-2xl px-6 py-4 text-2xl font-bold focus:ring-2 focus:ring-blue-500 transition-all text-center"
                    autoFocus
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-black/20 font-bold text-xl">
                    {calibrationType === "line" ? "m" : calibrationType === "area" ? "m²" : "畳"}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowCalibrationDialog(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-black/40 hover:bg-black/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmCalibration}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
                  >
                    Save Scale
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}

// --- Subcomponents ---

function ToolButton({ 
  active, 
  onClick, 
  icon, 
  label, 
  subLabel, 
  status, 
  disabled 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  subLabel?: string;
  status?: "success" | "warning";
  disabled?: boolean;
}) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`
        relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all border-2
        ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
        ${active 
          ? "bg-blue-50 border-blue-600 text-blue-600 shadow-sm" 
          : "bg-white border-transparent hover:bg-black/5 text-black/60"}
      `}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {subLabel && (
        <div className="absolute -top-1 -right-1 flex items-center gap-1 bg-white border border-black/5 px-2 py-0.5 rounded-full shadow-sm">
          <div className={`w-1.5 h-1.5 rounded-full ${status === "success" ? "bg-green-500" : "bg-amber-500"}`} />
          <span className="text-[8px] font-bold text-black/40">{subLabel}</span>
        </div>
      )}
    </button>
  );
}
