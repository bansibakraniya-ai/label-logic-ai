import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowRight,
  Info,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import { Language, OCRResult, Product } from '../types';
import { translations } from '../translations';
import { analyzePackagePhoto } from '../services/api';

interface PackagePhotoOCRViewProps {
  language: Language;
  initialBarcode?: string;
  onIngredientsExtracted: (customProduct: Product) => void;
}

export const PackagePhotoOCRView: React.FC<PackagePhotoOCRViewProps> = ({
  language,
  initialBarcode = '',
  onIngredientsExtracted,
}) => {
  const t = translations[language];

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);

  // Editable fields by the user
  const [productName, setProductName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [editableIngredients, setEditableIngredients] = useState('');
  const [packageWeight, setPackageWeight] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrError(null);
    setOcrResult(null);
    setMimeType(file.type || 'image/jpeg');

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImagePreview(dataUrl);
      triggerOCR(dataUrl, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const triggerOCR = async (base64: string, mime: string) => {
    setIsAnalyzing(true);
    setOcrError(null);

    try {
      const result = await analyzePackagePhoto(base64, mime);
      setOcrResult(result);

      // Populate editable fields
      if (result.productName) setProductName(result.productName);
      if (result.brand) setBrandName(result.brand);
      if (result.extractedIngredientsText) setEditableIngredients(result.extractedIngredientsText);
      if (result.netQuantity) setPackageWeight(result.netQuantity);
    } catch (err: any) {
      setOcrError(err.message || 'Failed to extract text from packaging image.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleProceedToDecode = () => {
    if (!editableIngredients.trim()) return;

    // Build custom product synthesized from user's verified package photo
    const customProduct: Product = {
      barcode: initialBarcode || `CUSTOM-PHOTO-${Date.now().toString().slice(-6)}`,
      scannedBarcode: initialBarcode || 'Package Photo OCR',
      barcodeMatches: true,
      name: productName.trim() || 'Custom Photographed Product',
      brand: brandName.trim() || 'Label Photo Capture',
      categories: ['Custom Package Capture'],
      imageUrl: imagePreview,
      ingredientsText: editableIngredients.trim(),
      nutrition: {
        calories: { per100g: null, perServing: null, unit: 'kcal' },
        proteins: { per100g: null, perServing: null, unit: 'g' },
        carbohydrates: { per100g: null, perServing: null, unit: 'g' },
        sugars: { per100g: null, perServing: null, unit: 'g' },
        addedSugars: { per100g: null, perServing: null, unit: 'g' },
        fat: { per100g: null, perServing: null, unit: 'g' },
        saturatedFat: { per100g: null, perServing: null, unit: 'g' },
        transFat: { per100g: null, perServing: null, unit: 'g' },
        fiber: { per100g: null, perServing: null, unit: 'g' },
        sodium: { per100g: null, perServing: null, unit: 'g' },
        salt: { per100g: null, perServing: null, unit: 'g' },
      },
      quantityString: packageWeight.trim() || null,
      netWeightGrams: packageWeight ? parseFloat(packageWeight) || null : null,
      servingSize: null,
      allergens: ocrResult?.allergensDeclared || [],
      traces: [],
      additives: [],
      labels: [],
      origin: null,
      manufacturingPlaces: null,
      dataSource: 'Package Photograph OCR (Gemini 3.8 Flash Vision)',
      retrievalTime: new Date().toISOString(),
      missingFields: ['nutrition_calories', 'nutrition_fat', 'nutrition_protein'],
    };

    onIngredientsExtracted(customProduct);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Title Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold mb-1">
          <Camera className="w-3.5 h-3.5 text-emerald-600" />
          Vision OCR & Label Reconstruction
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {t.ocr.title}
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          {t.ocr.subtitle}
        </p>
      </div>

      {/* Upload Zone */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-3xl p-8 sm:p-12 text-center bg-emerald-50/30 hover:bg-emerald-50/60 transition-all cursor-pointer space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
            <Upload className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="font-extrabold text-lg text-slate-900">
              {t.ocr.dropzoneTitle}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {t.ocr.dropzoneDesc}
            </p>
          </div>

          <button
            type="button"
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors inline-flex items-center gap-2"
          >
            <Camera className="w-4 h-4" />
            {t.ocr.chooseFile}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Uploaded Image Preview & OCR Status */}
        {imagePreview && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
            <div className="md:col-span-1 space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Captured Packaging Photo
              </span>
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 max-h-64 flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="Packaging capture"
                  className="w-full h-full object-contain"
                />
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition-colors"
              >
                Upload Different Photo
              </button>
            </div>

            {/* OCR Progress or Result Section */}
            <div className="md:col-span-2 space-y-4">
              {isAnalyzing ? (
                <div className="p-8 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-sm font-bold text-slate-800">
                    {t.ocr.extracting}
                  </p>
                  <p className="text-xs text-slate-500">
                    Identifying words, checking for obscured or blurred ingredients...
                  </p>
                </div>
              ) : ocrResult ? (
                <div className="space-y-4">
                  {/* Manual entry / quota cooldown guidance banner */}
                  {ocrResult.isManualEntry && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-1 shadow-xs">
                      <div className="flex items-center gap-2 font-bold text-emerald-900">
                        <Edit3 className="w-4 h-4 text-emerald-600 shrink-0" />
                        Packaging Photo Preserved — Label Transcription Workspace
                      </div>
                      <p className="text-emerald-800 leading-relaxed">
                        {ocrResult.clarityExplanation || 'Review your captured photo on the left. Enter the product name, brand, and ingredient list into the boxes below to run deep Jain analysis and multi-language decoding.'}
                      </p>
                    </div>
                  )}

                  {/* Warning if photo needs clearer capture */}
                  {ocrResult.needsClearerPhoto && (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
                      <div className="flex items-center gap-2 font-bold text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        Partially Obscured / Blurry Text Detected
                      </div>
                      <p>{ocrResult.clarityExplanation || t.ocr.needsClearerWarning}</p>
                    </div>
                  )}

                  {/* List of unreadable words flagged */}
                  {ocrResult.unreadableWords && ocrResult.unreadableWords.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-1">
                      <span className="font-bold text-rose-800">
                        {t.ocr.unreadableWordsFound}
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {ocrResult.unreadableWords.map((w, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-rose-200 text-rose-900 font-mono text-[11px]"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Editable Product Name and Brand */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Product Name (From Label)
                      </label>
                      <input
                        type="text"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="e.g. Masala Roasted Makhana"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-emerald-500 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Brand / Manufacturer
                      </label>
                      <input
                        type="text"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="e.g. Farm Fresh"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-emerald-500 outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Editable Extracted Ingredients Text Box */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                        {t.ocr.extractedTitle}
                      </label>
                      <span className="text-[11px] text-slate-400">
                        Edit any typos directly
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={editableIngredients}
                      onChange={(e) => setEditableIngredients(e.target.value)}
                      placeholder="Ingredients extracted from photo will appear here..."
                      className="w-full p-3 text-xs font-mono rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden leading-relaxed"
                    />
                  </div>

                  {/* Decode Action Button */}
                  <button
                    onClick={handleProceedToDecode}
                    disabled={!editableIngredients.trim()}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    {t.ocr.decodeNowBtn}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : null}

              {ocrError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{ocrError}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reliability & Policy Guidelines */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Label Logic AI strictly preserves extracted label wording without guessing obscured words.
          If part of the text is cut off or blurry, please retake the photo with flat lighting to ensure 100% compliance fidelity.
        </p>
      </div>
    </div>
  );
};
