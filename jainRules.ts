import { JainStatus, UserPreferences } from '../types';

export interface KeywordMatch {
  keyword: string;
  category: 'onion' | 'garlic' | 'root_vegetable' | 'animal' | 'ambiguous' | 'custom';
  description: string;
}

// Strict known terms
export const ONION_TERMS = [
  'onion',
  'onions',
  'shallot',
  'shallots',
  'scallion',
  'scallions',
  'spring onion',
  'green onion',
  'chive',
  'chives',
  'leek',
  'leeks',
  'pyaz',
  'dungri',
  'kanda',
  'dehydrated onion',
  'onion powder',
  'onion flakes',
  'onion extract',
  'allium cepa',
];

export const GARLIC_TERMS = [
  'garlic',
  'garlics',
  'lahsun',
  'lasan',
  'garlic powder',
  'dried garlic',
  'garlic extract',
  'garlic paste',
  'garlic oil',
  'allium sativum',
];

export const ROOT_VEGETABLE_TERMS = [
  'potato',
  'potatoes',
  'carrot',
  'carrots',
  'radish',
  'beetroot',
  'turnip',
  'ginger',
  'sweet potato',
  'yam',
  'tapioca',
  'mooli',
  'adrak',
  'gajar',
];

export const AMBIGUOUS_TERMS = [
  'natural flavour',
  'natural flavours',
  'natural flavor',
  'natural flavors',
  'artificial flavour',
  'artificial flavor',
  'artificial flavours',
  'artificial flavors',
  'flavouring',
  'flavoring',
  'seasoning',
  'seasoning mix',
  'spice mix',
  'mixed spices',
  'masala',
  'masala blend',
  'curry powder',
  'soup base',
  'condiments',
  'tastemaker',
  'spice extracts',
];

export const NON_VEG_ANIMAL_TERMS = [
  'gelatin',
  'gelatine',
  'carmine',
  'cochineal',
  'e120',
  'animal rennet',
  'pepsin',
  'lard',
  'tallow',
  'bone char',
  'shellac',
  'e904',
  'isinglass',
];

/**
 * Scans text and extracts matched keywords with their category
 */
export function findMatchingKeywords(text: string, preferences: UserPreferences): KeywordMatch[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matches: KeywordMatch[] = [];

  const checkList = (list: string[], cat: KeywordMatch['category'], desc: string) => {
    for (const term of list) {
      // Escape for regex
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lower)) {
        if (!matches.some(m => m.keyword.toLowerCase() === term.toLowerCase())) {
          matches.push({ keyword: term, category: cat, description: desc });
        }
      }
    }
  };

  if (preferences.avoidOnion) {
    checkList(ONION_TERMS, 'onion', 'Onion or related allium variant');
  }

  if (preferences.avoidGarlic) {
    checkList(GARLIC_TERMS, 'garlic', 'Garlic or garlic derivative');
  }

  if (preferences.avoidRootVegetables) {
    checkList(ROOT_VEGETABLE_TERMS, 'root_vegetable', 'Root vegetable (underground botanical)');
  }

  if (preferences.avoidGelatin || preferences.avoidAnimalRennet) {
    checkList(NON_VEG_ANIMAL_TERMS, 'animal', 'Animal derived enzyme or gelatin');
  }

  checkList(AMBIGUOUS_TERMS, 'ambiguous', 'Ambiguous flavoring or seasoning blend');

  // Custom user avoided ingredients
  if (preferences.customAvoidedIngredients && preferences.customAvoidedIngredients.length > 0) {
    for (const custom of preferences.customAvoidedIngredients) {
      const cleanCustom = custom.trim().toLowerCase();
      if (cleanCustom && lower.includes(cleanCustom)) {
        matches.push({
          keyword: custom.trim(),
          category: 'custom',
          description: 'User customized avoided ingredient',
        });
      }
    }
  }

  return matches;
}

/**
 * Returns color classes for Jain Status badge
 */
export function getJainStatusColor(status: JainStatus): {
  bg: string;
  text: string;
  border: string;
  badgeBg: string;
  iconColor: string;
} {
  switch (status) {
    case 'FOUND':
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-900',
        border: 'border-rose-300',
        badgeBg: 'bg-rose-600 text-white',
        iconColor: 'text-rose-600',
      };
    case 'NEEDS_VERIFICATION':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-900',
        border: 'border-amber-300',
        badgeBg: 'bg-amber-500 text-white',
        iconColor: 'text-amber-600',
      };
    case 'VERIFIED_ABSENCE':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-900',
        border: 'border-emerald-300',
        badgeBg: 'bg-emerald-600 text-white',
        iconColor: 'text-emerald-600',
      };
    case 'NOT_FOUND_IN_AVAILABLE_DATA':
    default:
      return {
        bg: 'bg-slate-50',
        text: 'text-slate-800',
        border: 'border-slate-300',
        badgeBg: 'bg-slate-700 text-white',
        iconColor: 'text-slate-600',
      };
  }
}

/**
 * Splits ingredient text by commas and parentheses for basic local breakdown
 */
export function parseIngredientsLocally(text: string) {
  if (!text || typeof text !== 'string') return [];
  const items: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '(' || char === '{' || char === '[') depth++;
    else if (char === ')' || char === '}' || char === ']') depth--;

    if (char === ',' && depth === 0) {
      if (current.trim()) items.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) items.push(current.trim());

  return items.slice(0, 35).map((item) => {
    const clean = item.replace(/^[:\-•\s]+/, '').trim();
    const lower = clean.toLowerCase();
    const cleanStd = clean.replace(/\(.*?\)/g, '').trim();

    let standardizedName = cleanStd || clean;
    let category = 'compound';
    let purpose = 'Food preparation ingredient';
    let englishExplanation = `Declared food ingredient: ${clean}`;
    let gujaratiTranslation = `નોંધાયેલ ઘટક: ${clean}`;
    let hindiTranslation = `घोषित खाद्य सामग्री: ${clean}`;

    // Common food intelligence dictionary
    if (/wheat flour|maida|atta|refined wheat/i.test(lower)) {
      standardizedName = 'Refined Wheat Flour (Maida)';
      category = 'grain';
      purpose = 'Base dough structure and carbohydrate energy';
      englishExplanation = 'Finely milled wheat flour providing structure, gluten elasticity, and texture.';
      gujaratiTranslation = 'મેંદો / શુદ્ધ ઘઉંનો લોટ: ખાદ્યપદાર્થની મૂળભૂત રચના અને લોટ બાંધવા માટે.';
      hindiTranslation = 'मैदा / परिष्कृत गेहूं का आटा: भोजन की मूल संरचना एवं लोच प्रदान करने हेतु।';
    } else if (/onion/i.test(lower)) {
      standardizedName = 'Dehydrated Onion / Onion Powder';
      category = 'spice';
      purpose = 'Savory flavoring (Root allium - Non-Jain)';
      englishExplanation = 'Underground allium bulb providing savory taste. Prohibited under Jain dietary rules.';
      gujaratiTranslation = 'ડુંગળી / કાંદા: કંદમૂળ હોવાથી જૈન આહાર નિયમો અનુસાર ત્યાજ્ય.';
      hindiTranslation = 'प्याज / कांदा: कंदमूल होने के कारण जैन आहार नियमों के तहत वर्ज्य।';
    } else if (/garlic/i.test(lower)) {
      standardizedName = 'Dried Garlic / Garlic Powder';
      category = 'spice';
      purpose = 'Pungent aroma (Root allium - Non-Jain)';
      englishExplanation = 'Pungent underground bulb of Allium sativum. Prohibited under Jain dietary rules.';
      gujaratiTranslation = 'લસણ: જમીનની અંદર ઊગતું કંદમૂળ જે જૈન ધર્મમાં અયોગ્ય ગણાય છે.';
      hindiTranslation = 'लहसुन: तीखी सुगंधित कंदमूल सामग्री जो जैन आहार में वर्ज्य है।';
    } else if (/palm oil|palmolein/i.test(lower)) {
      standardizedName = 'Refined Palm Oil';
      category = 'oil';
      purpose = 'Cooking fat, crispness and shelf-life stability';
      englishExplanation = 'Plant-based vegetable fat widely used for crispiness and temperature stability.';
      gujaratiTranslation = 'રિફાઇન્ડ પામ તેલ: ખાદ્ય પદાર્થને ખસ્તા અને લાંબા સમય સુધી સારો રાખવા માટેનું વનસ્પતિ તેલ.';
      hindiTranslation = 'रिफाइंड पाम तेल: खाद्य पदार्थ को कुरकुरा और स्थिर रखने वाला वनस्पति तेल।';
    } else if (/salt|sodium chloride/i.test(lower)) {
      standardizedName = 'Edible Common Salt (NaCl)';
      category = 'additive';
      purpose = 'Seasoning, taste balance, and natural preservation';
      englishExplanation = 'Essential mineral seasoning (sodium chloride) for flavor enhancement and balance.';
      gujaratiTranslation = 'આયોડાઇઝ્ડ સાદું મીઠું (NaCl): સ્વાદ સંતુલન અને સંરક્ષણ માટેનું જરૂરી ખનિજ.';
      hindiTranslation = 'खाद्य सामान्य नमक (NaCl): स्वाद बढ़ाने और संतुलन के लिए प्रयुक्त खनिज।';
    } else if (/sugar|sucrose|invert sugar/i.test(lower)) {
      standardizedName = 'Sugar (Sucrose)';
      category = 'sweetener';
      purpose = 'Sweetener, texture tenderizer, and browning';
      englishExplanation = 'Purified sucrose providing sweetness and aiding baked texture.';
      gujaratiTranslation = 'ખાંડ (શર્કરા): મીઠાશ અને બેકિંગમાં ક્રિસ્પી રચના આપવા માટે.';
      hindiTranslation = 'चीनी (शर्करा): मिठास और बेकिंग में बनावट देने के लिए।';
    } else if (/500\s*\(ii\)|sodium bicarbonate|baking soda/i.test(lower)) {
      standardizedName = 'Sodium Bicarbonate (INS 500ii)';
      category = 'additive';
      purpose = 'Leavening and raising agent';
      englishExplanation = 'Food-grade raising agent that releases CO2 gas bubbles during baking to create airy texture.';
      gujaratiTranslation = 'સોડિયમ બાયકાર્બોનેટ (ખાવાનો સોડા): ખોરાકને ફૂલાવવા અને નરમ બનાવવા માટે.';
      hindiTranslation = 'सोडियम बाइकार्बोनेट (बेकिंग सोडा): खाद्य पदार्थ को फुलाने एवं खस्ता बनाने हेतु।';
    } else if (/503\s*\(ii\)|ammonium bicarbonate/i.test(lower)) {
      standardizedName = 'Ammonium Bicarbonate (INS 503ii)';
      category = 'additive';
      purpose = 'Leavening agent for crisp snacks and biscuits';
      englishExplanation = 'Specialized food raising agent that evaporates completely leaving high crispiness without moisture.';
      gujaratiTranslation = 'એમોનિયમ બાયકાર્બોનેટ (INS 503ii): બિસ્કિટમાં કડક-ખસ્તાપણું લાવવા માટે વપરાતો ઉમેરણ.';
      hindiTranslation = 'अमोनियम बाइकार्बोनेट (INS 503ii): बिस्कुट में खस्तापन लाने वाला राइजिंग एजेंट।';
    } else if (/322|lecithin/i.test(lower)) {
      standardizedName = 'Lecithin (INS 322)';
      category = 'emulsifier';
      purpose = 'Emulsifier to blend fat and water homogeneously';
      englishExplanation = 'Natural plant-derived lipid that keeps oil and water evenly mixed in the recipe.';
      gujaratiTranslation = 'લેસિથિન (ઇમલ્સિફાયર): તેલ અને પાણીને સરખી રીતે મિશ્ર રાખવા માટે વપરાતો ઘટક.';
      hindiTranslation = 'लेसिथिन (इमल्सीफायर): वसा और पानी को एकसमान मिश्रित रखने वाला प्राकृतिक घटक।';
    } else if (/471|mono-.*diglycerides/i.test(lower)) {
      standardizedName = 'Mono- and Diglycerides (INS 471)';
      category = 'emulsifier';
      purpose = 'Emulsifier and crumb softener';
      englishExplanation = 'Food additive derived from plant fats used to stabilize mixtures and soften dough.';
      gujaratiTranslation = 'ફેટી એસિડ્સના મોનો અને ડાયગ્લિસરાઇડ્સ (INS 471): લોટને નરમ અને એકરસ રાખનાર.';
      hindiTranslation = 'मोनो और डाइग्लिसराइड्स (INS 471): मिश्रण को स्थिर और मुलायम रखने वाला इमल्सीफायर।';
    } else if (/412|guar gum/i.test(lower)) {
      standardizedName = 'Guar Gum (INS 412)';
      category = 'additive';
      purpose = 'Natural thickener and texture stabilizer';
      englishExplanation = 'Soluble plant fiber extracted from cluster beans (Cyamopsis tetragonoloba).';
      gujaratiTranslation = 'ગુવાર ગમ (INS 412): ગુવારના બીજમાંથી બનાવેલ પ્રાકૃતિક ઘટ્ટ કરનાર ગુંદર.';
      hindiTranslation = 'ग्वार गम (INS 412): ग्वार फली से प्राप्त प्राकृतिक गाढ़ा करने वाला फाइबर।';
    } else if (/508|potassium chloride/i.test(lower)) {
      standardizedName = 'Potassium Chloride (INS 508)';
      category = 'additive';
      purpose = 'Mineral salt and gelling stabilizer';
      englishExplanation = 'Naturally occurring mineral salt providing mineral firmness and electrolyte balance.';
      gujaratiTranslation = 'પોટેશિયમ ક્લોરાઇડ (INS 508): ખનિજ ક્ષાર જે નૂડલ્સ/ખોરાકને સ્થિરતા આપે છે.';
      hindiTranslation = 'पोटेशियम क्लोराइड (INS 508): खनिज लवण जो संरचना को स्थिरता प्रदान करता है।';
    } else if (/coriander/i.test(lower)) {
      standardizedName = 'Coriander Powder (Dhania)';
      category = 'spice';
      purpose = 'Aromatic ground spice';
      englishExplanation = 'Ground dried seeds of Coriandrum sativum giving a citrusy, herbal fragrance.';
      gujaratiTranslation = 'ધાણા પાવડર (ધાણાજીરું): સુગંધિત મસાલો.';
      hindiTranslation = 'धनिया पाउडर: सुगंधित एवं पाचक भारतीय मसाला।';
    } else if (/turmeric/i.test(lower)) {
      standardizedName = 'Turmeric Powder (Haldi)';
      category = 'spice';
      purpose = 'Golden botanical spice & natural pigment';
      englishExplanation = 'Ground rhizome of Curcuma longa providing warm flavor and golden color.';
      gujaratiTranslation = 'હળદર પાવડર: કુદરતી સોનેરી રંગ અને ઔષધીય ગુણ ધરાવતો મસાલો.';
      hindiTranslation = 'हल्दी पाउडर: प्राकृतिक रंग और औषधीय गुणों से भरपूर मसाला।';
    } else if (/chilli|pepper/i.test(lower)) {
      standardizedName = 'Chilli / Pepper Powder';
      category = 'spice';
      purpose = 'Spiciness and culinary heat';
      englishExplanation = 'Ground dried chili pepper contributing capsaicin and warmth to the seasoning.';
      gujaratiTranslation = 'મરચું પાવડર: તીખાશ અને લાલ રંગ આપતો મસાલો.';
      hindiTranslation = 'मिर्च पाउडर: तीखापन और स्वाद देने वाला मसाला।';
    } else if (/milk|whey|casein|dairy/i.test(lower)) {
      standardizedName = 'Dairy Milk Solids';
      category = 'dairy';
      purpose = 'Protein, milky taste and browning';
      englishExplanation = 'Dehydrated dairy milk proteins and lactose contributing rich flavor and texture.';
      gujaratiTranslation = 'દૂધના ઘન તત્વો (મિલ્ક સોલિડ્સ): સમૃદ્ધ સ્વાદ અને પૌષ્ટિકતા માટે.';
      hindiTranslation = 'दुग्ध ठोस (मिल्क सॉलिड्स): समृद्ध स्वाद और पोषण प्रदान करने हेतु।';
    }

    return {
      originalName: clean,
      standardizedName,
      englishExplanation,
      gujaratiTranslation,
      hindiTranslation,
      purpose,
      category,
      source: 'package_declaration',
      confidence: 'high',
    };
  });
}

/**
 * Local rule-based Jain inspection engine for high-speed offline/resilient checking
 */
// Helper to extract balanced bracketed sub-ingredients following a compound term
function extractCompoundSubIngredients(
  text: string,
  termEndIndex: number
): { subText: string; openBracket: string; closeBracket: string } | null {
  const rest = text.slice(termEndIndex);
  // Match optional whitespace, optional colon, percentage like 5%, hyphen
  const match = rest.match(/^\s*(?::|\d+(?:\.\d+)?%|-)?\s*([([{])/);
  if (!match || match.index === undefined) return null;

  const openBracket = match[1];
  const closeBracket = openBracket === '(' ? ')' : openBracket === '[' ? ']' : '}';
  const openBracketPos = termEndIndex + match.index + match[0].length - 1;

  let depth = 1;
  let i = openBracketPos + 1;
  while (i < text.length && depth > 0) {
    if (text[i] === openBracket) depth++;
    else if (text[i] === closeBracket) depth--;
    if (depth === 0) break;
    i++;
  }

  if (depth === 0) {
    const subText = text.substring(openBracketPos + 1, i).trim();
    return { subText, openBracket, closeBracket };
  }
  return null;
}

/**
 * Checks if the ingredient declaration is missing, incomplete, truncated, or unreadable.
 */
function evaluateIngredientCompleteness(rawText: string): {
  isMissing: boolean;
  isIncomplete: boolean;
  reason?: string;
  reasonGu?: string;
  reasonHi?: string;
} {
  const trimmed = rawText.trim();
  const lower = trimmed.toLowerCase();

  // Missing or completely absent checks
  const missingPhrases = [
    'none',
    'n/a',
    'not available',
    'not specified',
    'not declared',
    'ingredients not available',
    'see packaging',
    'see package',
    'refer pack',
    'null',
    'undefined',
  ];
  if (!trimmed || trimmed.length === 0 || missingPhrases.includes(lower)) {
    return {
      isMissing: true,
      isIncomplete: true,
      reason: 'Ingredient declaration is missing or not provided in the product data.',
      reasonGu: 'ઉત્પાદન ડેટામાં ઘટકોની યાદી ઉપલબ્ધ નથી.',
      reasonHi: 'उत्पाद डेटा में सामग्री सूची उपलब्ध नहीं है।',
    };
  }

  // Trailing ellipsis indicating cut off text
  if (/\.{3,}$|…$/.test(trimmed)) {
    return {
      isMissing: false,
      isIncomplete: true,
      reason: 'Ingredient declaration appears cut off with trailing ellipsis ("..."). Full label is required to verify absence.',
      reasonGu: 'ઘટકોની યાદી અધૂરી છે અને અંતમાં "..." દર્શાવે છે. સંપૂર્ણ પેકેટ લખાણ જરૂરી છે.',
      reasonHi: 'सामग्री सूची अधूरी है और अंत में "..." दिखाई देता है। पूर्ण पैकेजिंग टेक्स्ट आवश्यक है।',
    };
  }

  // Explicit unreadable or obscured OCR tags
  if (/\[unreadable\]|\[cut off\]|\[obscured\]|\[blurry\]|\[illegible\]/i.test(trimmed)) {
    return {
      isMissing: false,
      isIncomplete: true,
      reason: 'Ingredient declaration contains unreadable or obscured words ([unreadable]). Complete label must be verified.',
      reasonGu: 'ઘટકોની યાદીમાં ન વંચાય તેવા અથવા અસ્પષ્ટ શબ્દો ([unreadable]) છે.',
      reasonHi: 'सामग्री सूची में अपठनीय या अस्पष्ट शब्द ([unreadable]) शामिल हैं।',
    };
  }

  // Dangling trailing conjunctions indicating truncated text
  if (/,\s*(?:and|etc\.?|more)\s*$/i.test(trimmed)) {
    return {
      isMissing: false,
      isIncomplete: true,
      reason: 'Ingredient declaration appears truncated at the end (dangling conjunction).',
      reasonGu: 'ઘટકોની યાદી અધૂરી રીતે પૂરી થયેલી લાગે છે.',
      reasonHi: 'सामग्री सूची अधूरी समाप्त होती प्रतीत होती है।',
    };
  }

  // Unclosed parentheses or brackets indicating truncated text
  let round = 0;
  let square = 0;
  let curly = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === '(') round++;
    else if (c === ')') round--;
    else if (c === '[') square++;
    else if (c === ']') square--;
    else if (c === '{') curly++;
    else if (c === '}') curly--;
  }
  if (round > 0 || square > 0 || curly > 0) {
    return {
      isMissing: false,
      isIncomplete: true,
      reason: 'Ingredient declaration has unclosed parentheses or brackets, indicating the text was cut off.',
      reasonGu: 'ઘટકોની યાદીમાં અધૂરા કૌંસ છે, જે દર્શાવે છે કે લખાણ કપાઈ ગયું છે.',
      reasonHi: 'सामग्री सूची में खुले कोष्ठक हैं, जो दर्शाता है कि टेक्स्ट कटा हुआ है।',
    };
  }

  return { isMissing: false, isIncomplete: false };
}

/**
 * Local rule-based Jain inspection engine for high-speed offline/resilient checking.
 * Evaluates declared ingredients for onion, garlic, compound seasonings, and completeness.
 */
export function inspectJainSuitabilityLocally(text: string, preferences: any = {}): {
  status: 'FOUND' | 'NOT_FOUND_IN_AVAILABLE_DATA' | 'NEEDS_VERIFICATION';
  onionDetected: boolean;
  garlicDetected: boolean;
  detectedKeywords: string[];
  ambiguousIngredients: string[];
  evidence: Array<{
    term: string;
    category: 'onion' | 'garlic' | 'compound' | 'animal' | 'other';
    description: string;
    contextSnippet?: string;
  }>;
  isMissingIngredients: boolean;
  disclaimer: string;
  explanationEn: string;
  explanationGu: string;
  explanationHi: string;
  recommendation: string;
  needsVerificationReason?: string;
} {
  const rawText = (text || '').trim();
  const lower = rawText.toLowerCase();

  // 1. Evaluate completeness & missing status
  const completeness = evaluateIngredientCompleteness(rawText);
  if (completeness.isMissing) {
    return {
      status: 'NEEDS_VERIFICATION',
      onionDetected: false,
      garlicDetected: false,
      detectedKeywords: [],
      ambiguousIngredients: [],
      evidence: [],
      isMissingIngredients: true,
      needsVerificationReason: completeness.reason,
      disclaimer:
        'Never treat missing database information as proof of absence. Never claim that a product is Jain-certified or Jain-compliant without reliable evidence.',
      explanationEn:
        'No ingredient declaration is available for this product in the database. Missing information does not imply absence of onion or garlic. Please capture or upload a photo of the physical packaging label.',
      explanationGu:
        'આ ઉત્પાદન માટે ડેટાબેઝમાં કોઈ ઘટક યાદી ઉપલબ્ધ નથી. માહિતીનો અભાવ એ ડુંગળી કે લસણની ગેરહાજરી સાબિત કરતો નથી. કૃપા કરીને પેકેટનો ફોટો અપલોડ કરો.',
      explanationHi:
        'इस उत्पाद के लिए डेटाबेस में कोई सामग्री सूची उपलब्ध नहीं है। जानकारी का अभाव प्याज या लहसुन की अनुपस्थिति का प्रमाण नहीं है। कृपया पैकेजिंग का फोटो अपलोड करें।',
      recommendation: 'Scan or photograph the physical packaging ingredients label before consuming.',
    };
  }

  // Comprehensive declared onion variants
  const onionPatterns = [
    'dehydrated onion',
    'onion powder',
    'dried onion',
    'onion flakes',
    'onion extract',
    'onion salt',
    'onion paste',
    'onion puree',
    'spring onion',
    'green onion',
    'shallot',
    'shallots',
    'scallion',
    'scallions',
    'chive',
    'chives',
    'leek',
    'leeks',
    'pyaz',
    'kanda',
    'dungri',
    'allium cepa',
    'onion',
    'onions',
  ];

  // Comprehensive declared garlic variants
  const garlicPatterns = [
    'dehydrated garlic',
    'garlic powder',
    'dried garlic',
    'garlic flakes',
    'garlic extract',
    'garlic paste',
    'garlic oil',
    'garlic salt',
    'lahsun',
    'lasan',
    'allium sativum',
    'garlic',
    'garlics',
  ];

  // Generic compound seasoning / flavoring terms that may conceal alliums if unexplained
  const compoundPatterns = [
    'masala tastemaker',
    'tastemaker',
    'mixed spices',
    'spice mix',
    'spice blend',
    'seasoning mix',
    'seasoning',
    'seasonings',
    'masala blend',
    'curry powder',
    'soup base',
    'condiments',
    'spice extracts',
    'natural flavours',
    'natural flavour',
    'natural flavor',
    'natural flavors',
    'artificial flavours',
    'artificial flavour',
    'artificial flavor',
    'artificial flavors',
    'flavouring',
    'flavoring',
    'flavourings',
    'flavorings',
  ];

  const evidence: Array<{
    term: string;
    category: 'onion' | 'garlic' | 'compound' | 'animal' | 'other';
    description: string;
    contextSnippet?: string;
  }> = [];

  const detectedKeywords: string[] = [];
  const ambiguousIngredients: string[] = [];

  // Helper to extract surrounding text context
  const getSnippet = (term: string) => {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx === -1) return '';
    const start = Math.max(0, idx - 30);
    const end = Math.min(rawText.length, idx + term.length + 30);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < rawText.length ? '...' : '';
    return `${prefix}${rawText.substring(start, end).trim()}${suffix}`;
  };

  // 2. Check explicitly declared onion in entire text (including sub-ingredients)
  let onionDetected = false;
  for (const term of onionPatterns) {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lower)) {
      onionDetected = true;
      if (!detectedKeywords.includes(term)) {
        detectedKeywords.push(term);
        evidence.push({
          term,
          category: 'onion',
          description: `Explicitly declared onion or allium derivative: "${term}"`,
          contextSnippet: getSnippet(term),
        });
      }
    }
  }

  // 3. Check explicitly declared garlic in entire text (including sub-ingredients)
  let garlicDetected = false;
  for (const term of garlicPatterns) {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lower)) {
      garlicDetected = true;
      if (!detectedKeywords.includes(term)) {
        detectedKeywords.push(term);
        evidence.push({
          term,
          category: 'garlic',
          description: `Explicitly declared garlic or allium derivative: "${term}"`,
          contextSnippet: getSnippet(term),
        });
      }
    }
  }

  // 4. Analyse compound seasonings and distinguish explained vs unexplained composition
  // Requirement 5: Do not automatically flag every product containing a compound ingredient if its full composition is available.
  const processedCompoundIndices = new Set<number>();

  for (const term of compoundPatterns) {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(lower)) !== null) {
      const matchIndex = match.index;
      if (processedCompoundIndices.has(matchIndex)) continue;
      processedCompoundIndices.add(matchIndex);

      const termEnd = matchIndex + match[0].length;
      const subInfo = extractCompoundSubIngredients(rawText, termEnd);

      if (subInfo && subInfo.subText && subInfo.subText.length > 2) {
        // Compound ingredient HAS sub-ingredient breakdown (e.g. "Seasoning (rock salt, pepper, mint)")
        // Check if the sub-ingredients list is complete or truncated
        const subLower = subInfo.subText.toLowerCase();
        const subHasEllipsis = /\.{3,}$|…$/.test(subInfo.subText);

        if (subHasEllipsis) {
          if (!ambiguousIngredients.includes(match[0])) {
            ambiguousIngredients.push(match[0]);
            evidence.push({
              term: match[0],
              category: 'compound',
              description: `Compound ingredient with truncated sub-ingredient declaration: "${match[0]} (${subInfo.subText})"`,
              contextSnippet: getSnippet(match[0]),
            });
          }
        } else {
          // Full composition is available!
          // We already checked the entire text for onion and garlic above.
          // If neither onion nor garlic is present in subLower, this compound ingredient is EXPLAINED and verified.
          evidence.push({
            term: match[0],
            category: 'compound',
            description: `Declared compound ingredient with full composition: "${match[0]} (${subInfo.subText})"`,
            contextSnippet: getSnippet(match[0]),
          });
        }
      } else {
        // Compound ingredient has NO sub-ingredient breakdown (e.g. "peri-peri seasoning", "mixed spices")
        // This is an unexplained compound seasoning that requires verification.
        if (!ambiguousIngredients.includes(match[0])) {
          ambiguousIngredients.push(match[0]);
          evidence.push({
            term: match[0],
            category: 'compound',
            description: `Unexplained compound seasoning without declared sub-ingredient breakdown: "${match[0]}" (commercial seasonings frequently contain allium powders)`,
            contextSnippet: getSnippet(match[0]),
          });
        }
      }
    }
  }

  // 5. Determine strict 3-tier status and exact reason
  let status: 'FOUND' | 'NOT_FOUND_IN_AVAILABLE_DATA' | 'NEEDS_VERIFICATION' = 'NOT_FOUND_IN_AVAILABLE_DATA';
  let needsVerificationReason: string | undefined = undefined;

  if (onionDetected || garlicDetected) {
    status = 'FOUND';
  } else if (completeness.isIncomplete) {
    status = 'NEEDS_VERIFICATION';
    needsVerificationReason = completeness.reason;
  } else if (ambiguousIngredients.length > 0) {
    status = 'NEEDS_VERIFICATION';
    needsVerificationReason = `Contains unexplained compound seasoning or flavoring (${ambiguousIngredients.join(
      ', '
    )}) without a declared sub-ingredient breakdown. Commercial seasonings frequently contain dehydrated allium powders.`;
  } else {
    // Complete ingredient list containing no onion, garlic, or unexplained compound seasonings
    status = 'NOT_FOUND_IN_AVAILABLE_DATA';
  }

  // 6. Formulate precise localized explanations
  let explanationEn = '';
  let explanationGu = '';
  let explanationHi = '';

  if (status === 'FOUND') {
    const foundTermsStr = detectedKeywords.join(', ');
    explanationEn = `Onion or garlic is explicitly declared in the available ingredients (${foundTermsStr}). This product does not meet Jain dietary requirements.`;
    explanationGu = `ઉપલબ્ધ ઘટકોમાં ડુંગળી અથવા લસણ સ્પષ્ટપણે નોંધાયેલ છે (${foundTermsStr}). આ ઉત્પાદન જૈન આહાર નિયમો અનુસાર અનુકૂળ નથી.`;
    explanationHi = `उपलब्ध सामग्री में प्याज या लहसुन स्पष्ट रूप से घोषित है (${foundTermsStr})। यह उत्पाद जैन आहार नियमों के अनुकूल नहीं है।`;
  } else if (status === 'NEEDS_VERIFICATION') {
    if (ambiguousIngredients.length > 0) {
      const ambigStr = ambiguousIngredients.join(', ');
      explanationEn = `Contains unexplained compound seasoning or flavoring (${ambigStr}) without a declared sub-ingredient breakdown. Commercial seasoning mixes frequently contain dehydrated onion or garlic powders unless authenticated with a verified Jain symbol.`;
      explanationGu = `આમાં પેટા-ઘટકોની વિગત વગરના સંયુક્ત મસાલા (${ambigStr}) છે. પ્રમાણપત્ર વિના આવા મસાલા મિશ્રણમાં ડુંગળી/લસણનો પાવડર હોવાની સંભાવના રહે છે.`;
      explanationHi = `इसमें बिना घोषित उप-सामग्री वाला मिश्रित मसाला (${ambigStr}) शामिल है। प्रमाणित हुए बिना ऐसे मसाला मिश्रणों में प्याज/लहसुन पाउडर होने की संभावना रहती है।`;
    } else {
      explanationEn =
        completeness.reason ||
        'The available ingredient text is incomplete or partially truncated. Absence of onion and garlic cannot be verified without complete packaging evidence.';
      explanationGu =
        completeness.reasonGu ||
        'ઉપલબ્ધ ઘટક લખાણ અધૂરું અથવા કપાયેલું છે. પેકેટના સંપૂર્ણ પુરાવા વિના ડુંગળી/લસણની ગેરહાજરી ચકાસી શકાતી નથી.';
      explanationHi =
        completeness.reasonHi ||
        'उपलब्ध सामग्री पाठ अधूरा या कटा हुआ है। पूर्ण पैकेजिंग साक्ष्य के बिना प्याज/लहसुन की अनुपस्थिति की पुष्टि नहीं की जा सकती।';
    }
  } else {
    explanationEn = `No explicit onion, garlic, or declared allium variations were found in the inspected ingredient text. (Note: This indicates absence in available text, not a laboratory test or official Jain certification).`;
    explanationGu = `તપાસેલ ઘટકોની યાદીમાં ડુંગળી, લસણ કે તેના પાઉડરનો સ્પષ્ટ ઉલ્લેખ નથી મળ્યો. (નોંધ: આ ઉપલબ્ધ લખાણમાં ગેરહાજરી દર્શાવે છે, લેબ ટેસ્ટ કે સત્તાવાર જૈન પ્રમાણપત્ર નહીં).`;
    explanationHi = `जांची गई सामग्री सूची में प्याज, लहसुन या उनके पाउडर का स्पष्ट उल्लेख नहीं मिला। (नोट: यह उपलब्ध डेटा में अनुपस्थिति दर्शाता है, प्रयोगशाला परीक्षण या आधिकारिक जैन प्रमाणीकरण नहीं)।`;
  }

  return {
    status,
    onionDetected,
    garlicDetected,
    detectedKeywords,
    ambiguousIngredients,
    evidence,
    isMissingIngredients: false,
    disclaimer:
      'Never treat missing database information as proof of absence. Never claim that a product is Jain-certified or Jain-compliant without reliable evidence.',
    explanationEn,
    explanationGu,
    explanationHi,
    recommendation:
      status === 'FOUND'
        ? 'Avoid this product if following a strict Jain diet.'
        : status === 'NEEDS_VERIFICATION'
        ? 'Verify ingredients with the manufacturer or check for an official Jain dietary certification symbol.'
        : 'Review the complete physical package label before consumption.',
    needsVerificationReason,
  };
}
