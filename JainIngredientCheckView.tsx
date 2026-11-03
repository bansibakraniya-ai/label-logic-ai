import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Camera,
  Upload,
  Search,
  ScanLine,
  FileText,
  Sparkles,
  Info,
  Edit3,
  ExternalLink,
  ChevronRight,
  Layers,
  ArrowRight,
  RefreshCw,
  CameraOff,
} from 'lucide-react';
import { Language, Product, JainAnalysis, UserPreferences, OCRResult } from '../types';
import { translations } from '../translations';
import { checkJainSuitability, analyzePackagePhoto, fetchProductByBarcode } from '../services/api';
import { inspectJainSuitabilityLocally } from '../utils/jainRules';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface JainIngredientCheckViewProps {
  language: Language;
  product: Product | null;
  preferences: UserPreferences;
  onNavigateToScan: () => void;
  onNavigateToOCR: () => void;
  onSelectBarcode: (barcode: string) => void;
  onProductLoaded: (customProduct: Product) => void;
}

export const JainIngredientCheckView: React.FC<JainIngredientCheckViewProps> = ({
  language,
  product,
  preferences,
  onNavigateToScan,
  onNavigateToOCR,
  onSelectBarcode,
  onProductLoaded,
}) => {
  const t = translations[language];

  // Analysis state
  const [analysis, setAnalysis] = useState<JainAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Manual / custom text inspection
  const [manualText, setManualText] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);

  // In-page barcode lookup & live camera scanner state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isFetchingBarcode, setIsFetchingBarcode] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [cameraScanningError, setCameraScanningError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // In-page photo OCR state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isExtractingOCR, setIsExtractingOCR] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Demo products for instant one-click testing (including Plain Makhana, Plain Chana, and Seasoned Makhana)
  const demoSamples = [
    {
      barcode: '8906000000011',
      name: 'Plain Roasted Makhana (Fox Nuts)',
      brand: 'Pure Roots',
      expectedStatus: 'NOT_FOUND_IN_AVAILABLE_DATA',
      note: 'Fox nuts (makhana), rock salt. Simple complete ingredient list.',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
    {
      barcode: '8906000000022',
      name: 'Plain Roasted Chana (Bengal Gram)',
      brand: 'Desi Harvest',
      expectedStatus: 'NOT_FOUND_IN_AVAILABLE_DATA',
      note: 'Roasted chickpeas (chana), iodised salt. Simple complete declaration.',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
    {
      barcode: '8906000000044',
      name: 'Seasoned Makhana (Pudina & Rock Salt)',
      brand: 'Sattvik Snacks',
      expectedStatus: 'NOT_FOUND_IN_AVAILABLE_DATA',
      note: 'Seasoning has full composition (mint, cumin, rock salt, amchur). No alliums.',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
    {
      barcode: '8906000000033',
      name: 'Seasoned Makhana (Cheese & Herbs)',
      brand: 'SnackBites',
      expectedStatus: 'NEEDS_VERIFICATION',
      note: 'Contains unexplained cheese & herb seasoning without sub-ingredient breakdown.',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    {
      barcode: '8906000000055',
      name: 'Seasoned Makhana (Masala Punch)',
      brand: 'SpiceKing',
      expectedStatus: 'FOUND',
      note: 'Seasoning explicitly declares dehydrated onion & garlic powder.',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    },
    {
      barcode: '8901058852899',
      name: 'Maggi 2-Minute Masala Noodles',
      brand: 'Nestlé',
      expectedStatus: 'FOUND',
      note: 'Dehydrated onion & dried garlic explicitly in tastemaker',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    },
    {
      barcode: '8904004400588',
      name: 'Haldiram\'s Nagpur Bhujia Sev',
      brand: 'Haldiram\'s',
      expectedStatus: 'NOT_FOUND_IN_AVAILABLE_DATA',
      note: 'Moth flour, besan, ginger, spices. No onion/garlic in text',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    },
    {
      barcode: '8901262010044',
      name: 'Amul Butter (Pasteurised)',
      brand: 'Amul',
      expectedStatus: 'NOT_FOUND_IN_AVAILABLE_DATA',
      note: 'Milk fat, moisture, salt, annatto color',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
  ];

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      stopCameraScan();
    };
  }, []);

  // Run analysis whenever product changes
  useEffect(() => {
    if (product && product.ingredientsText) {
      setManualText(product.ingredientsText);
      setIsManualMode(false);
      runAnalysis(product.ingredientsText, product.name, product.brand);
    } else if (product && !product.ingredientsText) {
      setManualText('');
      // Empty ingredients text strictly returns NEEDS_VERIFICATION
      const localResult = inspectJainSuitabilityLocally('', preferences);
      setAnalysis(localResult);
    }
  }, [product, preferences]);

  const runAnalysis = async (text: string, prodName = '', prodBrand = '') => {
    setIsAnalyzing(true);
    try {
      const result = await checkJainSuitability(text, prodName, prodBrand, preferences);
      setAnalysis(result);
    } catch {
      const localFallback = inspectJainSuitabilityLocally(text, preferences);
      setAnalysis(localFallback);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Directly analyze barcode on the Jain page without navigating away
  const handleBarcodeLookup = async (codeToLookup: string) => {
    const clean = codeToLookup.trim();
    if (!clean) return;
    setIsFetchingBarcode(true);
    setBarcodeError(null);
    try {
      const prod = await fetchProductByBarcode(clean);
      setManualText(prod.ingredientsText || '');
      setIsManualMode(false);
      onProductLoaded(prod);
      await runAnalysis(prod.ingredientsText || '', prod.name, prod.brand);
    } catch (err: any) {
      setBarcodeError(err.message || `Product with barcode ${clean} was not found in the database.`);
    } finally {
      setIsFetchingBarcode(false);
    }
  };

  const startCameraScan = () => {
    stopCameraScan();
    setCameraScanningError(null);
    setIsCameraScannerOpen(true);
    setTimeout(async () => {
      try {
        if (!codeReaderRef.current) {
          codeReaderRef.current = new BrowserMultiFormatReader();
        }
        if (!videoRef.current) return;
        const controls = await codeReaderRef.current.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoRef.current,
          (result) => {
            if (result && result.getText()) {
              const detected = result.getText().trim();
              stopCameraScan();
              handleBarcodeLookup(detected);
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
        stopCameraScan();
        setCameraScanningError(err.message || 'Camera permission denied or camera not found.');
      }
    }, 150);
  };

  const stopCameraScan = () => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (e) {
        console.info('Controls stop notice:', e);
      }
      controlsRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
      } catch (e) {
        console.info('StreamRef stop notice:', e);
      }
      streamRef.current = null;
    }
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
      } catch (e) {
        console.info('Stream stop notice:', e);
      }
    }
    setIsCameraScannerOpen(false);
  };

  const handleManualInspect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    setIsManualMode(true);
    runAnalysis(manualText.trim(), 'Custom Label Inspection', 'User Input');
  };

  // Handle direct photo upload & OCR
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrError(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setPhotoPreview(dataUrl);
      setIsExtractingOCR(true);

      try {
        const ocrResult: OCRResult = await analyzePackagePhoto(dataUrl, file.type || 'image/jpeg');
        if (ocrResult.extractedIngredientsText) {
          setManualText(ocrResult.extractedIngredientsText);
          setIsManualMode(true);
          runAnalysis(
            ocrResult.extractedIngredientsText,
            ocrResult.productName || 'Photographed Product',
            ocrResult.brand || 'Photo Capture'
          );
        } else {
          setOcrError(
            'Could not detect readable text automatically. Please type or paste the ingredient list into the box below.'
          );
        }
      } catch (err: any) {
        setOcrError(err.message || 'Failed to process packaging photo.');
      } finally {
        setIsExtractingOCR(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const currentStatus = analysis?.status || 'NEEDS_VERIFICATION';

  // Strict 3-status styling & badges
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'FOUND':
        return {
          title: t.status.found,
          badgeColor: 'bg-rose-600 text-white',
          cardBorder: 'border-rose-300 bg-rose-50/70',
          textColor: 'text-rose-950',
          icon: <XCircle className="w-8 h-8 text-rose-600 shrink-0" />,
          summary:
            language === 'gu'
              ? 'ઉપલબ્ધ ઘટકોમાં ડુંગળી અથવા લસણ સ્પષ્ટપણે નોંધાયેલ છે. આ ઉત્પાદન જૈન આહાર માટે અનુકૂળ નથી.'
              : language === 'hi'
              ? 'उपलब्ध सामग्री में प्याज या लहसुन स्पष्ट रूप से घोषित है। यह उत्पाद जैन आहार के अनुकूल नहीं है।'
              : 'Onion, garlic, or declared allium derivatives are explicitly identified in the available packaging evidence.',
        };
      case 'NOT_FOUND_IN_AVAILABLE_DATA':
        return {
          title: t.status.notFound,
          badgeColor: 'bg-slate-700 text-white',
          cardBorder: 'border-slate-300 bg-slate-50',
          textColor: 'text-slate-900',
          icon: <CheckCircle2 className="w-8 h-8 text-slate-700 shrink-0" />,
          summary:
            language === 'gu'
              ? 'તપાસેલ ઘટકોની યાદીમાં ડુંગળી કે લસણનો સ્પષ્ટ ઉલ્લેખ નથી મળ્યો. (નોંધ: આ ઉપલબ્ધ લખાણમાં ગેરહાજરી દર્શાવે છે, લેબ ટેસ્ટ કે સત્તાવાર જૈન પ્રમાણપત્ર નહીં).'
              : language === 'hi'
              ? 'जांची गई सामग्री सूची में प्याज या लहसुन का स्पष्ट उल्लेख नहीं मिला। (नोट: यह उपलब्ध डेटा में अनुपस्थिति दर्शाता है, प्रयोगशाला परीक्षण या आधिकारिक जैन प्रमाणीकरण नहीं)।'
              : 'No explicit onion or garlic was identified in the inspected ingredient text. (Note: Indicates absence in available text, not a laboratory test or official Jain certification).',
        };
      case 'NEEDS_VERIFICATION':
      default:
        return {
          title: t.status.needsVerification,
          badgeColor: 'bg-amber-500 text-white',
          cardBorder: 'border-amber-300 bg-amber-50/70',
          textColor: 'text-amber-950',
          icon: <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" />,
          summary:
            language === 'gu'
              ? 'માહિતી અસ્પષ્ટ, અધૂરી છે અથવા સંયુક્ત મસાલા ધરાવે છે. પ્રમાણપત્ર વિના આવા મસાલા મિશ્રણમાં ડુંગળી/લસણનો પાવડર હોવાની સંભાવના રહે છે.'
              : language === 'hi'
              ? 'जानकारी अस्पष्ट या अधूरी है, अथवा इसमें मिश्रित मसाले शामिल हैं। प्रमाणित हुए बिना ऐसे मसाला मिश्रणों में प्याज/लहसुन पाउडर होने की संभावना रहती है।'
              : 'Information is incomplete, missing, or contains compound seasoning blends (e.g. tastemaker, curry mix, flavoring) which may conceal unlisted alliums.',
        };
    }
  };

  const statusInfo = getStatusDisplay(currentStatus);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold mb-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Packaging Allium & Compound Seasoning Inspection
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {t.jain.title}
          </h1>
          <p className="text-slate-600 text-sm mt-1 max-w-2xl leading-relaxed">
            {t.jain.subtitle}
          </p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={startCameraScan}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <ScanLine className="w-4 h-4" />
            <span>Scan Barcode</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Camera className="w-4 h-4 text-emerald-600" />
            <span>{t.jain.btnVerifyWithPhoto}</span>
          </button>
        </div>
      </div>

      {/* Hidden file input for OCR photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoUpload}
      />

      {/* In-Page Camera Scanner Modal */}
      {isCameraScannerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Scan Product Barcode</h3>
              </div>
              <button
                onClick={stopCameraScan}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1 rounded-md"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="relative aspect-4/3 bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className="relative w-56 h-36 border-2 border-emerald-400 rounded-2xl overflow-hidden">
                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_#34d399] animate-bounce mt-6"></div>
                  </div>
                </div>
              </div>

              {cameraScanningError && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  {cameraScanningError}
                </div>
              )}

              <p className="text-xs text-center text-slate-500">
                Point your camera at the food packaging barcode. Results will appear right here on the Jain Check page.
              </p>

              <button
                onClick={stopCameraScan}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Cancel Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Strict Non-Certification Transparency Disclaimer */}
      <div className="bg-amber-50/80 border border-amber-300/80 rounded-2xl p-4 text-xs text-amber-950 flex items-start gap-3 shadow-xs">
        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <span className="font-extrabold text-amber-900 block">
            Official Non-Certification & Transparency Policy
          </span>
          <p>
            {t.jain.warningDisclaimer}
          </p>
        </div>
      </div>

      {/* Dedicated In-Page Barcode Product Lookup Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-emerald-600" />
            Barcode Product Analysis
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">
            Search Open Food Facts database directly
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleBarcodeLookup(barcodeInput);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="Enter 8 to 13 digit barcode (e.g. 8901058852899, 8904004400588)..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden text-xs sm:text-sm font-mono bg-slate-50/50"
          />
          <button
            type="submit"
            disabled={isFetchingBarcode || !barcodeInput.trim()}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
          >
            {isFetchingBarcode ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Analyze Barcode</span>
              </>
            )}
          </button>
        </form>

        {barcodeError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{barcodeError}</span>
          </div>
        )}
      </div>

      {/* Current Product Summary Card (if loaded) */}
      {product ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-16 h-16 object-contain rounded-2xl bg-slate-50 border border-slate-200 p-1 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center shrink-0">
                LL
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
                  {product.name}
                </h3>
                {product.isSample && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-blue-50 text-blue-700 border border-blue-200">
                    Sample Record
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Brand: <span className="font-semibold text-slate-800">{product.brand}</span> • Barcode:{' '}
                <span className="font-mono text-emerald-700 font-bold">{product.barcode}</span> • Source:{' '}
                <span className="text-slate-600">{product.dataSource}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verify with Label Photo</span>
            </button>
          </div>
        </div>
      ) : (
        /* Empty State with Demonstration Products */
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h3 className="text-xl font-extrabold text-slate-900">
              No Product Currently Selected
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Scan a packaged food barcode, enter an EAN/UPC number, upload a photo of the ingredient panel, or pick a verified demonstration product below.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {demoSamples.map((sample) => (
              <div
                key={sample.barcode}
                onClick={() => handleBarcodeLookup(sample.barcode)}
                className="p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-500">{sample.brand}</span>
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] ${sample.badgeClass}`}>
                      {sample.expectedStatus === 'FOUND' ? 'FOUND' : 'NOT FOUND'}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs group-hover:text-emerald-700 transition-colors line-clamp-1">
                    {sample.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {sample.note}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] font-bold text-emerald-700">
                  <span className="font-mono text-slate-400">{sample.barcode}</span>
                  <span className="flex items-center gap-1">
                    Check <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OCR In-Flight Banner */}
      {isExtractingOCR && (
        <div className="p-6 text-center space-y-2 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="w-7 h-7 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold text-emerald-950">Extracting Label Text via Vision OCR...</p>
          <p className="text-xs text-emerald-700">Reading declared ingredients from the uploaded packaging photo</p>
        </div>
      )}

      {/* OCR Error if any */}
      {ocrError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{ocrError}</span>
        </div>
      )}

      {/* Main 3-Status Verdict Display Card */}
      {analysis && (
        <div className={`rounded-3xl border-2 p-6 sm:p-8 shadow-md transition-all ${statusInfo.cardBorder}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-6">
            <div className="flex items-start sm:items-center gap-4">
              {statusInfo.icon}
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t.jain.statusTitle}
                </span>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className={`px-3 py-1 rounded-lg text-sm font-extrabold tracking-wide uppercase ${statusInfo.badgeColor}`}>
                    {statusInfo.title}
                  </span>
                  {analysis.onionDetected && (
                    <span className="px-2.5 py-0.5 rounded-md bg-rose-200 text-rose-900 text-xs font-bold">
                      Onion Declared
                    </span>
                  )}
                  {analysis.garlicDetected && (
                    <span className="px-2.5 py-0.5 rounded-md bg-rose-200 text-rose-900 text-xs font-bold">
                      Garlic Declared
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-xs sm:text-right text-slate-500">
              <span className="font-semibold block text-slate-700">Inspection Standard:</span>
              <span>Explicit Packaging Declaration</span>
            </div>
          </div>

          <div className="pt-5 space-y-4">
            <p className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed">
              {statusInfo.summary}
            </p>

            {/* Requirement 6: Display the exact reason for NEEDS VERIFICATION */}
            {analysis.status === 'NEEDS_VERIFICATION' && analysis.needsVerificationReason && (
              <div className="p-4 rounded-2xl bg-amber-100/90 border border-amber-300 text-xs space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-1.5 font-extrabold text-amber-950 uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Exact Reason for Verification</span>
                </div>
                <p className="text-amber-900 font-semibold leading-relaxed">
                  {analysis.needsVerificationReason}
                </p>
              </div>
            )}

            {/* Plain food complete declaration confirmation for NOT FOUND IN AVAILABLE DATA */}
            {analysis.status === 'NOT_FOUND_IN_AVAILABLE_DATA' && (
              <div className="p-3.5 rounded-2xl bg-slate-100/80 border border-slate-200 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-slate-700 font-medium leading-relaxed">
                  <strong className="text-slate-900">Complete Ingredient List Analyzed:</strong> All declared ingredients and compound breakdowns were evaluated. No onion, garlic, or unexplained seasonings detected.
                </span>
              </div>
            )}

            {/* Localized detailed explanation */}
            <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 text-xs space-y-1">
              <span className="font-bold text-slate-700 uppercase tracking-wider block">
                {t.jain.recommendation}
              </span>
              <p className="text-slate-800 leading-relaxed font-medium">
                {language === 'gu'
                  ? analysis.explanationGu
                  : language === 'hi'
                  ? analysis.explanationHi
                  : analysis.explanationEn}
              </p>
            </div>

            {/* Requirement 7: Explicit disclaimer never to claim certification */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-slate-600">Dietary Verification Notice:</strong> {analysis.disclaimer}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Exact Ingredient Evidence Section */}
      {analysis && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                {t.jain.evidenceTitle}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.jain.evidenceDesc}
              </p>
            </div>

            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
              {analysis.evidence && analysis.evidence.length > 0
                ? `${analysis.evidence.length} Evidence Matches`
                : 'No Matches'}
            </span>
          </div>

          {analysis.evidence && analysis.evidence.length > 0 ? (
            <div className="space-y-3">
              {analysis.evidence.map((item, idx) => {
                const isAllium = item.category === 'onion' || item.category === 'garlic';
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      isAllium
                        ? 'bg-rose-50/60 border-rose-200'
                        : 'bg-amber-50/60 border-amber-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase ${
                            isAllium
                              ? 'bg-rose-600 text-white'
                              : 'bg-amber-500 text-white'
                          }`}
                        >
                          {item.category === 'onion'
                            ? 'Onion Detected'
                            : item.category === 'garlic'
                            ? 'Garlic Detected'
                            : 'Compound Seasoning'}
                        </span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          "{item.term}"
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {item.description}
                      </span>
                    </div>

                    {item.contextSnippet && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                          Declared Label Context:
                        </span>
                        <p className="font-mono text-slate-800 bg-white/80 p-2 rounded-lg border border-slate-200/60">
                          {item.contextSnippet}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
              <p className="font-bold text-slate-800">{t.jain.noEvidenceFound}</p>
              <p className="text-slate-500">
                The inspected ingredient text contains no declared instances of onion, garlic, or known compound spice blends.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Compound Ingredients and Seasonings Review Box */}
      {analysis && analysis.ambiguousIngredients && analysis.ambiguousIngredients.length > 0 && (
        <div className="bg-amber-50/60 rounded-3xl border border-amber-200 p-6 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-extrabold text-amber-950 text-base">
                {t.jain.compoundSeasonings}
              </h4>
              <p className="text-xs text-amber-900/90 leading-relaxed">
                {t.jain.compoundDesc}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {analysis.ambiguousIngredients.map((term, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-900 font-mono text-xs font-bold"
              >
                {term}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Manual Ingredient Text Inspector & OCR Photo Upload Area */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-emerald-600" />
              {t.jain.manualCheckTitle}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Paste or type any ingredient declaration, or upload a packaging photo to review and analyze.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-600" />
            <span>Upload Label Photo</span>
          </button>
        </div>

        {/* Photo preview thumbnail if uploaded */}
        {photoPreview && (
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-4">
            <img
              src={photoPreview}
              alt="Uploaded packaging label"
              className="w-16 h-16 object-contain rounded-xl bg-white border shrink-0"
            />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-slate-800 block">Uploaded Label Photograph</span>
              <p className="text-[11px] text-slate-500">Extracted ingredient text is loaded into the editor below for your review.</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-bold text-emerald-700 hover:underline shrink-0"
            >
              Replace Photo
            </button>
          </div>
        )}

        {/* Interactive Textarea Form */}
        <form onSubmit={handleManualInspect} className="space-y-4">
          <textarea
            rows={4}
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder={t.jain.manualCheckPlaceholder}
            className="w-full p-4 text-xs font-mono rounded-2xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden leading-relaxed bg-slate-50/50"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400">
              Checks onion, garlic, dried powders, leeks, shallots, tastemakers, and compound spices.
            </span>

            <button
              type="submit"
              disabled={isAnalyzing || !manualText.trim()}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Inspecting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t.jain.btnInspectText}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
