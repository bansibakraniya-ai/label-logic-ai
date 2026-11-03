import { Product, DecodedIngredient, JainAnalysis, OCRResult, UserPreferences } from '../types';
import { parseIngredientsLocally, inspectJainSuitabilityLocally } from '../utils/jainRules';

export class ApiError extends Error {
  code?: string;
  scannedBarcode?: string;
  canRescueWithOCR?: boolean;

  constructor(message: string, code?: string, scannedBarcode?: string, canRescueWithOCR?: boolean) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.scannedBarcode = scannedBarcode;
    this.canRescueWithOCR = canRescueWithOCR;
  }
}

/**
 * Fetch product details by barcode
 */
export async function fetchProductByBarcode(barcode: string): Promise<Product> {
  const cleanBarcode = barcode.trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(`/api/product/${encodeURIComponent(cleanBarcode)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json();
    if (!res.ok) {
      throw new ApiError(
        data.error || `Failed to fetch product for barcode ${cleanBarcode}`,
        data.code,
        data.scannedBarcode || cleanBarcode,
        data.canRescueWithOCR
      );
    }
    return data as Product;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new ApiError(
        'Request timed out while contacting product database. Please check your connection and retry.',
        'TIMEOUT',
        cleanBarcode,
        true
      );
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err.message || 'Network error occurred while fetching product information.',
      'NETWORK_ERROR',
      cleanBarcode,
      true
    );
  }
}

/**
 * Search products by query keyword
 */
export async function searchProducts(query: string): Promise<{ barcode: string; name: string; brand: string; imageUrl?: string; categories: string[]; ingredientsText: string }[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return data.products || [];
  } catch (err: any) {
    console.log('Search notice:', err?.message || err);
    return [];
  }
}

/**
 * Analyze package photograph via Gemini 3.8 Flash OCR
 */
export async function analyzePackagePhoto(imageBase64: string, mimeType = 'image/jpeg'): Promise<OCRResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch('/api/ocr-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json();
    return data as OCRResult;
  } catch (_err) {
    clearTimeout(timeoutId);
    console.log('Package OCR switched to manual review workspace.');
    return {
      productName: '',
      brand: '',
      extractedIngredientsText: '',
      unreadableWords: [],
      isCompleteIngredientList: false,
      needsClearerPhoto: false,
      clarityExplanation: 'Photo capture preserved. You can review your packaging photo above and enter or paste the ingredients directly in the text area below.',
      allergensDeclared: [],
      isManualEntry: true,
    };
  }
}

/**
 * Decodes ingredients into multi-language explanations and analyzes Jain suitability
 */
export async function decodeIngredients(
  ingredientsText: string,
  productName = '',
  brand = '',
  preferences: Partial<UserPreferences> = {}
): Promise<{
  decodedIngredients: DecodedIngredient[];
  jainAnalysis: JainAnalysis;
  source: string;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('/api/decode-ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredientsText,
        productName,
        brand,
        preferences,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.log('Decode API notice, using resilient local analyzer:', err?.message || err);
  }

  // Guaranteed fallback: never let an AbortError or network hiccup break product decoding
  return {
    decodedIngredients: parseIngredientsLocally(ingredientsText),
    jainAnalysis: inspectJainSuitabilityLocally(ingredientsText, preferences),
    source: 'offline_rule_fallback',
  };
}

/**
 * Directly inspects an ingredient list specifically for Jain suitability
 */
export async function checkJainSuitability(
  ingredientsText: string,
  productName = '',
  brand = '',
  preferences: Partial<UserPreferences> = {}
): Promise<JainAnalysis> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch('/api/jain-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredientsText,
        productName,
        brand,
        preferences,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return data as JainAnalysis;
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.log('Jain check API notice, fallback to local inspection:', err?.message || err);
  }

  return inspectJainSuitabilityLocally(ingredientsText, preferences);
}

/**
 * Fetch server-side history
 */
export async function fetchRemoteHistory(): Promise<any[]> {
  try {
    const res = await fetch('/api/history');
    if (res.ok) {
      const data = await res.json();
      return data.history || [];
    }
  } catch (err) {
    console.log('Remote history fetch notice:', err);
  }
  return [];
}

/**
 * Save scan history item to server
 */
export async function saveRemoteHistory(item: any): Promise<void> {
  try {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
  } catch (err) {
    console.log('Remote history save notice:', err);
  }
}

/**
 * Clear server-side history
 */
export async function clearRemoteHistory(): Promise<void> {
  try {
    await fetch('/api/history', { method: 'DELETE' });
  } catch (err) {
    console.log('Remote history clear notice:', err);
  }
}
