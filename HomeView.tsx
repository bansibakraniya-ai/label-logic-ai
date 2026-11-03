import React, { useState } from 'react';
import {
  ScanLine,
  Camera,
  Search,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Flame,
  Leaf,
  Layers,
  BarChart3,
  FileText,
} from 'lucide-react';
import { Language, Product } from '../types';
import { translations } from '../translations';
import { searchProducts } from '../services/api';

interface HomeViewProps {
  language: Language;
  onNavigate: (view: string) => void;
  onSelectProduct: (productOrBarcode: string) => void;
  onSelectProductObj?: (product: Product) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  language,
  onNavigate,
  onSelectProduct,
}) => {
  const t = translations[language];
  const [searchQuery, setSearchQuery] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Check if user entered numeric barcode in search query
    if (/^\d{4,18}$/.test(searchQuery.trim())) {
      onSelectProduct(searchQuery.trim());
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchProducts(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No matching products found. Try a different brand, item name, or enter barcode.');
      }
    } catch (err: any) {
      setSearchError('Failed to search database. Please check connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      onSelectProduct(manualBarcode.trim());
    }
  };

  const demoProducts = [
    {
      barcode: '8901058852899',
      name: 'Maggi 2-Minute Noodles (Masala)',
      brand: 'Nestlé',
      category: 'Instant Noodles',
      badge: 'Onion & Garlic FOUND',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
      description: 'Contains dehydrated onion & dried garlic explicitly in masala tastemaker.',
      img: 'https://images.openfoodfacts.org/images/products/890/105/885/2899/front_en.11.400.jpg',
    },
    {
      barcode: '8904004400588',
      name: 'Haldiram\'s Nagpur Bhujia Sev',
      brand: 'Haldiram\'s',
      category: 'Indian Savory Snack',
      badge: 'No Onion / Garlic Declared',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      description: 'Moth bean flour, besan, black pepper, ginger, cloves. No onion or garlic in text.',
      img: 'https://images.openfoodfacts.org/images/products/890/400/440/0588/front_en.10.400.jpg',
    },
    {
      barcode: '8901491101837',
      name: 'Parle-G Gluco Biscuits',
      brand: 'Parle',
      category: 'Biscuits',
      badge: 'Additive Analysis',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      description: 'Contains Raising agents 503(ii), 500(ii), Emulsifier 322(i)/471, Dough conditioner 223.',
      img: 'https://images.openfoodfacts.org/images/products/890/149/110/1837/front_en.15.400.jpg',
    },
    {
      barcode: '8901262010044',
      name: 'Amul Butter (Pasteurised)',
      brand: 'Amul',
      category: 'Dairy Products',
      badge: 'Pure Dairy & Salt',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      description: 'Milk fat 80%, Moisture 16%, Common Salt, Natural colour Annatto (E160b).',
      img: 'https://images.openfoodfacts.org/images/products/890/126/201/0044/front_en.9.400.jpg',
    },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-emerald-900 via-emerald-800 to-slate-900 text-white p-8 sm:p-12 lg:p-16 shadow-xl">
        {/* Background decorative patterns */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold tracking-wide">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            {t.hero.badge}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            {t.hero.title}
          </h1>

          <p className="text-emerald-100/90 text-base sm:text-lg max-w-2xl leading-relaxed">
            {t.hero.subtitle}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap gap-3.5 pt-2">
            <button
              onClick={() => onNavigate('scan')}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm sm:text-base shadow-lg shadow-emerald-600/30 hover:shadow-emerald-500/40 transition-all cursor-pointer"
            >
              <ScanLine className="w-5 h-5 text-slate-950" />
              {t.hero.btnScan}
            </button>

            <button
              onClick={() => onNavigate('ocr')}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm sm:text-base border border-white/20 backdrop-blur-sm transition-all cursor-pointer"
            >
              <Camera className="w-5 h-5 text-emerald-300" />
              {t.hero.btnUploadPhoto}
            </button>
          </div>
        </div>

        {/* Search & Manual Barcode Lookups Card */}
        <div className="relative mt-10 pt-8 border-t border-emerald-700/60 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Search by Name */}
            <form onSubmit={handleSearch} className="space-y-2">
              <label className="text-xs font-semibold text-emerald-200">
                Search Database by Food Name or Brand
              </label>
              <div className="flex rounded-xl bg-white/10 border border-emerald-600/50 p-1 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-400/20 transition-all">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.hero.searchPlaceholder}
                  className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-emerald-200/50 outline-hidden"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Search className="w-3.5 h-3.5" />
                  {isSearching ? t.hero.searching : t.hero.lookupBtn}
                </button>
              </div>
            </form>

            {/* Manual Barcode Input */}
            <form onSubmit={handleBarcodeSubmit} className="space-y-2">
              <label className="text-xs font-semibold text-emerald-200">
                Or Direct Barcode Lookup (EAN / UPC)
              </label>
              <div className="flex rounded-xl bg-white/10 border border-emerald-600/50 p-1 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-400/20 transition-all">
                <input
                  type="text"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder={t.hero.manualBarcodePlaceholder}
                  className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-emerald-200/50 outline-hidden font-mono"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  {t.hero.lookupBtn}
                </button>
              </div>
            </form>

          </div>

          {/* Search Results Dropdown/List */}
          {searchResults.length > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-white text-slate-900 shadow-2xl space-y-2 max-h-72 overflow-y-auto">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 border-b pb-2">
                <span>Search Results ({searchResults.length})</span>
                <button
                  onClick={() => setSearchResults([])}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕ Close
                </button>
              </div>
              {searchResults.map((item) => (
                <div
                  key={item.barcode}
                  onClick={() => {
                    onSelectProduct(item.barcode);
                    setSearchResults([]);
                  }}
                  className="p-2.5 rounded-lg hover:bg-emerald-50 cursor-pointer flex items-center gap-3 transition-colors border border-transparent hover:border-emerald-200"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-10 h-10 object-contain rounded-md bg-white border shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-400 text-xs shrink-0">
                      Food
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.brand} • <span className="font-mono text-emerald-700">{item.barcode}</span>
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
          )}

          {searchError && (
            <div className="mt-3 p-3 rounded-lg bg-rose-900/60 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{searchError}</span>
            </div>
          )}
        </div>
      </section>

      {/* Demonstration / Acceptance Criteria Test Cases Shelf */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-600" />
              Instant Demonstration Barcodes
            </h2>
            <p className="text-sm text-slate-600">
              One-click live test cases verifying onion/garlic detection, complex additives, pure dairy, and ingredient breakdowns.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
            Real Open Food Facts Records
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {demoProducts.map((p) => (
            <div
              key={p.barcode}
              onClick={() => onSelectProduct(p.barcode)}
              className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-16 h-16 rounded-xl bg-slate-50 p-1 border border-slate-100 flex items-center justify-center shrink-0">
                    <img
                      src={p.img}
                      alt={p.name}
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${p.badgeColor}`}>
                    {p.badge}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors line-clamp-1">
                    {p.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">{p.brand} • {p.category}</p>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {p.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                <span className="font-mono text-slate-400 text-[11px]">{p.barcode}</span>
                <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Analyze <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Core Packaging Intelligence Capabilities */}
      <section className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Packaging Transparency Tools
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Essential Food Intelligence
            </h2>
            <p className="text-sm text-slate-600">
              Reliable packaged food inspection powered by verified database records and optical recognition.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Scanner */}
          <div
            onClick={() => onNavigate('scan')}
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer space-y-3 group"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
                Barcode Scanner
              </h3>
              <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                Live camera scanner supporting EAN-13, EAN-8, UPC-A, and UPC-E codes with instant database lookup.
              </p>
            </div>
          </div>

          {/* Jain Ingredient Check */}
          <div
            onClick={() => onNavigate('jain')}
            className="p-5 rounded-2xl bg-white border border-emerald-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer space-y-3 group ring-1 ring-emerald-500/10"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
                  Jain Check
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-emerald-100 text-emerald-800">
                  Strict 3-Tier
                </span>
              </div>
              <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                Inspects declared ingredients for onion, garlic, compound seasonings, and non-Jain derivatives.
              </p>
            </div>
          </div>

          {/* Ingredient Decoder */}
          <div
            onClick={() => onNavigate('decoder')}
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer space-y-3 group"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
                Ingredient Decoder
              </h3>
              <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                Translates chemical additives, preservatives, emulsifiers, and numbered codes into plain language.
              </p>
            </div>
          </div>

          {/* Nutrition Dashboard */}
          <div
            onClick={() => onNavigate('nutrition')}
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer space-y-3 group"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
                Nutrition Dashboard
              </h3>
              <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                Precise nutrient breakdown per 100g, per serving, and whole-package calculations with chemical distinction.
              </p>
            </div>
          </div>

          {/* Vision OCR */}
          <div
            onClick={() => onNavigate('ocr')}
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer space-y-3 group"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
                Photo Scanner (OCR)
              </h3>
              <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                Photograph any physical packaging label or ingredient panel to extract and analyze text instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Unknown Barcode Rescue Flow Banner */}
      <section className="p-6 sm:p-8 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
            Fallback Rescue Architecture
          </span>
          <h3 className="text-xl font-extrabold text-slate-900">
            Unlisted Barcode or Missing Packaging Info?
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Our app never fails at an unlisted barcode. Upload a photo of the ingredient panel or nutrition table to extract visible text with AI OCR. Review extracted words before analysis.
          </p>
        </div>
        <button
          onClick={() => onNavigate('ocr')}
          className="px-5 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Camera className="w-4 h-4" />
          {t.hero.btnUploadPhoto}
        </button>
      </section>
    </div>
  );
};
