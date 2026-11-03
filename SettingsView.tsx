import React, { useState } from 'react';
import {
  Settings,
  Globe,
  Sliders,
  ShieldCheck,
  Check,
  AlertCircle,
  Save,
  Plus,
  X,
} from 'lucide-react';
import { Language, UserPreferences } from '../types';
import { translations } from '../translations';

interface SettingsViewProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  preferences: UserPreferences;
  onSavePreferences: (prefs: UserPreferences) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  language,
  onLanguageChange,
  preferences,
  onSavePreferences,
}) => {
  const t = translations[language];

  const [localPrefs, setLocalPrefs] = useState<UserPreferences>(preferences);
  const [customInput, setCustomInput] = useState('');
  const [showSavedToast, setShowSavedToast] = useState(false);

  const commonAllergens = [
    'Gluten / Wheat',
    'Peanuts',
    'Tree Nuts (Almonds, Cashews, Walnuts)',
    'Milk / Dairy',
    'Soy / Soybeans',
    'Egg',
    'Fish / Shellfish',
    'Mustard',
    'Sesame',
    'Sulphites',
  ];

  const handleToggleAllergen = (allergen: string) => {
    const list = localPrefs.flaggedAllergens || [];
    if (list.includes(allergen)) {
      setLocalPrefs({
        ...localPrefs,
        flaggedAllergens: list.filter((a) => a !== allergen),
      });
    } else {
      setLocalPrefs({
        ...localPrefs,
        flaggedAllergens: [...list, allergen],
      });
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customInput.trim();
    if (!clean) return;
    const existing = localPrefs.customAvoidedIngredients || [];
    if (!existing.includes(clean)) {
      setLocalPrefs({
        ...localPrefs,
        customAvoidedIngredients: [...existing, clean],
      });
    }
    setCustomInput('');
  };

  const handleRemoveCustom = (item: string) => {
    setLocalPrefs({
      ...localPrefs,
      customAvoidedIngredients: (localPrefs.customAvoidedIngredients || []).filter(
        (i) => i !== item
      ),
    });
  };

  const handleSave = () => {
    onSavePreferences(localPrefs);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Title Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold mb-1">
          <Settings className="w-3.5 h-3.5 text-emerald-600" />
          Dietary Tailoring & Regionalization
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {t.settings.title}
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          {t.settings.subtitle}
        </p>
      </div>

      {showSavedToast && (
        <div className="p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
          <Check className="w-4 h-4" />
          {t.settings.saveSuccess}
        </div>
      )}

      {/* 1. Language Preference */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <Globe className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="font-bold text-slate-900 text-base">{t.settings.language}</h3>
            <p className="text-xs text-slate-500">
              Select your preferred display and translation language.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'en' as Language, title: 'English', sub: 'Standard food science & descriptions' },
            { id: 'gu' as Language, title: 'ગુજરાતી (Gujarati)', sub: 'સરળ ગુજરાતી અનુવાદ અને અર્થઘટન' },
            { id: 'hi' as Language, title: 'हिन्दी (Hindi)', sub: 'सरल हिन्दी व्याख्या और सामग्री अर्थ' },
          ].map((l) => (
            <button
              key={l.id}
              onClick={() => {
                onLanguageChange(l.id);
                setLocalPrefs({ ...localPrefs, language: l.id });
              }}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                language === l.id
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-sm text-slate-900">{l.title}</span>
                {language === l.id && <Check className="w-4 h-4 text-emerald-600" />}
              </div>
              <p className="text-xs text-slate-500">{l.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Jain Dietary Rules Strictness */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <Sliders className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="font-bold text-slate-900 text-base">{t.settings.jainRules}</h3>
            <p className="text-xs text-slate-500">
              Customize what ingredients trigger warning flags for your personal practice.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            {
              key: 'avoidOnion' as const,
              label: t.settings.avoidOnion,
              desc: 'Flags all allium variations (shallots, green onions, onion powder, flakes).',
            },
            {
              key: 'avoidGarlic' as const,
              label: t.settings.avoidGarlic,
              desc: 'Flags garlic, lahsun, garlic extracts, and garlic seasonings.',
            },
            {
              key: 'avoidRootVegetables' as const,
              label: t.settings.avoidRootVeg,
              desc: 'Flags potatoes, carrots, radish, ginger, beetroots, and other root tubers.',
            },
            {
              key: 'avoidGelatin' as const,
              label: t.settings.avoidGelatin,
              desc: 'Flags gelatin, animal bone char, and carmine / cochineal insect dye (E120).',
            },
            {
              key: 'avoidAnimalRennet' as const,
              label: t.settings.avoidAnimalRennet,
              desc: 'Flags animal rennet and non-microbial enzymes in cheese and dairy products.',
            },
            {
              key: 'avoidAlcohol' as const,
              label: t.settings.avoidAlcohol,
              desc: 'Flags food products prepared with cooking wine, fermented spirits, or vanilla extracts in alcohol.',
            },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={localPrefs[item.key]}
                onChange={(e) =>
                  setLocalPrefs({ ...localPrefs, [item.key]: e.target.checked })
                }
                className="mt-1 rounded-sm text-emerald-600 focus:ring-emerald-500 w-4 h-4 shrink-0"
              />
              <div className="space-y-0.5">
                <span className="font-bold text-xs sm:text-sm text-slate-800 block">
                  {item.label}
                </span>
                <span className="text-xs text-slate-500 leading-normal block">
                  {item.desc}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 3. Custom Avoided Ingredients */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base">
            Custom Avoided Ingredients
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Add any other specific ingredients you personally avoid (e.g. Palm oil, MSG, Artificial colors).
          </p>
        </div>

        <form onSubmit={handleAddCustom} className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Type ingredient name (e.g. Palm oil) and press Add"
            className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-emerald-500 outline-hidden"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </form>

        <div className="flex flex-wrap gap-2 pt-1">
          {(localPrefs.customAvoidedIngredients || []).map((item) => (
            <span
              key={item}
              className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-xs flex items-center gap-1.5"
            >
              {item}
              <button
                type="button"
                onClick={() => handleRemoveCustom(item)}
                className="text-emerald-600 hover:text-emerald-900"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          {(!localPrefs.customAvoidedIngredients ||
            localPrefs.customAvoidedIngredients.length === 0) && (
            <span className="text-xs text-slate-400 italic">
              No custom avoided ingredients specified.
            </span>
          )}
        </div>
      </div>

      {/* 4. Allergen Watchlist */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base">{t.settings.allergensToWatch}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Select allergens to highlight prominently on every product scan.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {commonAllergens.map((alg) => {
            const isChecked = (localPrefs.flaggedAllergens || []).includes(alg);
            return (
              <label
                key={alg}
                className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
                  isChecked
                    ? 'border-emerald-500 bg-emerald-50/50 text-slate-900 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleAllergen(alg)}
                  className="rounded-sm text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>{alg}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          Save Preferences
        </button>
      </div>
    </div>
  );
};
