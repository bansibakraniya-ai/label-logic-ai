import { ProductNutrition, NutrientValue } from '../types';

export interface WholePackageResult {
  canCalculate: boolean;
  reasonDisabled?: string;
  netWeightGrams: number | null;
  items: {
    key: keyof ProductNutrition;
    label: string;
    unit: string;
    value: number | null;
    isReported: boolean;
    formula: string;
  }[];
}

const NUTRIENT_LABELS: Record<keyof ProductNutrition, string> = {
  calories: 'Calories',
  proteins: 'Protein',
  carbohydrates: 'Carbohydrates',
  sugars: 'Sugars',
  addedSugars: 'Added Sugars',
  fat: 'Total Fat',
  saturatedFat: 'Saturated Fat',
  transFat: 'Trans Fat',
  fiber: 'Fiber',
  sodium: 'Sodium',
  salt: 'Salt (NaCl)',
};

/**
 * Calculates whole-package nutrition values safely.
 * Disables calculation if net package weight is unknown.
 */
export function calculateWholePackage(
  nutrition: ProductNutrition,
  netWeightGrams: number | null
): WholePackageResult {
  if (!netWeightGrams || isNaN(netWeightGrams) || netWeightGrams <= 0) {
    return {
      canCalculate: false,
      reasonDisabled: 'Net package weight is missing, unverified, or non-numeric. Cannot calculate whole-package totals without true mass.',
      netWeightGrams: null,
      items: [],
    };
  }

  const multiplier = netWeightGrams / 100;
  const items: WholePackageResult['items'] = [];

  (Object.keys(nutrition) as (keyof ProductNutrition)[]).forEach((key) => {
    const nutrient = nutrition[key];
    const label = NUTRIENT_LABELS[key];

    if (nutrient.per100g !== null && !isNaN(nutrient.per100g)) {
      const calculatedVal = parseFloat((nutrient.per100g * multiplier).toFixed(1));
      items.push({
        key,
        label,
        unit: nutrient.unit,
        value: calculatedVal,
        isReported: false,
        formula: `${nutrient.per100g} ${nutrient.unit} × (${netWeightGrams}g ÷ 100g)`,
      });
    } else {
      items.push({
        key,
        label,
        unit: nutrient.unit,
        value: null,
        isReported: false,
        formula: '100g value is not reported in database; cannot compute total.',
      });
    }
  });

  return {
    canCalculate: true,
    netWeightGrams,
    items,
  };
}
