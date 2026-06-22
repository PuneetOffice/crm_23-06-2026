 

import React, {
  useState, useRef, useEffect, useCallback, memo
} from "react";
import apiClient from "../api/client";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Constants & Utilities
// ─────────────────────────────────────────────────────────────────────────────

const VALIDATION = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5 MB
  ALLOWED_TYPES: [
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/bmp",
    "image/webp",
  ],
  ALLOWED_EXTENSIONS: [".jpg", ".jpeg", ".png", ".tiff", ".bmp", ".webp"],
};

/** Validate a File object. Returns { valid, error }. */
const validateFile = (file) => {
  if (!file) return { valid: false, error: "No file selected." };
  if (file.size > VALIDATION.MAX_FILE_SIZE) {
    const mb = (file.size / 1024 / 1024).toFixed(2);
    return { valid: false, error: `File is ${mb} MB — maximum allowed is 5 MB.` };
  }
  if (!VALIDATION.ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type}" is not supported. Use JPEG, PNG, TIFF, BMP, or WebP.`,
    };
  }
  return { valid: true, error: null };
};

/** Read a File as a base64 data URL. */
const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = ()  => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

/**
 * Compress a data URL to JPEG with a maximum dimension.
 * Returns a new data URL.
 */
const compressDataURL = (dataURL, maxWidth = 1800, quality = 0.88) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale  = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataURL;
  });

/** Convert a base64 data URL to a File object. */
const dataURLtoFile = (dataURL, filename) => {
  const [header, data] = dataURL.split(",");
  const mime  = header.match(/:(.*?);/)[1];
  const bstr  = atob(data);
  let n        = bstr.length;
  const u8arr  = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
};

/**
 * POST /BusinessCard/scan
 * Returns parsed response data.
 * Throws a structured Error on failure.
 */
const scanBusinessCard = async (file, signal = null) => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await apiClient.post("/BusinessCard/scan", formData, { signal });
    return response.data;
  } catch (error) {
    if (error.name === "AbortError" || error.name === "CanceledError") throw error;

    const status = error.response?.status;
    const messages = {
      400: "Invalid file format or file is too large.",
      422: "Unable to extract data from this business card.",
      500: "Server error — please try again.",
      501: "Business card scanning is not configured on this server.",
    };

    const err = new Error(messages[status] || "Failed to scan business card.");
    err.status = status ?? null;
    err.detail = error.response?.data?.detail ?? error.message;
    throw err;
  }
};

 
const probeCameraSupport = () => {
  try {
    // window.isSecureContext is false on plain HTTP (camera API blocked by browsers)
    if (typeof window !== "undefined" && window.isSecureContext === false) return false;
    if (typeof navigator === "undefined") return false;
    // mediaDevices may exist but getUserMedia might not (older browsers)
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") return true;
    // Legacy webkit prefix fallback (very old Safari / Android)
    if (typeof navigator.getUserMedia === "function") return true;
    if (typeof navigator.webkitGetUserMedia === "function") return true;
    return false;
  } catch {
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — SVG Icons (memoized)
// ─────────────────────────────────────────────────────────────────────────────

const Icon = memo(({ d, size = 20, stroke = true, fill = false, strokeWidth = 2, viewBox = "0 0 24 24", className = "" }) => (
  <svg
    width={size} height={size}
    viewBox={viewBox}
    fill={fill ? "currentColor" : "none"}
    stroke={stroke ? "currentColor" : "none"}
    strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {Array.isArray(d) ? d.map((path, i) => <path key={i} d={path} />) : <path d={d} />}
  </svg>
));

const UploadIcon  = () => <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeWidth={2.5} />;
const CameraIcon  = () => <Icon d={["M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z", "M15 13a3 3 0 11-6 0 3 3 0 016 0z"]} />;
const FlipIcon    = () => <Icon d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />;
const XIcon       = () => <Icon d="M6 18L18 6M6 6l12 12" strokeWidth={2.5} />;
const CheckIcon   = () => <Icon d="M5 13l4 4L19 7" strokeWidth={2.5} />;
const RetakeIcon  = () => <Icon d="M4 4v5h.582m0 0a8 8 0 1115.356 2M4.582 9H9" />;
const GridIcon    = ({ active }) => (
  <Icon
    d={["M4 6h16", "M4 10h16", "M4 14h16", "M4 18h16", "M8 4v16", "M12 4v16", "M16 4v16"]}
    className={active ? "text-sky-400" : "text-slate-400"}
  />
);

const SpinnerIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ animation: "bcuSpin 0.8s linear infinite" }}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Scanner Modal (isolated so parent re-renders don't affect it)
// ─────────────────────────────────────────────────────────────────────────────

const ScannerModal = memo(({
  videoRef,
  canvasRef,
  isCaptured,
  capturedImage,
  cameraFacingMode,
  cameraError,
  scannerLoading,
  showGrid,
  onClose,
  onCapture,
  onRetake,
  onConfirm,
  onFlip,
  onToggleGrid,
}) => {
  // Animated corner guide positions — BUG 2 fix: correct border property names
  const CORNERS = [
    { top: 0,    left:  0, borderTopWidth: 2,    borderLeftWidth:  2, borderRadius: "6px 0 0 0"  },
    { top: 0,    right: 0, borderTopWidth: 2,    borderRightWidth: 2, borderRadius: "0 6px 0 0"  },
    { bottom: 0, left:  0, borderBottomWidth: 2, borderLeftWidth:  2, borderRadius: "0 0 0 6px"  },
    { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderRadius: "0 0 6px 0"  },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Business card scanner"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/92 backdrop-blur-2xl animate-in fade-in duration-200"
    >
      <div className="relative w-full rounded-3xl overflow-hidden max-w-[480px] bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl border border-white/10 max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-6 duration-300"
        style={{
          boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
          animation: "bcuSlideUp 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}>

        {/* ── Modal Header ── */}
        <div className="px-5 py-[18px] bg-gradient-to-r from-sky-500/10 to-blue-600/10 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-[38px] h-[38px] rounded-[10px] bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0"
              style={{ boxShadow: "0 4px 12px rgba(14,165,233,0.35)" }}>
              <CameraIcon />
            </div>
            <div>
              <div className="text-slate-100 font-bold text-[15px] tracking-tight">
                Card Scanner
              </div>
              <div className="text-slate-400 text-xs mt-0.5">
                {isCaptured ? "Review your capture" : "Align card within the frame"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="w-[34px] h-[34px] rounded-[9px] bg-white/6 border border-white/8 text-slate-400 hover:bg-white/12 hover:text-slate-100 cursor-pointer flex items-center justify-center transition-all duration-150"
          >
            <XIcon />
          </button>
        </div>

        {/* ── Viewfinder ── */}
        <div className="relative bg-black flex-shrink-0" style={{ aspectRatio: "4/3" }}>

          {/* Live video */}
          {!isCaptured && (
            <video
              ref={videoRef}
              autoPlay playsInline muted
              className="w-full h-full object-cover block"
              style={{
                transform: cameraFacingMode === "user" ? "scaleX(-1)" : "none",
                transition: "opacity 0.3s",
              }}
            />
          )}

          {/* Captured preview */}
          {isCaptured && capturedImage && (
            <img
              src={capturedImage}
              alt="Captured business card"
              className="w-full h-full object-contain block bg-black animate-in fade-in duration-250"
            />
          )}

          {/* Camera error state */}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-7 text-center gap-4 animate-in fade-in duration-200">
              <div className="w-14 h-14 rounded-2xl bg-red-600/15 border border-red-600/25 flex items-center justify-center text-red-400 mb-1">
                <svg width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <div className="text-slate-200 text-sm font-semibold mb-1.5">Camera Unavailable</div>
                <div className="text-slate-500 text-sm leading-relaxed">{cameraError}</div>
              </div>
            </div>
          )}

          {/* Grid overlay */}
          {!isCaptured && !cameraError && showGrid && (
            <div className="absolute inset-0 pointer-events-none">
              {[33.33, 66.66].map(p => (
                <React.Fragment key={p}>
                  <div className="absolute left-0 right-0 h-px bg-white/10" style={{ top: `${p}%` }} />
                  <div className="absolute top-0 bottom-0 w-px bg-white/10" style={{ left: `${p}%` }} />
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Card frame guide with animated corners */}
          {!isCaptured && !cameraError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Dim vignette outside card area */}
              <div className="absolute inset-0" style={{
                background: "radial-gradient(ellipse 78% 62% at 50% 50%, transparent 48%, rgba(0,0,0,0.45) 100%)",
              }} />
              {/* Card outline box */}
              <div className="relative" style={{ width: "82%", aspectRatio: "1.75/1" }}>
                {/* Main border */}
                <div className="absolute inset-0 border rounded border-cyan-500/40" style={{
                  boxShadow: "0 0 0 1px rgba(56,189,248,0.08) inset",
                }} />
                {/* Animated corner markers */}
                {CORNERS.map((style, i) => (
                  <div key={i} className="absolute border-cyan-500"
                    style={{
                      width: 22, height: 22,
                      borderStyle: "solid",
                      ...style,
                      animation: `bcuCornerPulse 2.5s ease-in-out ${i * 0.15}s infinite`,
                    }} />
                ))}
                {/* Center crosshair */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 opacity-50">
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-cyan-500 -translate-y-1/2" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-cyan-500 -translate-x-1/2" />
                </div>
              </div>
            </div>
          )}

          {/* Camera controls overlay (grid toggle + flip) */}
          {!isCaptured && !cameraError && (
            <div className="absolute top-3 right-3 flex flex-col gap-2">
              <CameraControlBtn onClick={onFlip} label="Flip camera" title="Flip camera">
                <FlipIcon />
              </CameraControlBtn>
              <CameraControlBtn onClick={onToggleGrid} label="Toggle grid" title="Toggle grid">
                <GridIcon active={showGrid} />
              </CameraControlBtn>
            </div>
          )}
        </div>

        {/* ── Footer Controls ── */}
        {!cameraError && (
          <div className="px-5 pt-5 pb-[22px] bg-black/60 border-t border-white/5 flex-shrink-0">

            {/* Live view: shutter */}
            {!isCaptured && (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-22 px-[18px] py-[9px] rounded-[10px] bg-white/5 border border-white/10 hover:border-white/20 text-slate-400 hover:text-slate-100 text-sm font-medium cursor-pointer transition-all duration-150"
                >
                  Cancel
                </button>

                {/* Shutter button */}
                <button
                  type="button"
                  onClick={onCapture}
                  aria-label="Capture photo"
                  className="relative w-[72px] h-[72px] rounded-full bg-transparent border-none cursor-pointer p-0 flex-shrink-0 flex items-center justify-center"
                >
                  {/* Outer pulse ring */}
                  <span className="absolute -m-1 rounded-full border-2 border-cyan-500/50 animate-pulse" style={{
                    inset: "-4px",
                    animation: "bcuShutterPulse 2s ease-in-out infinite",
                  }} />
                  {/* White ring */}
                  <span className="absolute rounded-full border-[3px] border-white/90" style={{ inset: 0 }} />
                  {/* Inner disc */}
                  <span className="w-[54px] h-[54px] rounded-full bg-gradient-to-br from-white to-slate-200 block"
                    style={{
                      boxShadow: "0 2px 12px rgba(255,255,255,0.3)",
                      transition: "transform 0.1s, box-shadow 0.1s",
                    }} />
                </button>

                <div className="w-22" />
              </div>
            )}

            {/* Captured view: retake + confirm */}
            {isCaptured && (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={onRetake}
                  disabled={scannerLoading}
                  className={`flex-1 flex items-center justify-center gap-2 px-0 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                    scannerLoading
                      ? "bg-white/4 border border-white/10 text-slate-500 cursor-not-allowed opacity-40"
                      : "bg-white/4 border border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-100 cursor-pointer"
                  }`}
                >
                  <RetakeIcon />
                  Retake
                </button>

                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={scannerLoading}
                  className={`flex-none flex-2 flex items-center justify-center gap-2 px-0 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                    scannerLoading
                      ? "bg-white/5 text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-br from-cyan-500 to-blue-600 text-white cursor-pointer hover:-translate-y-0.5 hover:shadow-lg"
                  }`}
                  style={{
                    boxShadow: scannerLoading ? "none" : "0 4px 20px rgba(14,165,233,0.35)",
                  }}
                >
                  {scannerLoading ? <><SpinnerIcon />Processing…</> : <><CheckIcon />Use This Photo</>}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

/** Small circular control button used in the scanner overlay */
const CameraControlBtn = memo(({ onClick, label, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={title}
    className="w-9 h-9 rounded-full bg-black/55 border border-white/12 backdrop-blur text-slate-100 flex items-center justify-center cursor-pointer hover:bg-black/75 transition-all duration-150"
  >
    {children}
  </button>
));

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Main Component
// ─────────────────────────────────────────────────────────────────────────────

const BusinessCardUpload = ({ onSuccess, onError, onSetCountry, onSetState }) => {

  // ── State ───────────────────────────────────────────────────────────────────
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState("");
  const [success,           setSuccess]           = useState("");
  const [scannedImage,      setScannedImage]      = useState(null);

  const [isScannerOpen,     setIsScannerOpen]     = useState(false);
  const [videoStream,       setVideoStream]       = useState(null);
  const [isCaptured,        setIsCaptured]        = useState(false);
  const [capturedImage,     setCapturedImage]     = useState(null);
  const [cameraFacingMode,  setCameraFacingMode]  = useState("environment");
  const [cameraError,       setCameraError]       = useState("");
  const [scannerLoading,    setScannerLoading]    = useState(false);
  const [showGrid,          setShowGrid]          = useState(true);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const fileInputRef       = useRef(null);
  const videoRef           = useRef(null);
  const canvasRef          = useRef(null);
  const abortControllerRef = useRef(null);
  const successTimerRef    = useRef(null);
  const errorTimerRef      = useRef(null);

  /**
   * BUG 1 FIX: Tracks whether the modal is actively running a stream.
   * Prevents double-start when both mobile auto-open AND openScanner run.
   */
  const streamActiveRef    = useRef(false);

  // ── Device / capability ─────────────────────────────────────────────────────

  /**
   * Camera support is detected AFTER mount via useEffect, NOT synchronously.
   *
   * WHY: On mobile Safari and Android WebViews, navigator.mediaDevices is
   * undefined during the first synchronous render — the browser only attaches
   * it after confirming a secure context. A synchronous check always returns
   * false on those devices, hiding the Scan button for everyone on mobile.
   *
   * Strategy: default to `true` (show button immediately), then on mount run
   * the real probe. If the device genuinely has no camera API (e.g. plain HTTP
   * or old browser) we hide the button after the first paint. This is far
   * better UX than always hiding it on valid mobile devices.
   */
  const [_cameraSupported, setCameraSupported] = useState(true);
  useEffect(() => {
    setCameraSupported(probeCameraSupport());
  }, []);

  // ── Stream management ───────────────────────────────────────────────────────

  /** Stop any running stream and update ref flag. */
  const stopStream = useCallback(() => {
    streamActiveRef.current = false;
    setVideoStream((prev) => {
      if (prev) prev.getTracks().forEach((t) => t.stop());
      return null;
    });
  }, []);

  /**
   * Start camera. facingMode defaults to current state value.
   * This is the SINGLE place getUserMedia is called — no useEffect duplicates.
   */
  const startCamera = useCallback(async (facingMode) => {
    if (streamActiveRef.current) stopStream(); // ensure clean slate

    setCameraError("");
    streamActiveRef.current = true;

    // Normalise getUserMedia across browsers (handles legacy webkit prefix)
    const getUserMedia = (
      navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) ||
      navigator.getUserMedia?.bind(navigator) ||
      navigator.webkitGetUserMedia?.bind(navigator)
    );

    if (!getUserMedia) {
      streamActiveRef.current = false;
      setCameraError("Your browser does not support camera access. Please use file upload.");
      return;
    }

    try {
      const stream = await (
        navigator.mediaDevices?.getUserMedia
          ? navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: facingMode },
                width:  { ideal: 1920 },
                height: { ideal: 1080 },
              },
              audio: false,
            })
          // Legacy promise-less fallback wrapped in Promise
          : new Promise((res, rej) => getUserMedia(
              { video: { facingMode: { ideal: facingMode } }, audio: false },
              res, rej
            ))
      );

      // Guard: modal may have closed during the async await
      if (!streamActiveRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      setVideoStream(stream);
    } catch (err) {
      streamActiveRef.current = false;
      if      (err.name === "NotAllowedError"   || err.name === "PermissionDeniedError") setCameraError("Camera permission denied. Allow access in your browser settings, or use file upload.");
      else if (err.name === "NotFoundError")                                             setCameraError("No camera was found on this device.");
      else if (err.name === "NotReadableError")                                          setCameraError("Camera is in use by another application.");
      else                                                                               setCameraError("Unable to access the camera. Please use file upload instead.");
    }
  }, [stopStream]);

  /** Wire stream to video element once both are available. */
  useEffect(() => {
    if (videoStream && videoRef.current && videoRef.current.srcObject !== videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream, isScannerOpen]); // isScannerOpen re-connects after modal re-mounts

  /** Prevent body scroll while scanner is open. */
  useEffect(() => {
    document.body.style.overflow = isScannerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isScannerOpen]);

  /** Clean up on unmount. */
  useEffect(() => () => {
    stopStream();
    clearTimeout(successTimerRef.current);
    clearTimeout(errorTimerRef.current);
  }, [stopStream]);

  // ── Scanner open / close ────────────────────────────────────────────────────

  const openScanner = useCallback(() => {
    setIsCaptured(false);
    setCapturedImage(null);
    setCameraError("");
    setScannerLoading(false);
    setIsScannerOpen(true);
    // Single, authoritative call to startCamera — no useEffect duplication
    startCamera(cameraFacingMode);
  }, [cameraFacingMode, startCamera]);

  const closeScanner = useCallback(() => {
    stopStream();
    setIsScannerOpen(false);
    setIsCaptured(false);
    setCapturedImage(null);
    setCameraError("");
    setScannerLoading(false);
  }, [stopStream]);

  // ── Camera controls ─────────────────────────────────────────────────────────

  const handleFlipCamera = useCallback(() => {
    const next = cameraFacingMode === "environment" ? "user" : "environment";
    setCameraFacingMode(next);
    startCamera(next);
  }, [cameraFacingMode, startCamera]);

  const handleCapture = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataURL = canvas.toDataURL("image/jpeg", 0.95);

    stopStream();
    setCapturedImage(dataURL);
    setIsCaptured(true);
  }, [stopStream]);

  const handleRetake = useCallback(() => {
    setIsCaptured(false);
    setCapturedImage(null);
    startCamera(cameraFacingMode);
  }, [cameraFacingMode, startCamera]);

  // ── Form population ─────────────────────────────────────────────────────────

  /**
   * BUG 4 FIX: mapFieldsToForm memoized with explicit deps so processFile
   * dependency array stays accurate and no stale closure captures.
   */
  const mapFieldsToForm = useCallback((data) => {
    if (data.country != null) onSetCountry?.(String(data.country).trim());
    if (data.state   != null) onSetState?.(String(data.state).trim());

    const fill = (name, value) => {
      if (value == null || typeof value !== "string") return;
      const el = document.querySelector(`[name="${name}"]`);
      if (!el) return;
      el.value = value.trim();
      el.focus();
      el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      el.dispatchEvent(new Event("input",  { bubbles: true, cancelable: true }));
    };

    fill("Name",    data.name);
    fill("Website", data.website);
    fill("Phone",   data.phone);
    fill("Address", data.address);
    fill("City",    data.city);
  }, [onSetCountry, onSetState]);

  // ── Core scan → API → form ──────────────────────────────────────────────────

  const processFile = useCallback(async (file, previewDataURL) => {
    // Validate first
    const v = validateFile(file);
    if (!v.valid) { setError(v.error); return; }

    setError("");
    setSuccess("");
    setLoading(true);
    setScannedImage(previewDataURL);
    abortControllerRef.current = new AbortController();

    try {
      const data = await scanBusinessCard(file, abortControllerRef.current.signal);
      mapFieldsToForm(data);
      setSuccess("Business card scanned successfully!");
      onSuccess?.(data);

      clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      if (err.name === "AbortError" || err.name === "CanceledError") return;
      const msg = err.message || "Failed to scan business card.";
      setError(msg);
      onError?.(err);
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(""), 6000);
    } finally {
      setLoading(false);
    }
  }, [mapFieldsToForm, onSuccess, onError]);

  // ── Confirm capture ─────────────────────────────────────────────────────────

  const handleConfirmCapture = useCallback(async () => {
    if (!capturedImage) return;
    setScannerLoading(true);
    try {
      const compressed = await compressDataURL(capturedImage);
      const file       = dataURLtoFile(compressed, `scan_${Date.now()}.jpg`);

      // Validate here (inside modal) to surface errors without closing
      const v = validateFile(file);
      if (!v.valid) {
        setScannerLoading(false);
        setCameraError(v.error);
        return;
      }

      closeScanner();
      await processFile(file, compressed);
    } catch {
      setScannerLoading(false);
      setCameraError("Failed to process image. Please retake.");
    }
  }, [capturedImage, closeScanner, processFile]);

  // ── File upload ─────────────────────────────────────────────────────────────

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataURL = await readFileAsDataURL(file);
      await processFile(file, dataURL);
    } finally {
      e.target.value = "";
    }
  }, [processFile]);

  const handleCancelUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    setLoading(false);
    setError("");
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Main Card Widget ─────────────────────────────────────────────── */}
      <div className="rounded-[18px]   overflow-hidden border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 font-['DM_Sans,Inter,system-ui,sans-serif'] "
        style={{
          boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.06) inset",
        }}>

        {/* Gradient header */}
        <div className="px-[22px] py-4 bg-gradient-to-r from-cyan-500/15 to-blue-600/10 border-b border-white/6 relative overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute top-[-30px] left-[-20px] w-40 h-[100px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(ellipse, rgba(14,165,233,0.18) 0%, transparent 70%)",
            }} />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-[11px] bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0 text-white"
              style={{ boxShadow: "0 4px 14px rgba(14,165,233,0.35)" }}>
              <CameraIcon />
            </div>
            <div>
              <div className="text-slate-100 font-normal text-[15px] tracking-tight">
                Business Card Scanner
              </div>
              <div className="text-slate-500 text-xs mt-0.5">
                Upload or scan to auto-populate contact details
              </div>
            </div>
          </div>
        </div>

        {/* Card body */}
        <div className="px-[22px] py-[18px]">
          <div className="flex flex-col items-start gap-4 ">

            {/* Scanned thumbnail */}
            {scannedImage && (
              <div className="flex-shrink-0 relative">
                <img
                  src={scannedImage}
                  alt="Scanned business card"
                  className="w-[72px] h-[108px] object-cover rounded-[10px] border-2 border-cyan-500/30 block animate-in fade-in duration-300"
                  style={{
                    boxShadow: "0 4px 20px rgba(0,0,0,0.4), 0 0 0 4px rgba(14,165,233,0.08)",
                  }}
                />
                <div className="absolute -bottom-[7px] -right-[7px] w-[22px] h-[22px] rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white flex-shrink-0"
                  style={{
                    boxShadow: "0 2px 8px rgba(16,185,129,0.5), 0 0 0 2px #0b1524",
                  }}>
                  <CheckIcon />
                </div>
              </div>
            )}

            {/* Action area */}
            <div className="w-40">
              <div className="flex flex-row gap-2 mb-3">

                {/* Upload button */}
                <ActionButton
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  variant="secondary"
                >
                  {loading ? <><SpinnerIcon />Processing…</> : <><UploadIcon />Upload Card</>}
                </ActionButton>

                {/* Scan button — only shown when camera API available */}
                {_cameraSupported && (
                  <ActionButton
                    onClick={openScanner}
                    disabled={loading}
                    variant="primary"
                  >
                    <CameraIcon />
                    Scan Card
                  </ActionButton>
                )}

                {/* Cancel */}
                {loading && (
                  <ActionButton onClick={handleCancelUpload} variant="danger">
                    Cancel
                  </ActionButton>
                )}
              </div>

              {/* Success banner */}
              {success && (
                <div className="flex items-center gap-2 px-[14px] py-[10px] rounded-[10px] bg-emerald-600/10 border border-emerald-600/25 animate-in fade-in duration-200">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white flex-shrink-0">
                    <CheckIcon />
                  </div>
                  <span className="text-emerald-400 text-sm font-semibold">{success}</span>
                </div>
              )}

              {/* Error banner */}
              {error && (
                <div className="flex items-start gap-2 px-[14px] py-[10px] rounded-[10px] bg-red-600/8 border border-red-600/20 animate-in fade-in duration-200">
                  <svg width={16} height={16} fill="currentColor" viewBox="0 0 20 20"
                    className="text-red-400 flex-shrink-0 mt-0.5">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-red-300 text-sm">{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>



      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={VALIDATION.ALLOWED_EXTENSIONS.join(",")}
        onChange={handleFileChange}
        style={{ display: "none" }}
        aria-label="Business card image file"
      />
      <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden="true" />

      {/* ── Scanner Modal ─────────────────────────────────────────────────── */}
      {isScannerOpen && (
        <ScannerModal
          videoRef={videoRef}
          canvasRef={canvasRef}
          isCaptured={isCaptured}
          capturedImage={capturedImage}
          cameraFacingMode={cameraFacingMode}
          cameraError={cameraError}
          scannerLoading={scannerLoading}
          showGrid={showGrid}
          onClose={closeScanner}
          onCapture={handleCapture}
          onRetake={handleRetake}
          onConfirm={handleConfirmCapture}
          onFlip={handleFlipCamera}
          onToggleGrid={() => setShowGrid(v => !v)}
        />
      )}

      {/* Keyframes — bcu-prefixed to avoid global collisions */}
      <style>{`
        @keyframes bcuFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes bcuSlideUp {
          from { opacity: 0; transform: translateY(28px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bcuSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes bcuShutterPulse {
          0%   { transform: scale(1);    opacity: 0.5; }
          50%  { transform: scale(1.22); opacity: 0.1; }
          100% { transform: scale(1);    opacity: 0.5; }
        }
        @keyframes bcuCornerPulse {
          0%   { opacity: 0.7; }
          50%  { opacity: 1;   }
          100% { opacity: 0.7; }
        }
      `}</style>
    </>
  );
};

// ── Utility: generic action button ────────────────────────────────────────────

const ActionButton = memo(({ onClick, disabled, variant = "secondary", children }) => {
  const variants = {
    primary: {
      base: "bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-none",
      hover: "hover:-translate-y-0.5 shadow-lg",
      shadow: "shadow-lg",
    },
    secondary: {
      base: "bg-white/5 text-slate-400 border border-white/10 hover:border-white/20 hover:text-slate-100",
      hover: "",
      shadow: "",
    },
    danger: {
      base: "bg-red-600/8 text-red-400 border border-red-600/20",
      hover: "",
      shadow: "",
    },
  };

  const v = variants[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 w-full px-4 py-[9px] rounded-[10px] text-xs sm:text-sm font-semibold whitespace-nowrap outline-none transition-all duration-150 ${
        disabled ? "opacity-40 cursor-not-allowed bg-white/3 text-slate-600" : `${v.base} cursor-pointer ${v.hover} ${v.shadow}`
      }`}
    >
      {children}
    </button>
  );
});

export default BusinessCardUpload;