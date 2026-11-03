import React, { useState, useEffect, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import {
  Camera,
  CameraOff,
  RefreshCw,
  Upload,
  AlertCircle,
  CheckCircle2,
  ScanLine,
  ArrowRight,
  Info,
  HelpCircle,
} from 'lucide-react';
import { Language, Product } from '../types';
import { translations } from '../translations';
import { fetchProductByBarcode, ApiError } from '../services/api';

interface ScanBarcodeViewProps {
  language: Language;
  onProductLoaded: (product: Product) => void;
  onNavigateToOCR: (initialBarcode?: string) => void;
}

export const ScanBarcodeView: React.FC<ScanBarcodeViewProps> = ({
  language,
  onProductLoaded,
  onNavigateToOCR,
}) => {
  const t = translations[language];

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [manualCode, setManualCode] = useState('');
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [lookupError, setLookupError] = useState<ApiError | null>(null);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const [imageDecodingError, setImageDecodingError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize barcode reader and query camera devices
  useEffect(() => {
    codeReaderRef.current = new BrowserMultiFormatReader();

    // Query cameras
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setVideoDevices(videoInputs);
        // Default to back / environment camera if available
        const backCamera = videoInputs.find((d) =>
          /back|rear|environment/i.test(d.label)
        );
        if (backCamera) {
          setSelectedDeviceId(backCamera.deviceId);
        } else if (videoInputs.length > 0) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      }).catch((err) => {
        console.warn('Could not enumerate video devices:', err);
      });
    }

    return () => {
      // Cleanly stop any active camera tracks when leaving scanner page
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    if (isStartingRef.current || isScanning) return;
    isStartingRef.current = true;
    setCameraError(null);
    setPermissionDenied(false);
    setLookupError(null);
    setImageDecodingError(null);

    // Stop any previously existing stream/controls to prevent duplicate camera streams
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access API is not supported by your browser or environment.');
      isStartingRef.current = false;
      return;
    }

    try {
      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserMultiFormatReader();
      }

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : { facingMode: { ideal: 'environment' } },
      };

      if (!videoRef.current) {
        isStartingRef.current = false;
        return;
      }

      setIsScanning(true);

      // Start continuous scanning using ZXing browser controls
      const controls = await codeReaderRef.current.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result, error) => {
          if (result) {
            const text = result.getText();
            if (text && text.trim()) {
              handleBarcodeDetected(text.trim());
            }
          }
        }
      );

      controlsRef.current = controls;
      if (controls && (controls as any).stream) {
        streamRef.current = (controls as any).stream;
      } else if (videoRef.current && videoRef.current.srcObject) {
        streamRef.current = videoRef.current.srcObject as MediaStream;
      }
    } catch (err: any) {
      stopCamera();
      const isDismissedOrDenied =
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.name === 'AbortError' ||
        err.name === 'SecurityError' ||
        (typeof err.message === 'string' &&
          /permission|dismiss|denied|not allowed/i.test(err.message));

      if (isDismissedOrDenied) {
        console.info('Camera permission prompt dismissed or not granted:', err.message || err.name);
        setPermissionDenied(true);
        setCameraError(t.scanner.cameraPermissionDenied);
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        console.info('No camera hardware found on this device:', err.message || err.name);
        setCameraError('No camera found on this device. Please enter the barcode number manually.');
      } else {
        console.info('Camera start notice:', err.message || err);
        setCameraError(err.message || 'Unable to access camera.');
      }
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopCamera = () => {
    // 1. Stop controls if active
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (err) {
        console.info('Controls stop notice:', err);
      }
      controlsRef.current = null;
    }

    // 2. Stop any stream tracks stored in streamRef (guarantees tracks stop even if DOM unmounted)
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
      } catch (err) {
        console.info('StreamRef stop notice:', err);
      }
      streamRef.current = null;
    }

    // 3. Stop tracks on videoRef.current if still attached
    if (videoRef.current) {
      try {
        if (videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {}
          });
          videoRef.current.srcObject = null;
        }
      } catch (err) {
        console.info('Video srcObject stop notice:', err);
      }
    }

    setIsScanning(false);
  };

  const switchCamera = async () => {
    if (videoDevices.length <= 1) return;
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDevice = videoDevices[nextIndex];
    setSelectedDeviceId(nextDevice.deviceId);
    stopCamera();
    setTimeout(() => {
      startCamera();
    }, 200);
  };

  const handleBarcodeDetected = (barcode: string) => {
    stopCamera();
    setLastScannedBarcode(barcode);
    lookupBarcode(barcode);
  };

  const lookupBarcode = async (barcode: string) => {
    setIsLoadingProduct(true);
    setLookupError(null);
    setImageDecodingError(null);

    try {
      const product = await fetchProductByBarcode(barcode);
      // Validate that the returned product barcode matches the scanned barcode
      if (String(product.barcode).trim() !== String(barcode).trim()) {
        product.barcodeMatches = false;
        console.info('Barcode mismatch detected between scanned and returned product');
      } else {
        product.barcodeMatches = true;
      }

      onProductLoaded(product);
    } catch (err: any) {
      console.info('Barcode lookup result:', err?.message || err);
      if (err instanceof ApiError) {
        setLookupError(err);
      } else {
        setLookupError(new ApiError(err?.message || 'Lookup failed', 'UNKNOWN', barcode, true));
      }
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim();
    if (!clean) return;
    setLastScannedBarcode(clean);
    lookupBarcode(clean);
  };

  // Decode barcode from an uploaded image file
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageDecodingError(null);
    setLookupError(null);
    setIsLoadingProduct(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        try {
          if (!codeReaderRef.current) {
            codeReaderRef.current = new BrowserMultiFormatReader();
          }
          const result = await codeReaderRef.current.decodeFromImageUrl(dataUrl);
          if (result && result.getText()) {
            const detected = result.getText().trim();
            setLastScannedBarcode(detected);
            lookupBarcode(detected);
          } else {
            setIsLoadingProduct(false);
            setImageDecodingError(t.scanner.noBarcodeInImage);
          }
        } catch (decodeErr: any) {
          setIsLoadingProduct(false);
          setImageDecodingError(t.scanner.noBarcodeInImage);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setIsLoadingProduct(false);
      setImageDecodingError('Failed to read image file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Title & Introduction */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
          <ScanLine className="w-3.5 h-3.5 text-emerald-600" />
          Camera, Image Upload & Manual Entry
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {t.scanner.title}
        </h1>
        <p className="text-slate-600 text-sm max-w-xl mx-auto">
          {t.scanner.instruction} Supports EAN-13, EAN-8, UPC-A, and UPC-E barcodes.
        </p>
      </div>

      {/* Main Scanner Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
        
        {/* Camera Viewfinder Area */}
        <div className="relative aspect-4/3 sm:aspect-16/9 bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover transition-opacity duration-200 ${
              !isScanning ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100'
            }`}
            playsInline
            muted
          />

          {/* Scanner Overlay UI when Scanning */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
              {/* Target viewfinder box */}
              <div className="relative w-64 h-44 sm:w-80 sm:h-52 border-2 border-emerald-400/90 rounded-2xl shadow-2xl overflow-hidden">
                {/* Corner markers */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400"></div>

                {/* Animated laser scan line */}
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-bounce mt-10"></div>
              </div>

              <div className="absolute bottom-4 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-emerald-300 text-xs font-semibold">
                {t.scanner.scanning}
              </div>
            </div>
          )}

          {/* Fallback View when camera is inactive */}
          {!isScanning && (
            <div className="text-center p-6 text-slate-400 space-y-4 max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 text-emerald-500 flex items-center justify-center mx-auto">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Camera Inactive</p>
                <p className="text-slate-400 text-xs mt-1">
                  Click the button below to turn on the live camera scanner, or enter a barcode manually.
                </p>
              </div>
            </div>
          )}

          {/* Loading Indicator Overlay */}
          {isLoadingProduct && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-3 z-10">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="font-bold text-sm tracking-wide">
                Searching Open Food Facts Database...
              </p>
              {lastScannedBarcode && (
                <p className="text-xs font-mono text-emerald-400">
                  Barcode: {lastScannedBarcode}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Camera Control Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {!isScanning ? (
            <button
              onClick={startCamera}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              {t.scanner.startCamera}
            </button>
          ) : (
            <>
              <button
                onClick={stopCamera}
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <CameraOff className="w-4 h-4" />
                {t.scanner.stopCamera}
              </button>

              {videoDevices.length > 1 && (
                <button
                  onClick={switchCamera}
                  className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-all flex items-center gap-2 cursor-pointer"
                  title="Switch between front and back cameras"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t.scanner.switchCamera}
                </button>
              )}
            </>
          )}

          {/* Upload Barcode Image Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-sm border border-emerald-200 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            {t.scanner.uploadImage}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>

        {/* Camera Permission Denied / Error Guidance */}
        {permissionDenied && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              Camera Permission Required
            </div>
            <p className="leading-relaxed">
              {t.scanner.cameraPermissionGuide}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={startCamera}
                className="px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                Request Camera Again
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100/50 text-amber-900 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-amber-700" />
                Upload Barcode Photo Instead
              </button>
            </div>
          </div>
        )}

        {cameraError && !permissionDenied && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{cameraError}</span>
          </div>
        )}

        {imageDecodingError && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{imageDecodingError}</span>
          </div>
        )}

        {/* Database 404 / Rescue Workflow */}
        {lookupError && (
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-300 text-slate-800 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Product Not Found in Database
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {lookupError.message}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-3">
              <button
                onClick={() => lookupBarcode(lookupError.scannedBarcode || lastScannedBarcode || '')}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Lookup
              </button>

              <button
                onClick={() => onNavigateToOCR(lookupError.scannedBarcode || lastScannedBarcode || '')}
                className="px-4 py-2 rounded-lg bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                Take Package Photo (OCR Rescue)
              </button>
            </div>
          </div>
        )}

        {/* Manual Barcode Input Section */}
        <div className="pt-6 border-t border-slate-200">
          <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-1.5">
            <ScanLine className="w-4 h-4 text-emerald-600" />
            {t.scanner.manualEntryTitle}
          </h3>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="e.g. 8901058852899 or 8904004400588"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden text-sm font-mono"
            />
            <button
              type="submit"
              disabled={isLoadingProduct || !manualCode.trim()}
              className="px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-sm transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              {isLoadingProduct ? 'Searching...' : 'Lookup Barcode'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Instructions for Unsupported Devices */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
          <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-800">
              Camera scanning not working or device lacks a camera?
            </p>
            <p className="leading-relaxed">
              You can simply type the printed 8-digit or 13-digit number below the barcode stripes, upload a saved photo of the barcode, or switch directly to the Package Photo OCR scanner.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
