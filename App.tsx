import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomeView } from './views/HomeView';
import { ScanBarcodeView } from './views/ScanBarcodeView';
import { IngredientDecoderView } from './views/IngredientDecoderView';
import { NutritionDashboardView } from './views/NutritionDashboardView';
import { ScanHistoryView } from './views/ScanHistoryView';
import { SettingsView } from './views/SettingsView';
import { PackagePhotoOCRView } from './views/PackagePhotoOCRView';
import { JainIngredientCheckView } from './views/JainIngredientCheckView';
import {
  Language,
  Product,
  DecodedIngredient,
  JainAnalysis,
  ScanHistoryItem,
  UserPreferences,
} from './types';
import { fetchProductByBarcode, decodeIngredients, saveRemoteHistory, clearRemoteHistory } from './services/api';
import { parseIngredientsLocally, inspectJainSuitabilityLocally } from './utils/jainRules';
import { AlertCircle, AlertTriangle } from 'lucide-react';

const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'en',
  avoidOnion: true,
  avoidGarlic: true,
  avoidRootVegetables: false,
  avoidGelatin: true,
  avoidAnimalRennet: true,
  avoidAlcohol: true,
  customAvoidedIngredients: [],
  flaggedAllergens: ['Gluten / Wheat', 'Peanuts', 'Milk / Dairy'],
};

// Valid application views
const VALID_VIEWS = ['home', 'scan', 'jain', 'decoder', 'nutrition', 'history', 'settings', 'ocr'] as const;
type AppView = (typeof VALID_VIEWS)[number];

// Helper to extract valid view from current URL or storage
function getViewFromUrl(): AppView {
  if (typeof window === 'undefined') return 'home';

  // 1. Pathname check
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (path === '' || path === 'home') return 'home';
  if ((VALID_VIEWS as readonly string[]).includes(path)) {
    return path as AppView;
  }

  // 2. Hash check
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (hash === '' || hash === 'home') return 'home';
  if ((VALID_VIEWS as readonly string[]).includes(hash)) {
    return hash as AppView;
  }

  // 3. SessionStorage fallback to preserve state across reloads/re-renders
  try {
    const saved = sessionStorage.getItem('label_logic_current_view');
    if (saved && (VALID_VIEWS as readonly string[]).includes(saved)) {
      return saved as AppView;
    }
  } catch {}

  return 'home';
}

export default function App() {
  // Navigation & View state initialized from URL or session
  const [currentView, setCurrentView] = useState<AppView>(() => getViewFromUrl());
  const currentViewRef = React.useRef<AppView>(currentView);
  const [rescueBarcode, setRescueBarcode] = useState<string>('');

  // Keep ref synchronized with state
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  // Safe navigation function that synchronizes URL, history, and session storage
  const navigateTo = React.useCallback((targetView: string, replace = false) => {
    const view: AppView = (VALID_VIEWS as readonly string[]).includes(targetView)
      ? (targetView as AppView)
      : 'home';

    setCurrentView(view);
    currentViewRef.current = view;

    try {
      sessionStorage.setItem('label_logic_current_view', view);
    } catch {}

    const path = view === 'home' ? '/' : `/${view}`;
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      if (replace) {
        window.history.replaceState({ view }, '', path);
      } else {
        window.history.pushState({ view }, '', path);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Listen for browser Back and Forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const stateView = event.state?.view;
      if (stateView && (VALID_VIEWS as readonly string[]).includes(stateView)) {
        setCurrentView(stateView as AppView);
        currentViewRef.current = stateView as AppView;
        try {
          sessionStorage.setItem('label_logic_current_view', stateView);
        } catch {}
        return;
      }
      const urlView = getViewFromUrl();
      setCurrentView(urlView);
      currentViewRef.current = urlView;
      try {
        sessionStorage.setItem('label_logic_current_view', urlView);
      } catch {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // User preferences & Language
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const saved = localStorage.getItem('label_logic_prefs');
      return saved ? JSON.parse(saved) : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });

  const language: Language = preferences.language || 'en';

  // Product & Analysis State
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [decodedIngredients, setDecodedIngredients] = useState<DecodedIngredient[]>([]);
  const [jainAnalysis, setJainAnalysis] = useState<JainAnalysis | null>(null);
  const [isDecoding, setIsDecoding] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Scan History
  const [history, setHistory] = useState<ScanHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('label_logic_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save history to local storage
  useEffect(() => {
    try {
      localStorage.setItem('label_logic_history', JSON.stringify(history));
    } catch (err) {
      console.warn('Could not save history to localStorage:', err);
    }
  }, [history]);

  // Save preferences to local storage
  const handleSavePreferences = (newPrefs: UserPreferences) => {
    setPreferences(newPrefs);
    try {
      localStorage.setItem('label_logic_prefs', JSON.stringify(newPrefs));
    } catch (err) {
      console.warn('Could not save preferences to localStorage:', err);
    }
  };

  const handleLanguageChange = (newLang: Language) => {
    const updated = { ...preferences, language: newLang };
    handleSavePreferences(updated);
  };

  // Called whenever a product is fetched or created via OCR.
  // Preserves active page and never automatically redirects away unless explicitly intended
  const handleProductLoaded = async (product: Product, destinationView?: string) => {
    setActiveProduct(product);
    setGlobalError(null);
    setIsDecoding(true);

    const viewAtInvocation = currentViewRef.current;

    // Only navigate to destinationView if explicitly provided AND user hasn't already switched to another page
    if (destinationView) {
      if (currentViewRef.current === viewAtInvocation) {
        navigateTo(destinationView);
      }
    }

    try {
      // Trigger background / real-time AI ingredient decoding & Jain analysis
      const decodeResult = await decodeIngredients(
        product.ingredientsText,
        product.name,
        product.brand,
        preferences
      );

      setDecodedIngredients(decodeResult.decodedIngredients || []);
      setJainAnalysis(decodeResult.jainAnalysis || null);

      // Add to Scan History
      const historyEntry: ScanHistoryItem = {
        id: `${product.barcode}-${Date.now()}`,
        barcode: product.barcode,
        name: product.name,
        brand: product.brand,
        imageUrl: product.imageUrl,
        scannedAt: new Date().toISOString(),
        jainStatus: decodeResult.jainAnalysis?.status || 'NOT_FOUND_IN_AVAILABLE_DATA',
        isSample: product.isSample,
      };

      setHistory((prev) => [
        historyEntry,
        ...prev.filter((item) => item.barcode !== product.barcode),
      ]);

      // Sync with server history
      saveRemoteHistory(historyEntry).catch(() => {});
    } catch (err: any) {
      console.warn('Decoding notice for product:', err?.message || err);
      // Ensure state is populated with local parsing fallback
      const fallbackIngredients = parseIngredientsLocally(product.ingredientsText);
      const fallbackJain = inspectJainSuitabilityLocally(product.ingredientsText, preferences);
      setDecodedIngredients(fallbackIngredients);
      setJainAnalysis(fallbackJain);
    } finally {
      setIsDecoding(false);
    }
  };

  // Select barcode by string (from home, search, jain, or history)
  const handleSelectBarcode = async (barcode: string, destinationView?: string) => {
    setGlobalError(null);
    const viewAtInvocation = currentViewRef.current;
    try {
      const product = await fetchProductByBarcode(barcode);
      // Only carry over destinationView if user is still on the originating view
      const targetView = currentViewRef.current === viewAtInvocation ? destinationView : undefined;
      await handleProductLoaded(product, targetView);
    } catch (err: any) {
      setGlobalError(err.message || `Failed to fetch barcode ${barcode}`);
      // Do NOT navigate to decoder on error; keep user on their current page
    }
  };

  const handleRemoveHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearHistory = () => {
    setHistory([]);
    clearRemoteHistory().catch(() => {});
  };

  const handleNavigateToOCR = (barcode = '') => {
    setRescueBarcode(barcode);
    navigateTo('ocr');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Navigation Header */}
      <Header
        currentView={currentView}
        onNavigate={navigateTo}
        language={language}
        onLanguageChange={handleLanguageChange}
        activeProduct={activeProduct}
      />

      {/* Global Error Banner if any */}
      {globalError && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 text-xs text-rose-800 text-center font-medium flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{globalError}</span>
          <button
            onClick={() => setGlobalError(null)}
            className="underline ml-2 text-rose-900 font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Barcode Mismatch Warning Banner */}
      {activeProduct && !activeProduct.barcodeMatches && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 text-center font-medium flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Caution: Scanned barcode ({activeProduct.scannedBarcode}) differs from database identifier ({activeProduct.barcode}).
          </span>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {currentView === 'home' && (
          <HomeView
            language={language}
            onNavigate={navigateTo}
            onSelectProduct={(barcode) => handleSelectBarcode(barcode, 'decoder')}
          />
        )}

        {currentView === 'scan' && (
          <ScanBarcodeView
            language={language}
            onProductLoaded={(product) => handleProductLoaded(product, 'decoder')}
            onNavigateToOCR={handleNavigateToOCR}
          />
        )}

        {currentView === 'jain' && (
          <JainIngredientCheckView
            language={language}
            product={activeProduct}
            preferences={preferences}
            onNavigateToScan={() => navigateTo('scan')}
            onNavigateToOCR={() => navigateTo('ocr')}
            onSelectBarcode={(b) => handleSelectBarcode(b, 'jain')}
            onProductLoaded={(p) => handleProductLoaded(p, 'jain')}
          />
        )}

        {currentView === 'decoder' && (
          <IngredientDecoderView
            language={language}
            product={activeProduct}
            decodedIngredients={decodedIngredients}
            isLoading={isDecoding}
            onNavigateToScan={() => navigateTo('scan')}
            onNavigateToOCR={() => navigateTo('ocr')}
            onSelectBarcode={(b) => handleSelectBarcode(b, 'decoder')}
          />
        )}

        {currentView === 'nutrition' && (
          <NutritionDashboardView
            language={language}
            product={activeProduct}
            onNavigateToScan={() => navigateTo('scan')}
          />
        )}

        {currentView === 'history' && (
          <ScanHistoryView
            language={language}
            history={history}
            onSelectBarcode={(b) => handleSelectBarcode(b, 'decoder')}
            onRemoveItem={handleRemoveHistoryItem}
            onClearAll={handleClearHistory}
            onNavigateToScan={() => navigateTo('scan')}
          />
        )}

        {currentView === 'settings' && (
          <SettingsView
            language={language}
            onLanguageChange={handleLanguageChange}
            preferences={preferences}
            onSavePreferences={handleSavePreferences}
          />
        )}

        {currentView === 'ocr' && (
          <PackagePhotoOCRView
            language={language}
            initialBarcode={rescueBarcode}
            onIngredientsExtracted={(product) => handleProductLoaded(product, 'decoder')}
          />
        )}
      </main>

      {/* Brand Footer */}
      <Footer language={language} onNavigate={navigateTo} />
    </div>
  );
}
