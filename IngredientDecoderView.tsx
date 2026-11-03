import React, { useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  Info,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  Tag,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import { Language, Product, DecodedIngredient } from '../types';
import { translations } from '../translations';

interface IngredientDecoderViewProps {
  language: Language;
  product: Product | null;
  decodedIngredients: DecodedIngredient[];
  isLoading: boolean;
  onNavigateToScan: () => void;
  onNavigateToOCR: () => void;
  onSelectBarcode?: (barcode: string) => void;
}

export const IngredientDecoderView: React.FC<IngredientDecoderViewProps> = ({
  language,
  product,
  decodedIngredients,
  isLoading,
  onNavigateToScan,
  onNavigateToOCR,
  onSelectBarcode,
}) => {
  const t = translations[language];

  const [barcodeInput, setBarcodeInput] = useState('');

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Extract categories present in decoded ingredients
  const availableCategories = Array.from(
    new Set(decodedIngredients.map((ing) => ing.category.toLowerCase()))
  ).filter(Boolean);

  const filteredIngredients = decodedIngredients.filter((ing) => {
    const matchesCat =
      selectedCategory === 'all' ||
      ing.category.toLowerCase() === selectedCategory.toLowerCase();
    const query = filterQuery.toLowerCase();
    const matchesQuery =
      !query ||
      ing.originalName.toLowerCase().includes(query) ||
      ing.standardizedName.toLowerCase().includes(query) ||
      ing.englishExplanation.toLowerCase().includes(query) ||
      ing.gujaratiTranslation.toLowerCase().includes(query) ||
      ing.hindiTranslation.toLowerCase().includes(query);
    return matchesCat && matchesQuery;
  });

  const getCategoryBadgeColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'additive':
      case 'preservative':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'emulsifier':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'spice':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'grain':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'oil':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'sweetener':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'flavouring':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'dairy':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  if (!product) {
    const demoItems = [
      { code: '8901058852899', name: 'Maggi Masala Noodles' },
      { code: '8904004400588', name: 'Haldiram\'s Bhujia Sev' },
      { code: '8901491101837', name: 'Parle-G Gluco Biscuits' },
      { code: '8901262010044', name: 'Amul Butter' },
    ];

    return (
      <div className="max-w-2xl mx-auto text-center py-12 px-4 space-y-8">
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-sm">
          <BookOpen className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">
            {t.decoder.title}
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {t.decoder.noIngredients} Enter a barcode or select a demonstration product below to decode its ingredients list.
          </p>
        </div>

        {/* Direct In-Page Barcode Input */}
        {onSelectBarcode && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (barcodeInput.trim()) {
                onSelectBarcode(barcodeInput.trim());
              }
            }}
            className="flex gap-2 max-w-md mx-auto"
          >
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Enter barcode (e.g. 8901058852899)..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-hidden text-xs font-mono bg-white shadow-xs"
            />
            <button
              type="submit"
              disabled={!barcodeInput.trim()}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0"
            >
              Decode
            </button>
          </form>
        )}

        {/* Quick Demo Product Buttons */}
        {onSelectBarcode && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Or Try A Sample Product
            </span>
            <div className="flex flex-wrap justify-center gap-2">
              {demoItems.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => onSelectBarcode(item.code)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-slate-700 font-semibold text-xs transition-all cursor-pointer shadow-2xs"
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-slate-200">
          <button
            onClick={onNavigateToScan}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            {t.hero.btnScan}
          </button>
          <button
            onClick={onNavigateToOCR}
            className="px-5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
          >
            {t.hero.btnUploadPhoto}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* View Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {t.decoder.title}
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          {t.decoder.subtitle}
        </p>
      </div>

      {/* Scientific Neutrality Notice (Prompt requirement: Avoid unsupported health claims) */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 flex items-start gap-2.5 shadow-xs">
        <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="font-bold text-slate-800">
            {t.decoder.scientificNeutrality}
          </span>{' '}
          Each ingredient's description explains its technical culinary role (e.g. emulsifier, preservative, leavening agent) without marketing jargon or therapeutic health claims.
        </p>
      </div>

      {/* Product Summary Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-14 h-14 object-contain rounded-2xl bg-slate-50 border border-slate-200 p-1"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center">
              LL
            </div>
          )}
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
              {product.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Brand: <span className="font-semibold text-slate-800">{product.brand}</span> • Total Ingredients:{' '}
              <span className="font-bold text-emerald-700">{decodedIngredients.length}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {product.missingFields.length > 0 && (
            <button
              onClick={onNavigateToOCR}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Verify via Photo OCR</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and Category Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search ingredient by English, Gujarati, or Hindi name..."
            className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-slate-300 focus:border-emerald-500 outline-hidden bg-white shadow-xs"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.decoder.allCategories} ({decodedIngredients.length})
          </button>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Ingredients List Cards */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold text-slate-800">
            Decoding Packaged Food Ingredients...
          </p>
          <p className="text-xs text-slate-500">
            Analyzing chemical additives, preservatives, emulsifiers, and standardized culinary functions
          </p>
        </div>
      ) : filteredIngredients.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-2">
          <p className="text-sm font-bold text-slate-700">No ingredients match your search query.</p>
          <button
            onClick={() => {
              setFilterQuery('');
              setSelectedCategory('all');
            }}
            className="text-xs text-emerald-600 font-bold hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIngredients.map((item, index) => {
            const isExpanded = expandedIndex === index;
            const explanationText =
              language === 'gu'
                ? item.gujaratiTranslation || item.englishExplanation
                : language === 'hi'
                ? item.hindiTranslation || item.englishExplanation
                : item.englishExplanation;

            return (
              <div
                key={index}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all overflow-hidden"
              >
                {/* Main Card Header */}
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  className="p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                      {index + 1}
                    </span>

                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-extrabold text-base text-slate-900">
                          {item.standardizedName || item.originalName}
                        </h4>
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getCategoryBadgeColor(
                            item.category
                          )}`}
                        >
                          {item.category}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500">
                        Declared as: <span className="font-mono text-slate-700 font-medium">"{item.originalName}"</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-emerald-700 font-bold hidden md:inline">
                      {item.purpose}
                    </span>
                    <button
                      type="button"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Plain-Language Explanation Body */}
                <div className="px-5 pb-4 pt-1 border-t border-slate-100 bg-slate-50/50 space-y-3">
                  {/* Active Language Explanation */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <span>{t.decoder.whatItIs}</span>
                      <span className="text-emerald-700 lowercase font-medium">
                        Objective culinary definition
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 font-medium leading-relaxed">
                      {explanationText}
                    </p>
                  </div>

                  {/* General Purpose in Food */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 text-xs">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase block">
                        {t.decoder.foodPurpose}
                      </span>
                      <span className="font-bold text-slate-900 mt-0.5 block">
                        {item.purpose || 'Standard recipe component'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase block">
                        {t.decoder.standardized}
                      </span>
                      <span className="font-mono text-slate-800 mt-0.5 block">
                        {item.standardizedName || item.originalName}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
