import React, { useState } from 'react';
import {
  BarChart3,
  Calculator,
  AlertCircle,
  Info,
  CheckCircle2,
  Scale,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { Language, Product } from '../types';
import { translations } from '../translations';
import { calculateWholePackage } from '../utils/nutritionCalculations';

interface NutritionDashboardViewProps {
  language: Language;
  product: Product | null;
  onNavigateToScan: () => void;
}

export const NutritionDashboardView: React.FC<NutritionDashboardViewProps> = ({
  language,
  product,
  onNavigateToScan,
}) => {
  const t = translations[language];
  const [showWholePackModal, setShowWholePackModal] = useState(false);

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 px-4 space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-sm">
          <BarChart3 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">{t.nutrition.title}</h2>
          <p className="text-sm text-slate-600">
            Please scan or select a product to examine nutritional data and whole-package calculations.
          </p>
        </div>
        <button
          onClick={onNavigateToScan}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
        >
          {t.hero.btnScan}
        </button>
      </div>
    );
  }

  const nutrition = product.nutrition;
  const wholePackageResult = calculateWholePackage(nutrition, product.netWeightGrams);

  const nutrientRows: {
    key: keyof typeof nutrition;
    label: string;
    value100: number | null;
    valueServing: number | null;
    unit: string;
    isSubItem?: boolean;
    important?: boolean;
  }[] = [
    {
      key: 'calories',
      label: t.nutrition.calories,
      value100: nutrition.calories.per100g,
      valueServing: nutrition.calories.perServing,
      unit: 'kcal',
      important: true,
    },
    {
      key: 'proteins',
      label: t.nutrition.protein,
      value100: nutrition.proteins.per100g,
      valueServing: nutrition.proteins.perServing,
      unit: nutrition.proteins.unit,
      important: true,
    },
    {
      key: 'carbohydrates',
      label: t.nutrition.carbohydrates,
      value100: nutrition.carbohydrates.per100g,
      valueServing: nutrition.carbohydrates.perServing,
      unit: nutrition.carbohydrates.unit,
      important: true,
    },
    {
      key: 'sugars',
      label: t.nutrition.sugars,
      value100: nutrition.sugars.per100g,
      valueServing: nutrition.sugars.perServing,
      unit: nutrition.sugars.unit,
      isSubItem: true,
    },
    {
      key: 'addedSugars',
      label: t.nutrition.addedSugars,
      value100: nutrition.addedSugars.per100g,
      valueServing: nutrition.addedSugars.perServing,
      unit: nutrition.addedSugars.unit,
      isSubItem: true,
    },
    {
      key: 'fat',
      label: t.nutrition.fat,
      value100: nutrition.fat.per100g,
      valueServing: nutrition.fat.perServing,
      unit: nutrition.fat.unit,
      important: true,
    },
    {
      key: 'saturatedFat',
      label: t.nutrition.saturatedFat,
      value100: nutrition.saturatedFat.per100g,
      valueServing: nutrition.saturatedFat.perServing,
      unit: nutrition.saturatedFat.unit,
      isSubItem: true,
    },
    {
      key: 'transFat',
      label: t.nutrition.transFat,
      value100: nutrition.transFat.per100g,
      valueServing: nutrition.transFat.perServing,
      unit: nutrition.transFat.unit,
      isSubItem: true,
    },
    {
      key: 'fiber',
      label: t.nutrition.fiber,
      value100: nutrition.fiber.per100g,
      valueServing: nutrition.fiber.perServing,
      unit: nutrition.fiber.unit,
    },
    {
      key: 'sodium',
      label: t.nutrition.sodium,
      value100: nutrition.sodium.per100g,
      valueServing: nutrition.sodium.perServing,
      unit: nutrition.sodium.unit || 'g',
    },
    {
      key: 'salt',
      label: t.nutrition.salt,
      value100: nutrition.salt.per100g,
      valueServing: nutrition.salt.perServing,
      unit: nutrition.salt.unit || 'g',
    },
  ];

  // Calculate macronutrient distribution for bar visual if values exist
  const carbsVal = nutrition.carbohydrates.per100g || 0;
  const proteinVal = nutrition.proteins.per100g || 0;
  const fatVal = nutrition.fat.per100g || 0;
  const macroSum = carbsVal + proteinVal + fatVal;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold mb-1">
            <Scale className="w-3.5 h-3.5 text-emerald-600" />
            Nutritional Facts & Density Analysis
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {t.nutrition.title}
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            {t.nutrition.subtitle}
          </p>
        </div>

        {/* Product meta badge */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 self-start sm:self-auto text-xs space-y-0.5">
          <span className="text-slate-500 font-semibold block">Declared Package Weight</span>
          <span className="font-bold text-slate-900 text-sm">
            {product.quantityString || 'Unknown / Not Reported'}
          </span>
        </div>
      </div>

      {/* Macronutrient Visual Ratio Bar (if macros exist) */}
      {macroSum > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
          <div className="flex justify-between items-center text-xs font-bold text-slate-700">
            <span>Macronutrient Profile (per 100g)</span>
            <span>Total Macros: {macroSum.toFixed(1)}g</span>
          </div>

          {/* Stacked bar */}
          <div className="w-full h-3.5 rounded-full overflow-hidden flex bg-slate-100">
            <div
              style={{ width: `${(carbsVal / macroSum) * 100}%` }}
              className="bg-amber-400 h-full"
              title={`Carbohydrates: ${carbsVal}g`}
            ></div>
            <div
              style={{ width: `${(proteinVal / macroSum) * 100}%` }}
              className="bg-emerald-500 h-full"
              title={`Protein: ${proteinVal}g`}
            ></div>
            <div
              style={{ width: `${(fatVal / macroSum) * 100}%` }}
              className="bg-rose-400 h-full"
              title={`Fat: ${fatVal}g`}
            ></div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-semibold pt-1">
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="w-3 h-3 rounded-full bg-amber-400"></span>
              Carbs: {carbsVal}g ({Math.round((carbsVal / macroSum) * 100)}%)
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              Protein: {proteinVal}g ({Math.round((proteinVal / macroSum) * 100)}%)
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="w-3 h-3 rounded-full bg-rose-400"></span>
              Fat: {fatVal}g ({Math.round((fatVal / macroSum) * 100)}%)
            </span>
          </div>
        </div>
      )}

      {/* Main Nutrition Facts Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              {product.name}
            </h2>
            <p className="text-xs text-slate-500">
              Serving Size: <span className="font-semibold text-slate-800">{product.servingSize || 'Not specified by manufacturer'}</span>
            </p>
          </div>
          <span className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg font-medium self-start sm:self-auto">
            Source: {product.dataSource}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-bold text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-6">Nutrient</th>
                <th className="py-3 px-6 text-right">{t.nutrition.per100g}</th>
                <th className="py-3 px-6 text-right">{t.nutrition.perServing}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {nutrientRows.map((row) => (
                <tr
                  key={row.key}
                  className={`hover:bg-slate-50/70 transition-colors ${
                    row.important ? 'font-bold bg-slate-50/30' : ''
                  }`}
                >
                  <td className={`py-3.5 px-6 ${row.isSubItem ? 'pl-10 text-slate-600' : ''}`}>
                    {row.label}
                  </td>
                  <td className="py-3.5 px-6 text-right font-mono">
                    {row.value100 !== null ? (
                      <span>
                        {row.value100} <span className="text-slate-500 font-sans text-xs">{row.unit}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 font-sans italic text-xs">
                        {t.nutrition.notReported}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-right font-mono">
                    {row.valueServing !== null ? (
                      <span>
                        {row.valueServing} <span className="text-slate-500 font-sans text-xs">{row.unit}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 font-sans italic text-xs">
                        {t.nutrition.notReported}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sodium vs Salt Chemistry Note */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {t.nutrition.sodiumVsSaltNote}
          </p>
        </div>
      </div>

      {/* Whole-Package Calculator Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">
                {t.nutrition.wholePackage}
              </h3>
              <p className="text-xs text-slate-500">
                Total nutritional intake if consuming the full packaging container.
              </p>
            </div>
          </div>

          <span
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border self-start sm:self-auto ${
              wholePackageResult.canCalculate
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            {wholePackageResult.canCalculate ? 'Active & Calculated' : 'Calculation Disabled'}
          </span>
        </div>

        {/* Disabled State if Net Weight is Unknown */}
        {!wholePackageResult.canCalculate ? (
          <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              Safety Safeguard: Unknown Package Weight
            </div>
            <p className="leading-relaxed">
              {t.nutrition.wholePackDisabled}
            </p>
            <p className="text-amber-800 font-medium">
              Reason: {wholePackageResult.reasonDisabled}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1">
              <span className="font-bold block">Calculation Parameters</span>
              <p>
                Net Verified Weight: <span className="font-mono font-bold">{wholePackageResult.netWeightGrams} g</span>.
                Formula: Value per 100g × ({wholePackageResult.netWeightGrams} ÷ 100).
                All results are mathematically calculated based on reported density.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {wholePackageResult.items.map((item) => (
                <div
                  key={item.key}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1"
                >
                  <span className="text-xs text-slate-500 block truncate">{item.label}</span>
                  <div className="font-extrabold text-slate-900 text-base font-mono">
                    {item.value !== null ? (
                      <span>
                        {item.value} <span className="text-xs font-sans font-medium text-slate-600">{item.unit}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Not reported</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block truncate" title={item.formula}>
                    {item.formula}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
