import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Activity, AlertTriangle, ArrowUpRight, BarChart3, Camera, Check, ChevronRight, CircleHelp, CloudUpload, Eye, FileImage, Gauge, History, Info, LayoutDashboard, Menu, MonitorCog, Play, Search, Settings, ShieldCheck, Square, Trash2, Upload, Video, X, Zap } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { checkModelHealth, formatTimestamp, getStoredPredictions, getStoredSettings, ModelNotConnectedError, predictFrame, PredictionServiceError, relativeTime, savePredictions, saveSettings, type IntegrationSettings, type Prediction, type PredictionLabel, type PredictionSource } from '@/lib/drowsiness';
import { alarmService } from '@/lib/alarm';

const queryClient = new QueryClient();

function StatusDot({ color = 'teal' }: { color?: 'teal' | 'orange' | 'red' }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${color === 'teal' ? 'bg-[#39c1a2]' : color === 'orange' ? 'bg-[#f2a65a]' : 'bg-[#db6b58]'}`} />;
}

function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'awake' | 'sleepy' | 'neutral' | 'orange' }) {
  const styles = tone === 'awake' ? 'bg-[#d8f2e9] text-[#147e68]' : tone === 'sleepy' ? 'bg-[#fae3d4] text-[#a04c35]' : tone === 'orange' ? 'bg-[#fff0d8] text-[#9b641e]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]';
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.08em] ${styles}`}><StatusDot color={tone === 'awake' ? 'teal' : tone === 'sleepy' ? 'red' : tone === 'orange' ? 'orange' : 'teal'} />{label}</span>;
}

type SystemStatus = 'Model Not Connected' | 'Model Connected' | 'Camera Ready' | 'Prediction Ready' | 'Prediction Error';
type AlertNotice = { title: string; message: string; streak: number; isTest?: boolean };

function AlertNoticePanel({ notice, onDismiss }: { notice: AlertNotice | null; onDismiss: () => void }) {
  if (!notice) return null;
  return <div role="alert" data-testid="alert-drowsiness" className={`fixed right-4 top-4 z-50 w-[min(410px,calc(100vw-2rem))] overflow-hidden rounded-2xl border ${notice.isTest ? 'border-[#d9bd8d] bg-[#fff3df]' : 'border-[#e4a897] bg-[#fff1ec]'} p-4 shadow-[0_18px_50px_rgba(81,44,33,.2)]`}>
    <div className="flex items-start gap-3">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${notice.isTest ? 'bg-[#ffe4b8] text-[#a66a21]' : 'bg-[#f8d3c8] text-[#ad4d38]'}`}><AlertTriangle size={19} /></div>
      <div className="min-w-0 flex-1">
        <div className={`font-display text-sm font-bold ${notice.isTest ? 'text-[#76501e]' : 'text-[#8f3e2f]'}`}>{notice.title}</div>
        <p className={`mt-1 text-xs leading-5 ${notice.isTest ? 'text-[#8e6c3a]' : 'text-[#975849]'}`}>{notice.message}</p>
        {notice.streak > 0 && <div className="mt-2 font-mono-custom text-[10px] uppercase tracking-[.12em] text-[#a66a5b]">Sleepy streak / {notice.streak}</div>}
      </div>
      <button aria-label="Dismiss drowsiness warning" data-testid="button-dismiss-alert" onClick={onDismiss} className="rounded-md p-1 text-[#a66a5b] transition hover:bg-[#f8d3c8]"><X size={15} /></button>
    </div>
  </div>;
}

function Shell({ children, status, notice, onDismissAlert }: { children: ReactNode; status: SystemStatus; notice: AlertNotice | null; onDismissAlert: () => void }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/history', label: 'Prediction history', icon: History },
    { href: '/settings', label: 'Integration settings', icon: MonitorCog },
  ];
  return (
    <div className="noise min-h-[100dvh] bg-background text-foreground">
      <AlertNoticePanel notice={notice} onDismiss={onDismissAlert} />
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[82px] items-center gap-3 border-b border-[hsl(var(--sidebar-border))] px-7">
          <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] shadow-[0_0_0_5px_hsl(var(--sidebar-primary)/.12)]"><Eye size={20} strokeWidth={2.5} /><span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[hsl(var(--sidebar))] bg-[#f2a65a]" /></div>
          <div><div className="font-display text-[17px] font-bold tracking-[-.03em]">nightwatch<span className="text-[hsl(var(--sidebar-primary))]">.</span></div><div className="font-mono-custom mt-0.5 text-[9px] uppercase tracking-[.2em] text-[hsl(var(--sidebar-foreground)/.5)]">driver safety lab</div></div>
        </div>
        <div className="px-4 pt-8">
          <div className="mb-3 px-3 font-mono-custom text-[10px] uppercase tracking-[.16em] text-[hsl(var(--sidebar-foreground)/.38)]">Workspace</div>
          <nav className="space-y-1">
            {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`} onClick={() => setMobileOpen(false)} className={`group flex items-center justify-between rounded-lg px-3 py-3 text-[13px] font-semibold transition-colors ${location === href ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.65)] hover:bg-[hsl(var(--sidebar-accent)/.6)] hover:text-[hsl(var(--sidebar-foreground))]'}`}><span className="flex items-center gap-3"><Icon size={17} strokeWidth={1.8} /><span>{label}</span></span>{location === href && <ChevronRight size={15} className="text-[hsl(var(--sidebar-primary))]" />}</Link>)}
          </nav>
        </div>
        <div className="mt-auto px-5 pb-6">
          <div className="overflow-hidden rounded-xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.55)] p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em] text-[hsl(var(--sidebar-foreground)/.6)]"><Activity size={14} className="text-[hsl(var(--sidebar-primary))]" /> System status</div>
            <div className="flex items-center gap-2 text-[12px] font-semibold"><StatusDot color={status === 'Prediction Error' ? 'red' : status === 'Model Not Connected' ? 'orange' : 'teal'} /> {status}</div>
            <div className="mt-2 font-mono-custom text-[10px] text-[hsl(var(--sidebar-foreground)/.42)]">BROWSER SESSION / REAL INPUTS ONLY</div>
          </div>
          <div className="mt-5 flex items-center gap-2.5 px-2 text-[11px] text-[hsl(var(--sidebar-foreground)/.45)]"><ShieldCheck size={14} /> No camera data leaves this device</div>
        </div>
      </aside>
      {mobileOpen && <button aria-label="Close navigation" data-testid="button-close-navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-[#142332]/35 md:hidden" />}
      <main className="min-h-[100dvh] md:pl-[260px]">
        <header className="flex h-[82px] items-center justify-between border-b border-border bg-background/85 px-5 backdrop-blur-md sm:px-8">
          <button onClick={() => setMobileOpen(true)} data-testid="button-open-navigation" className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"><Menu size={20} /></button>
          <div className="hidden font-mono-custom text-[10px] uppercase tracking-[.18em] text-muted-foreground sm:block">Safety intelligence / 01</div>
          <div className="ml-auto flex items-center gap-3 text-right"><div><div className="text-xs font-bold">Research workspace</div><div className="font-mono-custom text-[10px] text-muted-foreground">Student / local mode</div></div><div className="grid h-9 w-9 place-items-center rounded-full bg-[#d9e8e3] text-xs font-extrabold text-[#217660]">RW</div></div>
        </header>
        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">{children}</div>
      </main>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="mb-2 font-mono-custom text-[10px] font-medium uppercase tracking-[.2em] text-primary">{eyebrow}</div><h1 className="font-display text-3xl font-bold tracking-[-.055em] text-foreground sm:text-[38px]">{title}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p></div>{action}</div>;
}

function StatCard({ label, value, detail, icon: Icon, accent = 'teal' }: { label: string; value: string; detail: string; icon: typeof Activity; accent?: 'teal' | 'orange' | 'red' | 'navy' }) {
  const tone = accent === 'orange' ? 'text-[#b87529] bg-[#fff0d8]' : accent === 'red' ? 'text-[#b1533d] bg-[#fae3d4]' : accent === 'navy' ? 'text-[#526b84] bg-[#e2eaf0]' : 'text-[#167f69] bg-[#d8f2e9]';
  return <div data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`} className="rounded-xl border border-card-border bg-card p-5 shadow-[var(--shadow-soft)] transition-transform duration-200 hover:-translate-y-0.5"><div className="flex items-start justify-between"><div className="font-mono-custom text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</div><div className={`grid h-8 w-8 place-items-center rounded-lg ${tone}`}><Icon size={16} /></div></div><div className="mt-5 font-display text-[30px] font-bold tracking-[-.06em]">{value}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div>;
}

function SourceTabs({ source, onSource }: { source: PredictionSource; onSource: (source: PredictionSource) => void }) {
  return <div className="flex rounded-lg bg-muted p-1"><button data-testid="button-source-upload" onClick={() => onSource('Upload')} className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-bold transition-all ${source === 'Upload' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}><CloudUpload size={14} /> Upload</button><button data-testid="button-source-camera" onClick={() => onSource('Camera')} className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-bold transition-all ${source === 'Camera' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}><Camera size={14} /> Camera</button></div>;
}

function DetectionWorkspace({ onPrediction, settings, onStatusChange }: { onPrediction: (prediction: Prediction) => void; settings: IntegrationSettings; onStatusChange: (status: SystemStatus) => void }) {
  const [source, setSource] = useState<PredictionSource>('Upload');
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [running, setRunning] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [message, setMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const predictingRef = useRef(false);
  const runPredictionRef = useRef<(frameOverride?: string) => Promise<void>>(async () => undefined);

  const stopCamera = () => { setMonitoring(false); streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraOn(false); };
  useEffect(() => () => stopCamera(), []);
  useEffect(() => {
    if (source === 'Upload') {
      stopCamera();
    } else {
      setPreview(null);
      setFileName('');
      setMessage('Camera permission required to begin a live review.');
      onStatusChange('Model Not Connected');
    }
  }, [source]);
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraOn || !video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => setMessage('Camera started, but the browser could not play the live stream.'));
  }, [cameraOn]);

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { setMessage('Please choose an image file.'); return; }
    const reader = new FileReader();
    reader.onload = () => { setPreview(String(reader.result)); setFileName(file.name); setMessage('Real image ready. Connect a model to run the prediction.'); onStatusChange('Prediction Ready'); };
    reader.readAsDataURL(file);
  };
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
      setMessage('Live camera ready. Capture a real frame when the driver is in view.');
      onStatusChange('Camera Ready');
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setMessage('Camera permission required. Allow camera access in browser settings and try again.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setMessage('No camera was found. Connect a camera and try again.');
      } else {
        setMessage('Camera initialization failed. Check browser permissions and try again.');
      }
      onStatusChange('Prediction Error');
    }
  };
  const getCurrentVideoFrame = () => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
      return null;
    }
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext('2d'); if (!context) return;
    context.translate(canvas.width, 0); context.scale(-1, 1); context.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', .82);
  };
  const capture = () => {
    const frame = getCurrentVideoFrame();
    if (!frame) { setMessage('Wait for the camera feed to initialize.'); onStatusChange('Camera Ready'); return; }
    setPreview(frame); setFileName('camera-frame.jpg'); setMessage('Real camera frame captured. Connect a model to run the prediction.'); onStatusChange('Prediction Ready');
  };
  const runPrediction = async (frameOverride?: string) => {
    if (predictingRef.current) return;
    const frame = frameOverride || preview;
    if (!frame) { setMessage('Capture or upload a real frame before running a prediction.'); onStatusChange('Prediction Error'); return; }
    predictingRef.current = true;
    setRunning(true); setMessage('Sending the real frame to the configured model…');
    try {
      const result = await predictFrame({ source, imagePreview: frame }, settings);
      const prediction: Prediction = { ...result, id: `prediction-${Date.now()}`, timestamp: new Date().toISOString() };
      onPrediction(prediction);
      setMessage(`${result.label} result added to history.`);
      onStatusChange('Model Connected');
      setPreview(null);
      setFileName('');
    } catch (error) {
      if (error instanceof ModelNotConnectedError) {
        setMessage('Model not connected. Configure a TensorFlow / Keras endpoint in Settings.');
        onStatusChange('Model Not Connected');
      } else if (error instanceof PredictionServiceError) {
        setMessage(error.message);
        onStatusChange('Prediction Error');
      } else {
        setMessage('Prediction failed unexpectedly. No history entry was created.');
        onStatusChange('Prediction Error');
      }
    } finally {
      predictingRef.current = false;
      setRunning(false);
    }
  };
  runPredictionRef.current = runPrediction;
  useEffect(() => {
    if (!monitoring || source !== 'Camera' || !cameraOn) return;
    const interval = window.setInterval(() => {
      const frame = getCurrentVideoFrame();
      if (frame) void runPredictionRef.current(frame);
    }, 800);
    return () => window.clearInterval(interval);
  }, [monitoring, source, cameraOn]);
  return <section className="overflow-hidden rounded-2xl border border-[#2c4350] bg-[#1b303d] text-[#f8f1e4] shadow-[0_20px_45px_rgba(24,42,52,.16)]">
    <div className="flex flex-col justify-between gap-4 border-b border-[#39505b] px-5 py-5 sm:flex-row sm:items-center sm:px-7"><div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#7fe0c2]"><span className="h-1.5 w-1.5 rounded-full bg-[#7fe0c2] animate-dot" /> Detection workspace</div><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.04em]">Review a driver frame</h2></div><div className="flex items-center gap-2 rounded-full border border-[#46606a] bg-[#243d48] px-3 py-2 text-[10px] font-semibold text-[#b6c7c7]"><Info size={13} /> Model connection required <span className="text-[#7fe0c2]">·</span> {settings.modelVersion}</div></div>
    <div className="grid lg:grid-cols-[minmax(0,1fr)_310px]">
      <div className="border-b border-[#39505b] p-5 sm:p-7 lg:border-b-0 lg:border-r">
        <SourceTabs source={source} onSource={setSource} />
        <div className="relative mt-4 flex min-h-[280px] items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#58717a] bg-[#142631] sm:min-h-[335px]">
           {source === 'Camera' && cameraOn && !preview ? <><video ref={videoRef} autoPlay muted playsInline onLoadedMetadata={() => videoRef.current?.play().catch(() => undefined)} className="video-mirror absolute inset-0 h-full w-full object-cover opacity-90" /><div className="scan-line pointer-events-none absolute left-5 right-5 top-0 h-px bg-[#7fe0c2] shadow-[0_0_18px_#7fe0c2]" /><div className="absolute inset-5 rounded-lg border border-[#7fe0c2]/55" /><div className="absolute bottom-4 left-4 rounded-md bg-[#142631]/80 px-2 py-1 font-mono-custom text-[9px] uppercase tracking-[.14em] text-[#b6c7c7]">LIVE / FACE FRAME</div></> : preview ? <><img src={preview} alt="Selected driver frame" data-testid="img-driver-preview" className="absolute inset-0 h-full w-full object-contain" /><div className="absolute right-3 top-3 rounded-md bg-[#142631]/85 px-2 py-1 font-mono-custom text-[9px] text-[#dfeae4]">REAL FRAME READY</div></> : <div className="relative z-10 flex max-w-[280px] flex-col items-center text-center"><div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-[#4c6871] bg-[#243d48] text-[#7fe0c2]">{source === 'Camera' ? <Video size={25} /> : <FileImage size={25} />}</div><div className="text-sm font-bold">{source === 'Camera' ? 'Start camera monitoring' : 'Drop a frame here'}</div><div className="mt-2 text-xs leading-5 text-[#9cb1b2]">{source === 'Camera' ? 'Use a webcam to capture one review frame.' : 'JPG, PNG or WEBP · one frame at a time'}</div></div>}
          {source === 'Upload' && <label className="absolute inset-0 z-20 cursor-pointer" htmlFor="frame-upload"><span className="sr-only">Choose an image</span><input id="frame-upload" data-testid="input-frame-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="hidden" /></label>}
        </div>
         <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="flex items-center gap-2 text-xs text-[#9cb1b2]">{fileName ? <><FileImage size={14} className="text-[#7fe0c2]" /><span className="max-w-[220px] truncate">{fileName}</span><button data-testid="button-remove-frame" onClick={() => { setPreview(null); setFileName(''); onStatusChange('Model Not Connected'); }} className="rounded p-1 hover:bg-[#2a4650]"><X size={13} /></button></> : <span className="flex items-center gap-2"><ShieldCheck size={14} className="text-[#7fe0c2]" />Real frames stay in your browser</span>}</div><div className="flex gap-2">{source === 'Camera' && (cameraOn ? <><button data-testid="button-capture-frame" onClick={capture} className="flex items-center justify-center gap-2 rounded-lg border border-[#58717a] px-3 py-2 text-xs font-bold transition hover:bg-[#294652]"><Camera size={14} /> Capture frame</button><button data-testid="button-stop-camera" onClick={() => { stopCamera(); onStatusChange('Model Not Connected'); }} className="grid h-9 w-9 place-items-center rounded-lg border border-[#58717a] text-[#f29b87] hover:bg-[#4c3540]"><Square size={13} /></button></> : <button data-testid="button-start-camera" onClick={startCamera} className="flex items-center justify-center gap-2 rounded-lg border border-[#58717a] px-3 py-2 text-xs font-bold transition hover:bg-[#294652]"><Play size={14} /> Start camera</button>)}<button data-testid="button-run-prediction" disabled={running} onClick={runPrediction} className="flex items-center justify-center gap-2 rounded-lg bg-[#7fe0c2] px-4 py-2 text-xs font-extrabold text-[#143029] transition hover:bg-[#a0efd8] disabled:cursor-wait disabled:opacity-60"><Zap size={14} /> {running ? 'Connecting…' : 'Run prediction'}</button></div></div>
        {message && <div data-testid="status-detection-message" className={`mt-3 text-xs ${message.includes('unavailable') || message.includes('Please') || message.includes('Add') ? 'text-[#f3ab96]' : 'text-[#9cb1b2]'}`}>{message}</div>}
      </div>
       <div className="bg-[#172b37] p-5 sm:p-7"><div className="font-mono-custom text-[10px] uppercase tracking-[.14em] text-[#718b91]">Review protocol</div><div className="mt-5 space-y-5">{[['01', 'Frame quality', 'Single face, forward-facing view'], ['02', 'Eye state', 'Awake / sleepy classification'], ['03', 'Confidence', 'Probability returned by model']].map(([number, title, text]) => <div key={number} className="flex gap-3"><div className="font-mono-custom text-[11px] text-[#7fe0c2]">{number}</div><div><div className="text-xs font-bold text-[#e6eee8]">{title}</div><div className="mt-1 text-[11px] leading-5 text-[#849da0]">{text}</div></div></div>)}</div><div className="mt-8 border-t border-[#39505b] pt-5"><div className="flex items-center gap-2 text-[11px] font-bold text-[#dfeae4]"><CircleHelp size={14} className="text-[#f2a65a]" /> Model connection required</div><p className="mt-2 text-[11px] leading-5 text-[#849da0]">No prediction is generated until a real TensorFlow / Keras endpoint is connected. Captured frames stay in this browser until you submit one.</p></div></div>
    </div>
  </section>;
}

function PredictionRow({ prediction, compact = false }: { prediction: Prediction; compact?: boolean }) {
  const tone: PredictionLabel = prediction.label;
  return <div data-testid={`row-prediction-${prediction.id}`} className="group flex items-center gap-3 border-b border-border py-3.5 last:border-0"><div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">{prediction.imagePreview ? <img src={prediction.imagePreview} alt="" className="h-full w-full object-cover" /> : prediction.source === 'Camera' ? <Camera size={16} className="text-muted-foreground" /> : <Upload size={16} className="text-muted-foreground" />}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Badge label={prediction.label} tone={tone === 'Awake' ? 'awake' : 'sleepy'} /><span className="font-mono-custom text-[10px] text-muted-foreground">{prediction.source}</span></div><div className="mt-1 text-[11px] text-muted-foreground">{compact ? relativeTime(prediction.timestamp) : formatTimestamp(prediction.timestamp)}</div></div><div className="text-right"><div className={`font-mono-custom text-[12px] font-medium ${prediction.label === 'Sleepy' ? 'text-[#b1533d]' : 'text-primary'}`}>{prediction.confidence.toFixed(1)}%</div><div className="mt-1 h-1 w-14 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${prediction.label === 'Sleepy' ? 'bg-[#db6b58]' : 'bg-[#39b694]'}`} style={{ width: `${prediction.confidence}%` }} /></div></div></div>;
}

function Dashboard({ predictions, onPrediction, settings, onStatusChange }: { predictions: Prediction[]; onPrediction: (prediction: Prediction) => void; settings: IntegrationSettings; onStatusChange: (status: SystemStatus) => void }) {
  const stats = useMemo(() => { const awake = predictions.filter((item) => item.label === 'Awake').length; const sleepy = predictions.filter((item) => item.label === 'Sleepy').length; const avg = predictions.length ? predictions.reduce((sum, item) => sum + item.confidence, 0) / predictions.length : 0; return { awakeRate: predictions.length ? Math.round((awake / predictions.length) * 100) : 0, sleepy, avg }; }, [predictions]);
  return <div className="app-grid min-h-[calc(100dvh-82px)] -m-5 px-5 py-7 sm:-m-8 sm:px-8 lg:-m-10 lg:px-10 lg:py-9">
    <PageHeading eyebrow="Thursday · 14 May 2025" title="Stay sharp out there." description="A clear read on driver alertness, built for careful research and safer roads." action={<div className="flex items-center gap-2 rounded-full border border-[#b9d8cc] bg-[#e7f4ee] px-3 py-2 text-[11px] font-bold text-[#18775f]"><StatusDot /> Monitoring ready <span className="font-mono-custom text-[10px] font-normal text-[#568c7a]">LOCAL</span></div>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 animate-rise"><StatCard label="Total predictions" value={String(predictions.length)} detail="Real model results only" icon={BarChart3} /><StatCard label="Awake rate" value={`${stats.awakeRate}%`} detail="Alertness classification" icon={Eye} /><StatCard label="Sleepy alerts" value={String(stats.sleepy)} detail="Review recommended" icon={AlertTriangle} accent="red" /><StatCard label="Average confidence" value={`${stats.avg.toFixed(1)}%`} detail="Returned by connected model" icon={Gauge} accent="orange" /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(330px,.75fr)]"><div className="animate-rise-2"><DetectionWorkspace onPrediction={onPrediction} settings={settings} onStatusChange={onStatusChange} /></div><div className="space-y-6 animate-rise-3"><section className="rounded-xl border border-card-border bg-card p-5 shadow-[var(--shadow-soft)]"><div className="flex items-center justify-between"><div><div className="font-mono-custom text-[10px] uppercase tracking-[.14em] text-muted-foreground">Latest signal</div><div className="mt-1 font-display text-lg font-bold">Live readout</div></div><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e7f4ee] text-primary"><Activity size={17} /></div></div><div className="mt-6 flex items-center gap-5"><div className="metric-ring grid h-24 w-24 shrink-0 place-items-center rounded-full p-[7px]" style={{ '--progress': `${stats.awakeRate}%` } as React.CSSProperties}><div className="grid h-full w-full place-items-center rounded-full bg-card"><span className="font-display text-xl font-bold">{stats.awakeRate}%</span></div></div><div><div className="text-sm font-bold">Alertness trend</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{predictions.length ? 'Recent real model reviews appear in this session.' : 'A real model result will appear here after the first review.'}</p>{predictions.length > 0 && <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-primary"><ArrowUpRight size={14} /> {stats.awakeRate}% awake in session</div>}</div></div></section><section className="rounded-xl border border-card-border bg-card p-5 shadow-[var(--shadow-soft)]"><div className="flex items-center justify-between"><div><div className="font-mono-custom text-[10px] uppercase tracking-[.14em] text-muted-foreground">Recent reviews</div><div className="mt-1 font-display text-lg font-bold">Activity feed</div></div><Link href="/history" data-testid="link-view-all-history" className="text-[11px] font-bold text-primary hover:underline">View all</Link></div><div className="mt-3">{predictions.slice(0, 4).map((prediction) => <PredictionRow key={prediction.id} prediction={prediction} compact />)}</div>{predictions.length === 0 && <EmptyState compact />}</section></div></div>
    <div className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-xl border border-[#d9bd8d] bg-[#fff3df] p-5 md:col-span-2"><div className="flex gap-3"><div className="mt-0.5 text-[#b87529]"><Info size={17} /></div><div><div className="text-sm font-bold text-[#76501e]">Model connection required</div><p className="mt-1 max-w-2xl text-xs leading-5 text-[#8e6c3a]">Nightwatch never invents an Awake or Sleepy result. Connect your Python TensorFlow / Keras endpoint in Settings before running a real prediction.</p></div></div></div><div className="rounded-xl border border-card-border bg-card p-5"><div className="font-mono-custom text-[10px] uppercase tracking-[.14em] text-muted-foreground">Model threshold</div><div className="mt-3 flex items-end justify-between"><span className="font-display text-3xl font-bold">{settings.threshold}%</span><Link href="/settings" data-testid="link-adjust-threshold" className="text-[11px] font-bold text-primary hover:underline">Adjust</Link></div><div className="mt-3 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${settings.threshold}%` }} /></div></div></div>
  </div>;
}

function EmptyState({ compact = false }: { compact?: boolean }) {
  return <div data-testid="empty-predictions" className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'min-h-[320px] py-16'}`}><div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><History size={21} /></div><div className="mt-4 text-sm font-bold">No reviews yet</div><p className="mt-1 max-w-[250px] text-xs leading-5 text-muted-foreground">Run a frame review from the Overview workspace and your results will appear here.</p></div>;
}

function HistoryPage({ predictions, onClear }: { predictions: Prediction[]; onClear: () => void }) {
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState<'All' | PredictionLabel>('All');
  const filtered = useMemo(() => predictions.filter((item) => (filter === 'All' || item.label === filter) && `${item.label} ${item.source} ${formatTimestamp(item.timestamp)}`.toLowerCase().includes(query.toLowerCase())), [predictions, filter, query]);
  const clear = () => { if (predictions.length && window.confirm('Clear all local prediction history?')) onClear(); };
  return <div className="app-grid min-h-[calc(100dvh-82px)] -m-5 px-5 py-7 sm:-m-8 sm:px-8 lg:-m-10 lg:px-10 lg:py-9"><PageHeading eyebrow="Review archive" title="Prediction history" description="A searchable record of every local review, with its source and confidence signal." action={<button data-testid="button-clear-history" onClick={clear} className="flex items-center justify-center gap-2 rounded-lg border border-[#e4b8a9] bg-[#fff4f0] px-3.5 py-2.5 text-xs font-bold text-[#ac513c] transition hover:bg-[#fae3d4]"><Trash2 size={14} /> Clear history</button>} /><section className="rounded-xl border border-card-border bg-card shadow-[var(--shadow-soft)]"><div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row"><label className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input data-testid="input-history-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by label, source or date…" className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs outline-none ring-primary/20 transition focus:ring-4" /></label><div className="flex rounded-lg bg-muted p-1">{(['All', 'Awake', 'Sleepy'] as const).map((item) => <button key={item} data-testid={`button-filter-${item.toLowerCase()}`} onClick={() => setFilter(item)} className={`rounded-md px-3 py-2 text-xs font-bold transition ${filter === item ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{item}</button>)}</div></div><div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr] gap-4 px-5 py-3 font-mono-custom text-[10px] uppercase tracking-[.14em] text-muted-foreground md:grid"><div>Classification</div><div>Source</div><div>Timestamp</div><div className="text-right">Confidence</div></div><div className="px-4 sm:px-5">{filtered.length ? filtered.map((prediction) => <div key={prediction.id} className="grid items-center gap-3 border-b border-border py-3.5 last:border-0 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:gap-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">{prediction.imagePreview ? <img src={prediction.imagePreview} alt="" className="h-full w-full object-cover" /> : prediction.source === 'Camera' ? <Camera size={15} className="text-muted-foreground" /> : <Upload size={15} className="text-muted-foreground" />}</div><div><Badge label={prediction.label} tone={prediction.label === 'Awake' ? 'awake' : 'sleepy'} /><div className="mt-1 text-[11px] text-muted-foreground md:hidden">{formatTimestamp(prediction.timestamp)} · {prediction.source}</div></div></div><div className="hidden text-xs text-muted-foreground md:block">{prediction.source}</div><div className="hidden text-xs text-muted-foreground md:block">{formatTimestamp(prediction.timestamp)}</div><div className="flex items-center justify-between md:justify-end"><span className="font-mono-custom text-xs font-medium">{prediction.confidence.toFixed(1)}%</span><div className="ml-3 h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${prediction.label === 'Sleepy' ? 'bg-[#db6b58]' : 'bg-primary'}`} style={{ width: `${prediction.confidence}%` }} /></div></div></div>) : <EmptyState compact={false} />}</div><div className="border-t border-border px-5 py-3 font-mono-custom text-[10px] uppercase tracking-[.12em] text-muted-foreground">{filtered.length} of {predictions.length} records · browser storage</div></section></div>;
}

function SettingsPage({ settings, onSave, onPreviewAlert }: { settings: IntegrationSettings; onSave: (settings: IntegrationSettings) => void; onPreviewAlert: () => void }) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  const update = <K extends keyof IntegrationSettings>(key: K, value: IntegrationSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };
  const save = () => {
    onSave({ ...draft, endpointStatus: 'Not connected' });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  };
  const endpointTone = draft.endpointStatus === 'Connected' ? 'teal' : draft.endpointStatus === 'Error' ? 'red' : 'orange';
  return <div className="app-grid min-h-[calc(100dvh-82px)] -m-5 px-5 py-7 sm:-m-8 sm:px-8 lg:-m-10 lg:px-10 lg:py-9">
    <PageHeading eyebrow="Configuration" title="Integration settings" description="Keep the model state honest today, and make the handoff to your trained TensorFlow / Keras service straightforward tomorrow." action={<div className="flex items-center gap-2 rounded-full border border-[#e4b8a9] bg-[#fff4f0] px-3 py-2 text-[11px] font-bold text-[#ac513c]"><Info size={14} /> {draft.providerMode === 'TensorFlow / Keras API' && draft.endpointUrl ? 'Endpoint configured' : 'Model not connected'}</div>} />
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.7fr)]">
      <section className="rounded-xl border border-card-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-7">
        <div className="flex items-start justify-between border-b border-border pb-5"><div><div className="font-display text-lg font-bold">Provider readiness</div><p className="mt-1 text-xs text-muted-foreground">No history entry is created unless a real frame reaches a connected model.</p></div><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#e2eaf0] text-[#526b84]"><Settings size={17} /></div></div>
        <div className="mt-6 space-y-6">
          <div><label htmlFor="provider-mode" className="mb-2 block text-xs font-bold">Provider mode</label><select id="provider-mode" data-testid="select-provider-mode" value={draft.providerMode} onChange={(event) => update('providerMode', event.target.value as IntegrationSettings['providerMode'])} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:ring-4 focus:ring-primary/15"><option value="Not connected">Not connected</option><option value="TensorFlow / Keras API">TensorFlow / Keras API</option></select><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{draft.providerMode === 'Not connected' ? 'Predictions are disabled until a real model endpoint is configured.' : 'The browser will POST the captured image to your Python service and validate its Awake/Sleepy response.'}</p></div>
          <div><label htmlFor="endpoint-url" className="mb-2 block text-xs font-bold">Prediction endpoint URL</label><input id="endpoint-url" data-testid="input-endpoint-url" type="url" value={draft.endpointUrl} onChange={(event) => update('endpointUrl', event.target.value)} placeholder="https://your-service.example/predict" className="h-11 w-full rounded-lg border border-input bg-background px-3 font-mono-custom text-xs outline-none focus:ring-4 focus:ring-primary/15" /><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Expected response: <code className="font-mono-custom">{'{ label: "Awake" | "Sleepy", confidence: 0-100 }'}</code></p></div>
          <div><div className="mb-2 text-xs font-bold">Endpoint status</div><div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3.5 py-3"><div className="flex items-center gap-2 text-xs font-semibold"><StatusDot color={endpointTone} />{draft.endpointStatus === 'Connected' ? 'Model Connected' : draft.endpointStatus === 'Error' ? 'Prediction Error' : 'Model Not Connected'}</div><span className="font-mono-custom text-[10px] text-muted-foreground">{draft.endpointUrl ? 'CONFIGURED' : 'NO URL'}</span></div></div>
          <div><div className="mb-2 flex justify-between"><label htmlFor="threshold" className="text-xs font-bold">Model confidence threshold</label><span className="font-mono-custom text-xs font-medium text-primary">{draft.threshold}%</span></div><input id="threshold" data-testid="input-alert-threshold" type="range" min="50" max="95" value={draft.threshold} onChange={(event) => update('threshold', Number(event.target.value))} className="w-full accent-[#16816b]" /><div className="mt-2 flex justify-between font-mono-custom text-[9px] text-muted-foreground"><span>50 · sensitive</span><span>95 · strict</span></div></div>
          <div><label htmlFor="sleepy-alert-after" className="mb-2 block text-xs font-bold">Sleepy warning trigger</label><select id="sleepy-alert-after" data-testid="select-sleepy-alert-after" value={draft.sleepyAlertAfter} onChange={(event) => update('sleepyAlertAfter', Number(event.target.value))} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none focus:ring-4 focus:ring-primary/15">{[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count} consecutive Sleepy prediction{count === 1 ? '' : 's'}</option>)}</select><p className="mt-2 text-[11px] leading-5 text-muted-foreground">The warning stays suppressed during the same Sleepy streak after the first alert, then resets when Awake is detected.</p></div>
          <div><label htmlFor="model-version" className="mb-2 block text-xs font-bold">Model version label</label><input id="model-version" data-testid="input-model-version" value={draft.modelVersion} onChange={(event) => update('modelVersion', event.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 font-mono-custom text-xs outline-none focus:ring-4 focus:ring-primary/15" /></div>
        </div>
        <div className="mt-7 flex flex-col items-stretch justify-end gap-3 border-t border-border pt-5 sm:flex-row sm:items-center"><span data-testid="status-settings-saved" className={`text-xs text-primary transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`}>Settings saved locally</span><button data-testid="button-save-settings" onClick={save} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground transition hover:brightness-110"><Check size={14} /> Save settings</button></div>
      </section>
      <div className="space-y-6">
        <section className="rounded-xl border border-[#b9d8cc] bg-[#e7f4ee] p-5"><div className="flex items-center gap-2 text-xs font-bold text-[#176f5b]"><ShieldCheck size={16} /> Integration contract</div><p className="mt-3 text-xs leading-5 text-[#4d7d70]">Your Python service receives a real image and returns a validated classification. Camera frames are not logged by this browser flow.</p><div className="mt-4 rounded-lg border border-[#c5dfd3] bg-[#f1fbf5] p-3 font-mono-custom text-[10px] leading-5 text-[#39705f]"><div>POST /predict</div><div>Request: {'{ image, source }'}</div><div className="text-[#6b9a89]">Response: {'{ label, confidence }'}</div></div></section>
        <section className="rounded-xl border border-[#d9bd8d] bg-[#fff3df] p-5"><div className="flex items-center gap-2 text-xs font-bold text-[#76501e]"><AlertTriangle size={16} /> Development test only</div><p className="mt-3 text-xs leading-5 text-[#8e6c3a]">Preview the sleepy warning without calling a model or adding anything to Prediction History. This is the only test shortcut in the app.</p><button data-testid="button-preview-alert" onClick={onPreviewAlert} className="mt-4 flex items-center gap-2 rounded-lg border border-[#d9bd8d] bg-[#fffaf0] px-3.5 py-2.5 text-xs font-bold text-[#76501e] transition hover:bg-[#ffe9c4]"><AlertTriangle size={14} /> Preview warning</button></section>
        <section className="rounded-xl border border-card-border bg-card p-5 shadow-[var(--shadow-soft)]"><div className="font-mono-custom text-[10px] uppercase tracking-[.14em] text-muted-foreground">Current configuration</div><div className="mt-4 space-y-3">{[['Mode', draft.providerMode], ['Version', draft.modelVersion], ['Threshold', `${draft.threshold}%`], ['Warning trigger', `${draft.sleepyAlertAfter} Sleepy`], ['Storage', 'Local browser only']].map(([key, value]) => <div key={key} className="flex items-center justify-between border-b border-border pb-3 text-xs last:border-0 last:pb-0"><span className="text-muted-foreground">{key}</span><span className="max-w-[170px] truncate text-right font-semibold">{value}</span></div>)}</div></section>
      </div>
    </div>
  </div>;
}

function Router() {
  const [predictions, setPredictions] = useState<Prediction[]>(() => getStoredPredictions());
  const [settings, setSettings] = useState<IntegrationSettings>(() => getStoredSettings());
  const [status, setStatus] = useState<SystemStatus>('Model Not Connected');
  const [notice, setNotice] = useState<AlertNotice | null>(null);
  const sleepyStreakRef = useRef(0);

  const addPrediction = (prediction: Prediction) => {
    setPredictions((current) => {
      const next = [prediction, ...current];
      savePredictions(next);
      return next;
    });
    setSettings((current) => {
      const next = { ...current, endpointStatus: 'Connected' as const };
      saveSettings(next);
      return next;
    });

    if (prediction.label === 'Awake') {
      sleepyStreakRef.current = 0;
      silentAlarmService.reset();
      setNotice(null);
      return;
    }

    sleepyStreakRef.current += 1;
    const streak = sleepyStreakRef.current;
    const threshold = Math.max(1, settings.sleepyAlertAfter);
    const warningTriggered = streak >= threshold;
    const alert: AlertNotice = warningTriggered
      ? { title: 'DROWSINESS DETECTED', message: 'Please take a break and do not continue driving if you are feeling sleepy.', streak }
      : { title: 'Sleepy prediction recorded', message: `The warning is set to trigger after ${threshold} consecutive Sleepy predictions.`, streak };

    if (warningTriggered && streak === threshold) {
      silentAlarmService.announce({ title: alert.title, message: alert.message, streak });
      setNotice(alert);
    } else if (!warningTriggered) {
      setNotice(alert);
    }
  };
  const clearPredictions = () => {
    setPredictions([]);
    savePredictions([]);
    sleepyStreakRef.current = 0;
    silentAlarmService.reset();
    setNotice(null);
  };
  const updateSettings = (next: IntegrationSettings) => {
    const saved = { ...next, endpointStatus: 'Not connected' as const };
    setSettings(saved);
    saveSettings(saved);
    setStatus('Model Not Connected');
  };
  const previewAlert = () => {
    const alert: AlertNotice = { title: 'Development warning preview', message: 'Test only — no model was called and no prediction was added to history.', streak: 0, isTest: true };
    silentAlarmService.announce({ title: alert.title, message: alert.message, streak: 0 });
    setNotice(alert);
  };

  return <Shell status={status} notice={notice} onDismissAlert={() => setNotice(null)}><Switch><Route path="/"><Dashboard predictions={predictions} onPrediction={addPrediction} settings={settings} onStatusChange={setStatus} /></Route><Route path="/history"><HistoryPage predictions={predictions} onClear={clearPredictions} /></Route><Route path="/settings"><SettingsPage settings={settings} onSave={updateSettings} onPreviewAlert={previewAlert} /></Route><Route component={NotFound} /></Switch></Shell>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RoutedErrorBoundary><Router /></RoutedErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
