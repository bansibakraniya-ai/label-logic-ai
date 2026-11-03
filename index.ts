export type Language = 'en' | 'gu' | 'hi';

export interface NutrientValue {
  per100g: number | null;
  perServing: number | null;
  unit: string;
}

export interface ProductNutrition {
  calories: NutrientValue;
  proteins: NutrientValue;
  carbohydrates: NutrientValue;
  sugars: NutrientValue;
  addedSugars: NutrientValue;
  fat: NutrientValue;
  saturatedFat: NutrientValue;
  transFat: NutrientValue;
  fiber: NutrientValue;
  sodium: NutrientValue;
  salt: NutrientValue;
}

export interface Product {
  barcode: string;
  scannedBarcode: string;
  barcodeMatches: boolean;
  name: string;
  brand: string;
  categories: string[];
  imageUrl: string | null;
  ingredientsText: string;
  nutrition: ProductNutrition;
  quantityString: string | null;
  netWeightGrams: number | null;
  servingSize: string | null;
  allergens: string[];
  traces: string[];
  additives: string[];
  labels: string[];
  origin: string | null;
  manufacturingPlaces: string | null;
  dataSource: string;
  retrievalTime: string;
  missingFields: string[];
  completeness?: number | null;
  isSample?: boolean;
}

export type IngredientCategory =
  | 'grain'
  | 'oil'
  | 'spice'
  | 'additive'
  | 'preservative'
  | 'sweetener'
  | 'emulsifier'
  | 'flavouring'
  | 'compound'
  | 'dairy'
  | 'vegetable'
  | 'other';

export interface DecodedIngredient {
  originalName: string;
  standardizedName: string;
  englishExplanation: string;
  gujaratiTranslation: string;
  hindiTranslation: string;
  purpose: string;
  category: IngredientCategory | string;
  source: string;
  confidence: 'high' | 'medium' | 'low' | string;
}

export type JainStatus =
  | 'FOUND'
  | 'NOT_FOUND_IN_AVAILABLE_DATA'
  | 'NEEDS_VERIFICATION'
  | 'VERIFIED_ABSENCE';

export interface JainEvidenceItem {
  term: string;
  category: 'onion' | 'garlic' | 'compound' | 'animal' | 'other';
  description: string;
  contextSnippet?: string;
}

export interface JainAnalysis {
  status: JainStatus;
  onionDetected: boolean;
  garlicDetected: boolean;
  detectedKeywords: string[];
  ambiguousIngredients: string[];
  evidence?: JainEvidenceItem[];
  isMissingIngredients?: boolean;
  disclaimer?: string;
  explanationEn: string;
  explanationGu: string;
  explanationHi: string;
  recommendation: string;
  needsVerificationReason?: string;
}

export interface ScanHistoryItem {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  scannedAt: string;
  jainStatus: JainStatus;
  isSample?: boolean;
}

export interface UserPreferences {
  language: Language;
  avoidOnion: boolean;
  avoidGarlic: boolean;
  avoidRootVegetables: boolean;
  avoidGelatin: boolean;
  avoidAnimalRennet: boolean;
  avoidAlcohol: boolean;
  customAvoidedIngredients: string[];
  flaggedAllergens: string[];
}

export interface OCRResult {
  productName?: string;
  brand?: string;
  extractedIngredientsText: string;
  unreadableWords: string[];
  isCompleteIngredientList: boolean;
  needsClearerPhoto: boolean;
  clarityExplanation: string;
  allergensDeclared?: string[];
  netQuantity?: string;
  nutritionPanelFound?: boolean;
  nutritionValuesText?: string;
  isManualEntry?: boolean;
}

