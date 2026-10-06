import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Aperture, ArrowLeftRight, Brush, Check, ChevronDown, Contrast, Crop,
  Download, Eraser, Eye, EyeOff, FileImage, FlipHorizontal, FlipVertical,
  FolderOpen, History, ImagePlus, Layers3, Maximize2, Minus, MousePointer2,
  Palette, Redo2, RotateCw, Save, Scissors, Search, SunMedium,
  Trash2, Undo2, Upload, ZoomIn, ZoomOut
} from "lucide-react";

const DEFAULT = { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: 0, sepia: 0 };
const PRESETS = {
  Original: DEFAULT,
  Cinematic: { brightness: 95, contrast: 125, saturation: 85, blur: 0, grayscale: 5, sepia: 8 },
  Vivid: { brightness: 105, contrast: 115, saturation: 145, blur: 0, grayscale: 0, sepia: 0 },
  Mono: { brightness: 105, contrast: 120, saturation: 100, blur: 0, grayscale: 100, sepia: 0 },
  Warm: { brightness: 108, contrast: 105, saturation: 115, blur: 0, grayscale: 0, sepia: 28 },
  Noir: { brightness: 92, contrast: 140, saturation: 70, blur: 0, grayscale: 75, sepia: 0 },
  Cool: { brightness: 102, contrast: 110, saturation: 105, blur: 0, grayscale: 0, sepia: 0 }
};

function App() {
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const dragRef = useRef(false);
  const [image, setImage] = useState(null);
  const [adjustments, setAdjustments] = useState(DEFAULT);
  const [history, setHistory] = useState([{ label: "Original", adjustments: DEFAULT }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(1);
  const [flipY, setFlipY] = useState(1);
  const [activeTool, setActiveTool] = useState("adjust");
  const [beforeMode, setBeforeMode] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [brushSize, setBrushSize] = useState(8);
  const [brushColor, setBrushColor] = useState("#ff3d73");
  const [strokes, setStrokes] = useState([]);
  const [currentStroke, setCurrentStroke] = useState(null);
  const [layers, setLayers] = useState({ image: true, adjustments: true, drawing: true });
  const [cropRatio, setCropRatio] = useState("free");
  const [selected, setSelected] = useState(false);

  const filterString = (a) => `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturation}%) blur(${a.blur}px) grayscale(${a.grayscale}%) sepia(${a.sepia}%)`;

  const loadFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage({ url, name: file.name, width: img.naturalWidth, height: img.naturalHeight });
      setAdjustments(DEFAULT);
      setHistory([{ label: "Original", adjustments: DEFAULT }]);
      setHistoryIndex(0);
      setRotation(0); setFlipX(1); setFlipY(1); setZoom(1);
      setStrokes([]); setBeforeMode(false); setSelected(false);
      setLayers({ image: true, adjustments: true, drawing: true });
      setActiveTool("adjust");
    };
    img.src = url;
  };

  const pushHistory = (label, next) => {
    const safe = { ...next };
    const trimmed = history.slice(0, historyIndex + 1);
    const nextHistory = [...trimmed, { label, adjustments: safe }];
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setAdjustments(safe);
  };

  const updateAdjustment = (key, value) => pushHistory(key.charAt(0).toUpperCase() + key.slice(1), { ...adjustments, [key]: Number(value) });

  const undo = () => {
    if (historyIndex <= 0) return;
    const next = historyIndex - 1;
    setHistoryIndex(next); setAdjustments(history[next].adjustments);
  };
  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const next = historyIndex + 1;
    setHistoryIndex(next); setAdjustments(history[next].adjustments);
  };

  const drawToCanvas = (asBefore = false) => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      const rotated = rotation % 180 !== 0;
      canvas.width = rotated ? img.naturalHeight : img.naturalWidth;
      canvas.height = rotated ? img.naturalWidth : img.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipX, flipY);
      if (layers.image) {
        ctx.filter = asBefore || !layers.adjustments ? "none" : filterString(adjustments);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      }
      ctx.restore();
      if (!asBefore && layers.drawing && strokes.length) drawStrokes(ctx, strokes, canvas.width, canvas.height, img.naturalWidth, img.naturalHeight);
    };
    img.src = image.url;
  };

  const drawStrokes = (ctx, list, canvasW, canvasH, sourceW, sourceH) => {
    const sx = canvasW / sourceW, sy = canvasH / sourceH;
    list.forEach(stroke => {
      if (!stroke.points.length) return;
      ctx.save(); ctx.strokeStyle = stroke.color; ctx.lineWidth = stroke.size * ((sx + sy) / 2); ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      stroke.points.forEach((p, i) => i ? ctx.lineTo(p.x * sx, p.y * sy) : ctx.moveTo(p.x * sx, p.y * sy));
      ctx.stroke(); ctx.restore();
    });
  };

  useEffect(() => { drawToCanvas(beforeMode); }, [image, adjustments, rotation, flipX, flipY, beforeMode, strokes, layers]);

  const exportImage = (type = "image/png") => {
    if (!image || !canvasRef.current) return;
    drawToCanvas(false);
    setTimeout(() => {
      const link = document.createElement("a");
      link.download = `pixelforge-${Date.now()}.${type === "image/jpeg" ? "jpg" : "png"}`;
      link.href = canvasRef.current.toDataURL(type, .94); link.click();
    }, 100);
  };

  const reset = () => {
    setAdjustments(DEFAULT); setHistory([{ label: "Original", adjustments: DEFAULT }]); setHistoryIndex(0);
    setRotation(0); setFlipX(1); setFlipY(1); setStrokes([]); setBeforeMode(false); setZoom(1);
  };

  const cropImage = () => {
    if (!image) return;
    const img = new Image(); img.onload = () => {
      let targetW = img.naturalWidth, targetH = img.naturalHeight;
      if (cropRatio !== "free") {
        const [rw, rh] = cropRatio.split(":").map(Number);
        if (targetW / targetH > rw / rh) targetW = Math.round(targetH * rw / rh);
        else targetH = Math.round(targetW * rh / rw);
      } else {
        targetW = Math.round(img.naturalWidth * .8); targetH = Math.round(img.naturalHeight * .8);
      }
      const sx = Math.round((img.naturalWidth - targetW) / 2), sy = Math.round((img.naturalHeight - targetH) / 2);
      const c = document.createElement("canvas"); c.width = targetW; c.height = targetH;
      c.getContext("2d").drawImage(img, sx, sy, targetW, targetH, 0, 0, targetW, targetH);
      c.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        setImage({ url, name: image.name.replace(/\.[^.]+$/, "") + "-cropped.png", width: targetW, height: targetH });
        setStrokes([]); setAdjustments(DEFAULT); setHistory([{ label: "Cropped", adjustments: DEFAULT }]); setHistoryIndex(0); setActiveTool("adjust");
      }, "image/png");
    }; img.src = image.url;
  };

  const startDraw = (e) => {
    if (activeTool !== "draw" || !image) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width, scaleY = canvasRef.current.height / rect.height;
    const point = { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    setCurrentStroke({ color: brushColor, size: brushSize, points: [point] });
    dragRef.current = true;
    canvasRef.current.setPointerCapture?.(e.pointerId);
  };
  const moveDraw = (e) => {
    if (!dragRef.current || !currentStroke) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width, scaleY = canvasRef.current.height / rect.height;
    const point = { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    setCurrentStroke(s => s ? { ...s, points: [...s.points, point] } : s);
  };
  const endDraw = () => {
    if (!dragRef.current) return;
    dragRef.current = false;
    if (currentStroke?.points.length) setStrokes(s => [...s, currentStroke]);
    setCurrentStroke(null);
  };

  useEffect(() => {
    if (currentStroke && canvasRef.current && image) {
      drawToCanvas(false);
      const ctx = canvasRef.current.getContext("2d");
      const all = [...strokes, currentStroke];
      const img = new Image(); img.onload = () => drawStrokes(ctx, all, canvasRef.current.width, canvasRef.current.height, img.naturalWidth, img.naturalHeight); img.src = image.url;
    }
  }, [currentStroke]);

  const tools = [
    { id: "adjust", icon: SunMedium, label: "Adjust" },
    { id: "filters", icon: Palette, label: "Filters" },
    { id: "crop", icon: Crop, label: "Crop" },
    { id: "draw", icon: Brush, label: "Draw" },
    { id: "layers", icon: Layers3, label: "Layers" }
  ];

  const slider = (key, label, min, max, step = 1) => (
    <div className="control" key={key}><div className="control-head"><span>{label}</span><span className="value">{adjustments[key]}{["blur","grayscale","sepia"].includes(key) ? "" : "%"}</span></div><input type="range" min={min} max={max} step={step} value={adjustments[key]} onChange={e => updateAdjustment(key, e.target.value)} /></div>
  );

  const visibleCanvas = useMemo(() => ({ cursor: activeTool === "draw" ? "crosshair" : activeTool === "select" ? "crosshair" : "default" }), [activeTool]);

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Aperture size={21}/></div><div><div className="brand-name">PixelForge <span>AI</span></div><div className="brand-sub">PHOTO STUDIO</div></div></div>
      <div className="top-actions"><button className="top-btn" onClick={undo} disabled={historyIndex===0}><Undo2 size={17}/></button><button className="top-btn" onClick={redo} disabled={historyIndex===history.length-1}><Redo2 size={17}/></button><div className="divider"/><button className="top-btn secondary" onClick={()=>fileRef.current?.click()}><FolderOpen size={17}/> Open</button><button className="save-btn" onClick={()=>exportImage()}><Download size={17}/> Export</button></div>
      <input ref={fileRef} hidden type="file" accept="image/*" onChange={e=>loadFile(e.target.files?.[0])}/>
    </header>
    <main className="workspace">
      <aside className="leftbar"><div className="tool-list">{tools.map(tool=>{const Icon=tool.icon;return <button key={tool.id} className={`tool-btn ${activeTool===tool.id?"active":""}`} onClick={()=>setActiveTool(tool.id)} title={tool.label}><span className="tool-icon"><Icon size={20}/></span><span>{tool.label}</span>{tool.badge&&<small>{tool.badge}</small>}</button>})}</div>
        <div className="left-bottom"><button className={`mini-tool ${activeTool==="history"?"active-mini":""}`} onClick={()=>setActiveTool("history")}><History size={18}/><span>History</span></button><button className={`mini-tool ${activeTool==="select"?"active-mini":""}`} onClick={()=>{setActiveTool("select");setSelected(false)}}><MousePointer2 size={18}/><span>Select</span></button></div>
      </aside>
      <section className="editor-area">
        <div className="editor-toolbar"><div className="doc-meta"><FileImage size={16}/><span>{image?image.name:"Untitled Project"}</span>{image&&<em>{image.width} × {image.height}</em>}</div><div className="canvas-tools"><button onClick={()=>setZoom(Math.max(.35,zoom-.1))}><ZoomOut size={16}/></button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(Math.min(2.5,zoom+.1))}><ZoomIn size={16}/></button><div className="small-divider"/><button onClick={()=>setBeforeMode(v=>!v)} className={beforeMode?"pressed":""}><ArrowLeftRight size={16}/> Before</button><button onClick={()=>setRotation((rotation+90)%360)}><RotateCw size={16}/></button><button onClick={()=>setFlipX(v=>-v)}><FlipHorizontal size={16}/></button><button onClick={()=>setFlipY(v=>-v)}><FlipVertical size={16}/></button><button onClick={reset}><Trash2 size={16}/></button></div></div>
        <div className={`canvas-stage ${dragging?"dragging":""}`} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);loadFile(e.dataTransfer.files?.[0])}} onClick={()=>!image&&fileRef.current?.click()}>
          {!image?<div className="upload-card"><div className="upload-icon"><ImagePlus size={30}/></div><h2>Drop your photo here</h2><p>or click to browse from your computer</p><button className="browse-btn" onClick={e=>{e.stopPropagation();fileRef.current?.click()}}><Upload size={17}/> Choose Image</button><div className="format-row">JPG · PNG · WEBP · GIF</div></div>:<div className="canvas-wrap" style={{transform:`scale(${zoom})`}}><canvas ref={canvasRef} style={visibleCanvas} onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={endDraw} onPointerCancel={endDraw} onPointerLeave={endDraw} onClick={e=>{if(activeTool==="select"){e.stopPropagation();setSelected(v=>!v)}}}/>{selected&&activeTool==="select"&&<div className="selection-box"><span>Selection</span></div>}</div>}
        </div><div className="bottom-status"><span><span className="status-dot"/> Ready</span><span>Canvas Engine</span><span>Local Processing</span></div>
      </section>
      <aside className="right-panel"><div className="panel-heading"><div><span className="eyebrow">EDITOR</span><h2>{activeTool==="filters"?"Filters":activeTool==="crop"?"Crop":activeTool==="draw"?"Draw":activeTool==="layers"?"Layers":activeTool==="history"?"History":activeTool==="select"?"Select":"Adjustments"}</h2></div><button className="icon-btn"><Maximize2 size={16}/></button></div>
        {activeTool==="adjust"&&<div className="panel-content"><div className="section-title"><Contrast size={16}/> LIGHT & COLOR</div>{slider("brightness","Brightness",0,200)}{slider("contrast","Contrast",0,200)}{slider("saturation","Saturation",0,200)}<div className="section-title space"><Palette size={16}/> EFFECTS</div>{slider("blur","Blur",0,12,.5)}{slider("grayscale","Grayscale",0,100)}{slider("sepia","Sepia",0,100)}<div className="quick-grid"><button onClick={()=>updateAdjustment("brightness",110)}><SunMedium size={15}/> Brighten</button><button onClick={()=>updateAdjustment("saturation",125)}><Palette size={15}/> Vibrant</button></div></div>}
        {activeTool==="filters"&&<div className="panel-content"><div className="section-title"><Palette size={16}/> PRESETS</div><div className="filter-grid">{Object.entries(PRESETS).map(([name,values])=><button key={name} className="filter-card" onClick={()=>pushHistory("Filter: "+name,values)}><div className={`filter-preview f-${name.toLowerCase()}`}>{image?<img src={image.url}/>:<Aperture/>}</div><span>{name}</span></button>)}</div></div>}
        {activeTool==="crop"&&<div className="panel-content crop-panel"><div className="section-title"><Scissors size={16}/> CROP RATIO</div><div className="ratio-grid">{["free","1:1","4:5","16:9","3:2"].map(r=><button key={r} className={cropRatio===r?"selected":""} onClick={()=>setCropRatio(r)}>{r}</button>)}</div><p className="helper">Free crop trims 20% from each dimension. Ratio crop centers the selected aspect ratio.</p><button className="primary-wide" onClick={cropImage} disabled={!image}><Scissors size={16}/> Apply Crop</button></div>}
        {activeTool==="draw"&&<div className="panel-content"><div className="section-title"><Brush size={16}/> BRUSH</div><div className="control"><div className="control-head"><span>Size</span><span className="value">{brushSize}px</span></div><input type="range" min="1" max="60" value={brushSize} onChange={e=>setBrushSize(Number(e.target.value))}/></div><label className="color-label">COLOR</label><div className="color-row"><input type="color" value={brushColor} onChange={e=>setBrushColor(e.target.value)}/><span>{brushColor}</span></div><button className="primary-wide" onClick={()=>setStrokes([])}><Trash2 size={16}/> Clear Drawing</button><p className="helper">Choose a brush and draw directly over the photo. Drawing is included in exports.</p></div>}
        {activeTool==="layers"&&<div className="panel-content"><div className="section-title"><Layers3 size={16}/> LAYER STACK</div>{[["image","Photo"],["adjustments","Adjustments"],["drawing","Drawing"]].map(([id,label])=><div className="layer-row" key={id}><div className="layer-thumb"><FileImage size={15}/></div><div className="layer-name"><b>{label}</b><small>{id==="image"?"Base image":id==="adjustments"?"Non-destructive look":"Brush strokes"}</small></div><button onClick={()=>setLayers(v=>({...v,[id]:!v[id]}))}>{layers[id]?<Eye size={16}/>:<EyeOff size={16}/>}</button></div>)}<p className="helper">Toggle visibility to preview each editing layer.</p></div>}
        {activeTool==="history"&&<div className="panel-content"><div className="section-title"><History size={16}/> EDIT HISTORY</div><div className="history-list">{history.map((item,i)=><button key={i} className={i===historyIndex?"current":""} onClick={()=>{setHistoryIndex(i);setAdjustments(item.adjustments)}}><span>{i+1}</span><b>{item.label}</b>{i===historyIndex&&<Check size={14}/>}</button>)}</div><p className="helper">Click any edit to restore it. Undo/Redo is also available in the top bar.</p></div>}
        {activeTool==="select"&&<div className="panel-content"><div className="section-title"><MousePointer2 size={16}/> SELECT TOOL</div><div className="select-card"><Search size={24}/><h3>{selected?"Selection active":"Click the image"}</h3><p>{selected?"A simple selection overlay is active. Advanced mask tools can be added in a future version.":"Click the photo to create a working selection state."}</p></div><button className="primary-wide" onClick={()=>setSelected(false)}><Trash2 size={16}/> Clear Selection</button></div>}
      </aside>
    </main>
  </div>;
}

export default App;
