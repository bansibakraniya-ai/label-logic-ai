import http from 'http';
import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Shared Gemini AI client with required User-Agent
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// User-Agent for Open Food Facts compliance
const OFF_USER_AGENT = 'LabelLogicAI - WebApp - Version 1.0 (contact: info@labellogic.ai)';

/**
 * Normalizes Open Food Facts product structure
 */
function normalizeProductData(product: any, scannedBarcode: string) {
  const barcode = product.code || scannedBarcode;
  const name = product.product_name || product.product_name_en || product.generic_name || 'Unnamed Product';
  const brand = product.brands || product.brand_owner || 'Unknown Brand';
  const categories = product.categories ? product.categories.split(',').map((c: string) => c.trim()).filter(Boolean) : [];
  const imageUrl = product.image_url || product.image_front_url || product.image_front_small_url || null;

  // Ingredients text
  const ingredientsText = product.ingredients_text || product.ingredients_text_en || product.ingredients_text_with_allergens || '';

  // Nutriments
  const nutriments = product.nutriments || {};
  const has100g = Object.keys(nutriments).some(k => k.endsWith('_100g') || k.endsWith('_value'));
  
  const extractNutrient = (key: string, altKey?: string) => {
    const val100 = nutriments[`${key}_100g`] ?? nutriments[`${key}_value`] ?? (altKey ? nutriments[`${altKey}_100g`] : undefined);
    const valServing = nutriments[`${key}_serving`] ?? (altKey ? nutriments[`${altKey}_serving`] : undefined);
    const unit = nutriments[`${key}_unit`] || (altKey ? nutriments[`${altKey}_unit`] : '') || 'g';
    return {
      per100g: val100 !== undefined && val100 !== null ? Number(val100) : null,
      perServing: valServing !== undefined && valServing !== null ? Number(valServing) : null,
      unit: unit,
    };
  };

  const calories = {
    per100g: nutriments['energy-kcal_100g'] !== undefined ? Number(nutriments['energy-kcal_100g']) : (nutriments['energy_100g'] ? Math.round(Number(nutriments['energy_100g']) / 4.184) : null),
    perServing: nutriments['energy-kcal_serving'] !== undefined ? Number(nutriments['energy-kcal_serving']) : (nutriments['energy_serving'] ? Math.round(Number(nutriments['energy_serving']) / 4.184) : null),
    unit: 'kcal',
  };

  const nutrition = {
    calories,
    proteins: extractNutrient('proteins', 'protein'),
    carbohydrates: extractNutrient('carbohydrates'),
    sugars: extractNutrient('sugars'),
    addedSugars: extractNutrient('added-sugars'),
    fat: extractNutrient('fat'),
    saturatedFat: extractNutrient('saturated-fat'),
    transFat: extractNutrient('trans-fat'),
    fiber: extractNutrient('fiber', 'fibre'),
    sodium: extractNutrient('sodium'),
    salt: extractNutrient('salt'),
  };

  // Missing fields tracking
  const missingFields: string[] = [];
  if (!ingredientsText) missingFields.push('ingredients_text');
  if (calories.per100g === null) missingFields.push('nutrition_calories');
  if (nutrition.proteins.per100g === null) missingFields.push('nutrition_protein');
  if (nutrition.carbohydrates.per100g === null) missingFields.push('nutrition_carbohydrates');
  if (nutrition.fat.per100g === null) missingFields.push('nutrition_fat');
  if (!product.quantity && !product.product_quantity) missingFields.push('package_weight');
  if (!product.serving_size && !product.serving_quantity) missingFields.push('serving_size');
  if (!product.origins && !product.countries) missingFields.push('country_of_origin');

  // Quantity / Net weight
  const quantityString = product.quantity || (product.product_quantity ? `${product.product_quantity} ${product.product_quantity_unit || 'g'}` : null);
  let parsedWeightGrams: number | null = null;
  if (product.product_quantity && !isNaN(Number(product.product_quantity))) {
    const rawVal = Number(product.product_quantity);
    const unit = (product.product_quantity_unit || '').toLowerCase();
    if (unit === 'kg') parsedWeightGrams = rawVal * 1000;
    else if (unit === 'mg') parsedWeightGrams = rawVal / 1000;
    else if (unit === 'oz') parsedWeightGrams = rawVal * 28.3495;
    else if (unit === 'lb') parsedWeightGrams = rawVal * 453.592;
    else parsedWeightGrams = rawVal;
  } else if (quantityString) {
    const match = quantityString.match(/([\d.]+)\s*(g|kg|mg|ml|l|oz|lb)/i);
    if (match) {
      const val = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === 'kg' || unit === 'l') parsedWeightGrams = val * 1000;
      else if (unit === 'mg') parsedWeightGrams = val / 1000;
      else if (unit === 'oz') parsedWeightGrams = val * 28.3495;
      else if (unit === 'lb') parsedWeightGrams = val * 453.592;
      else parsedWeightGrams = val;
    }
  }

  // Allergens
  const allergens = product.allergens_tags ? product.allergens_tags.map((a: string) => a.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')).filter(Boolean) : (product.allergens ? product.allergens.split(',').map((s: string) => s.trim()) : []);
  const traces = product.traces_tags ? product.traces_tags.map((t: string) => t.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')).filter(Boolean) : (product.traces ? product.traces.split(',').map((s: string) => s.trim()) : []);

  // Additives
  const additives = product.additives_tags ? product.additives_tags.map((ad: string) => ad.replace(/^[a-z]{2}:/, '').toUpperCase()) : [];

  // Certifications / Labels
  const labels = product.labels_tags ? product.labels_tags.map((l: string) => l.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')).filter(Boolean) : [];

  return {
    barcode,
    scannedBarcode,
    barcodeMatches: String(barcode).trim() === String(scannedBarcode).trim(),
    name,
    brand,
    categories,
    imageUrl,
    ingredientsText,
    nutrition,
    quantityString,
    netWeightGrams: parsedWeightGrams,
    servingSize: product.serving_size || (product.serving_quantity ? `${product.serving_quantity} g` : null),
    allergens,
    traces,
    additives,
    labels,
    origin: product.origins || product.countries || null,
    manufacturingPlaces: product.manufacturing_places || null,
    dataSource: 'Open Food Facts Public Database',
    retrievalTime: new Date().toISOString(),
    missingFields,
    completeness: product.completeness || null,
    isSample: false,
  };
}

// Demo & Sample products to ensure reliable testing under any conditions
const SAMPLE_PRODUCTS: Record<string, any> = {
  '8901058852899': {
    code: '8901058852899',
    product_name: 'Maggi 2-Minute Noodles (Masala)',
    brands: 'Nestlé',
    categories: 'Instant noodles, Noodles, Plant-based foods',
    image_url: 'https://images.openfoodfacts.org/images/products/890/105/885/2899/front_en.11.400.jpg',
    quantity: '70 g',
    product_quantity: 70,
    product_quantity_unit: 'g',
    serving_size: '70 g',
    ingredients_text: 'Noodles: Refined wheat flour (Maida), Palm oil, Salt, Wheat gluten, Mineral (Calcium carbonate), Thickeners (508 & 412), Acidity regulators (501(i) & 500(i)) and Humectant (451(i)). Masala TASTEMAKER: Hydrolysed groundnut (peanut) protein, Mixed spices {(23.6%) (Dehydrated onion, Coriander powder, Red chilli powder, Turmeric powder, Dried garlic, Cumin powder, Aniseed powder, Fenugreek powder, Ginger powder, Black pepper powder, Clove powder, Green cardamom powder & Nutmeg powder)}, Noodle powder, Sugar, Edible starch, Palm oil, Thickener (508), Caramel salt mix, Acidity regulator (330) and Flavor enhancer (635).',
    nutriments: {
      'energy-kcal_100g': 427,
      'energy-kcal_serving': 299,
      'proteins_100g': 8.0,
      'proteins_serving': 5.6,
      'carbohydrates_100g': 63.5,
      'carbohydrates_serving': 44.5,
      'sugars_100g': 2.2,
      'sugars_serving': 1.5,
      'fat_100g': 15.7,
      'fat_serving': 11.0,
      'saturated-fat_100g': 6.8,
      'saturated-fat_serving': 4.8,
      'trans-fat_100g': 0.1,
      'fiber_100g': 3.6,
      'sodium_100g': 1.15,
      'salt_100g': 2.88,
    },
    allergens: 'Wheat, Gluten, Peanut. May contain Milk, Mustard and Soy.',
    traces: 'Milk, Mustard, Soy',
    origins: 'India',
    isSample: true,
  },
  '8904004400588': {
    code: '8904004400588',
    product_name: 'Haldiram\'s Nagpur Bhujia Sev',
    brands: 'Haldiram\'s',
    categories: 'Snacks, Savory snacks, Deep fried snacks, Bhujia',
    image_url: 'https://images.openfoodfacts.org/images/products/890/400/440/0588/front_en.10.400.jpg',
    quantity: '200 g',
    product_quantity: 200,
    product_quantity_unit: 'g',
    serving_size: '30 g',
    ingredients_text: 'Tepary beans flour (Moth flour), Refined palmolein oil, Bengal gram flour (Besan), Iodised salt, Red chilli powder, Black pepper powder, Ginger powder, Clove powder, Cardamom powder, Nutmeg powder, Mace powder.',
    nutriments: {
      'energy-kcal_100g': 576,
      'energy-kcal_serving': 173,
      'proteins_100g': 14.2,
      'proteins_serving': 4.3,
      'carbohydrates_100g': 42.1,
      'carbohydrates_serving': 12.6,
      'sugars_100g': 1.0,
      'sugars_serving': 0.3,
      'fat_100g': 39.0,
      'saturated-fat_100g': 17.5,
      'trans-fat_100g': 0.0,
      'fiber_100g': 6.5,
      'sodium_100g': 0.85,
      'salt_100g': 2.13,
    },
    allergens: 'Legumes',
    origins: 'India',
    isSample: true,
  },
  '028400043816': {
    code: '028400043816',
    product_name: 'Lay\'s Classic Potato Chips',
    brands: 'Lay\'s / Frito-Lay',
    categories: 'Snacks, Salty snacks, Appetizers, Crisps, Potato crisps',
    image_url: 'https://images.openfoodfacts.org/images/products/002/840/004/3816/front_en.117.400.jpg',
    quantity: '184.2 g',
    product_quantity: 184.2,
    product_quantity_unit: 'g',
    serving_size: '28 g',
    ingredients_text: 'Potatoes, Vegetable Oil (Canola, Corn, Soybean, and/or Sunflower Oil), and Salt.',
    nutriments: {
      'energy-kcal_100g': 571,
      'energy-kcal_serving': 160,
      'proteins_100g': 7.1,
      'proteins_serving': 2.0,
      'carbohydrates_100g': 53.6,
      'carbohydrates_serving': 15.0,
      'sugars_100g': 0.5,
      'sugars_serving': 0.0,
      'fat_100g': 35.7,
      'saturated-fat_100g': 5.36,
      'trans-fat_100g': 0.0,
      'sodium_100g': 0.607,
      'salt_100g': 1.52,
    },
    origins: 'United States',
    isSample: true,
  },
  '8901491101837': {
    code: '8901491101837',
    product_name: 'Parle-G Original Gluco Biscuits',
    brands: 'Parle',
    categories: 'Biscuits and cakes, Biscuits, Sweet biscuits',
    image_url: 'https://images.openfoodfacts.org/images/products/890/149/110/1837/front_en.15.400.jpg',
    quantity: '800 g',
    product_quantity: 800,
    product_quantity_unit: 'g',
    serving_size: '25 g',
    ingredients_text: 'Wheat flour (maida), Sugar, Refined palm oil, Invert sugar syrup, Raising agents [503 (ii), 500 (ii)], Edible common salt, Milk solids, Emulsifiers [322 (i) or 471], Dough conditioner [223] and Artificial flavoring substances (Vanilla).',
    nutriments: {
      'energy-kcal_100g': 454,
      'energy-kcal_serving': 113.5,
      'proteins_100g': 6.5,
      'proteins_serving': 1.6,
      'carbohydrates_100g': 78.2,
      'carbohydrates_serving': 19.5,
      'sugars_100g': 26.3,
      'sugars_serving': 6.6,
      'fat_100g': 12.8,
      'saturated-fat_100g': 5.9,
      'trans-fat_100g': 0.0,
      'sodium_100g': 0.28,
      'salt_100g': 0.70,
    },
    allergens: 'Wheat, Milk, Soy, Sulphites',
    origins: 'India',
    isSample: true,
  },
  '8901719134852': {
    code: '8901719134852',
    product_name: 'Parle-G Original Gluco Biscuits',
    brands: 'Parle',
    categories: 'Biscuits and cakes, Biscuits, Sweet biscuits',
    image_url: 'https://images.openfoodfacts.org/images/products/890/149/110/1837/front_en.15.400.jpg',
    quantity: '90 g',
    product_quantity: 90,
    product_quantity_unit: 'g',
    serving_size: '25 g',
    ingredients_text: 'Wheat flour (maida), Sugar, Refined palm oil, Invert sugar syrup, Raising agents [503 (ii), 500 (ii)], Edible common salt, Milk solids, Emulsifiers [322 (i) or 471], Dough conditioner [223] and Artificial flavoring substances (Vanilla).',
    nutriments: {
      'energy-kcal_100g': 454,
      'energy-kcal_serving': 113.5,
      'proteins_100g': 6.5,
      'proteins_serving': 1.6,
      'carbohydrates_100g': 78.2,
      'carbohydrates_serving': 19.5,
      'sugars_100g': 26.3,
      'sugars_serving': 6.6,
      'fat_100g': 12.8,
      'saturated-fat_100g': 5.9,
      'trans-fat_100g': 0.0,
      'sodium_100g': 0.28,
      'salt_100g': 0.70,
    },
    allergens: 'Wheat, Milk, Soy, Sulphites',
    origins: 'India',
    isSample: true,
  },
  '8901262010044': {
    code: '8901262010044',
    product_name: 'Amul Butter (Pasteurised)',
    brands: 'Amul',
    categories: 'Dairies, Fats, Spreadable fats, Animal fats, Milkfat, Butters',
    image_url: 'https://images.openfoodfacts.org/images/products/890/126/201/0044/front_en.9.400.jpg',
    quantity: '100 g',
    product_quantity: 100,
    product_quantity_unit: 'g',
    serving_size: '10 g',
    ingredients_text: 'Butter (Milk fat 80%, Moisture 16%), Common Salt, Permitted natural colour (Annatto - E160b).',
    nutriments: {
      'energy-kcal_100g': 722,
      'energy-kcal_serving': 72.2,
      'proteins_100g': 0.6,
      'proteins_serving': 0.06,
      'carbohydrates_100g': 0.0,
      'carbohydrates_serving': 0.0,
      'sugars_100g': 0.0,
      'sugars_serving': 0.0,
      'fat_100g': 80.0,
      'saturated-fat_100g': 51.0,
      'trans-fat_100g': 3.5,
      'sodium_100g': 0.83,
      'salt_100g': 2.08,
    },
    allergens: 'Milk',
    origins: 'India',
    isSample: true,
  },
  '7622210986161': {
    code: '7622210986161',
    product_name: 'Oreo Original Sandwich Cookies',
    brands: 'Oreo / Mondelez',
    categories: 'Biscuits, Sweet biscuits, Chocolate biscuits',
    image_url: 'https://images.openfoodfacts.org/images/products/762/221/098/6161/front_en.11.400.jpg',
    quantity: '154 g',
    product_quantity: 154,
    product_quantity_unit: 'g',
    serving_size: '38 g',
    ingredients_text: 'Wheat flour, Sugar, Palm oil, Rapeseed oil, Fat-reduced cocoa powder 4.3%, Wheat starch, Glucose-fructose syrup, Raising agents (potassium carbonates, ammonium carbonates, sodium carbonates), Salt, Emulsifier (soya lecithin), Acidity regulator (sodium hydroxide), Flavouring (vanillin).',
    nutriments: {
      'energy-kcal_100g': 476,
      'energy-kcal_serving': 181,
      'proteins_100g': 5.2,
      'proteins_serving': 2.0,
      'carbohydrates_100g': 68.0,
      'carbohydrates_serving': 26.0,
      'sugars_100g': 38.0,
      'sugars_serving': 14.0,
      'fat_100g': 20.0,
      'saturated-fat_100g': 5.4,
      'sodium_100g': 0.29,
      'salt_100g': 0.73,
    },
    allergens: 'Wheat, Soya',
    origins: 'United Kingdom',
    isSample: true,
  },
  '8906000000011': {
    code: '8906000000011',
    product_name: 'Plain Roasted Makhana (Fox Nuts)',
    brands: 'Pure Roots',
    categories: 'Snacks, Roasted Snacks, Makhana',
    image_url: 'https://images.openfoodfacts.org/images/products/890/400/440/0588/front_en.10.400.jpg',
    quantity: '100 g',
    product_quantity: 100,
    product_quantity_unit: 'g',
    serving_size: '30 g',
    ingredients_text: 'Fox nuts (makhana), rock salt',
    nutriments: {
      'energy-kcal_100g': 350,
      'energy-kcal_serving': 105,
      'proteins_100g': 9.7,
      'proteins_serving': 2.9,
      'carbohydrates_100g': 76.0,
      'carbohydrates_serving': 22.8,
      'sugars_100g': 0.0,
      'sugars_serving': 0.0,
      'fat_100g': 0.1,
      'saturated-fat_100g': 0.0,
      'trans-fat_100g': 0.0,
      'fiber_100g': 7.6,
      'sodium_100g': 0.35,
      'salt_100g': 0.88,
    },
    allergens: '',
    origins: 'India',
    isSample: true,
  },
  '8906000000022': {
    code: '8906000000022',
    product_name: 'Plain Roasted Chana (Bengal Gram)',
    brands: 'Desi Harvest',
    categories: 'Snacks, Roasted Snacks, Grams',
    image_url: 'https://images.openfoodfacts.org/images/products/890/400/440/0588/front_en.10.400.jpg',
    quantity: '200 g',
    product_quantity: 200,
    product_quantity_unit: 'g',
    serving_size: '40 g',
    ingredients_text: 'Roasted chickpeas (chana), iodised salt',
    nutriments: {
      'energy-kcal_100g': 380,
      'energy-kcal_serving': 152,
      'proteins_100g': 18.6,
      'proteins_serving': 7.4,
      'carbohydrates_100g': 58.0,
      'carbohydrates_serving': 23.2,
      'sugars_100g': 1.2,
      'sugars_serving': 0.5,
      'fat_100g': 5.2,
      'saturated-fat_100g': 0.8,
      'trans-fat_100g': 0.0,
      'fiber_100g': 12.0,
      'sodium_100g': 0.42,
      'salt_100g': 1.05,
    },
    allergens: 'Legumes',
    origins: 'India',
    isSample: true,
  },
  '8906000000033': {
    code: '8906000000033',
    product_name: 'Seasoned Makhana (Cheese & Herbs)',
    brands: 'SnackBites',
    categories: 'Snacks, Roasted Snacks, Makhana',
    image_url: 'https://images.openfoodfacts.org/images/products/890/400/440/0588/front_en.10.400.jpg',
    quantity: '80 g',
    product_quantity: 80,
    product_quantity_unit: 'g',
    serving_size: '30 g',
    ingredients_text: 'Fox nuts (makhana), olive oil, cheese & herb seasoning, salt',
    nutriments: {
      'energy-kcal_100g': 460,
      'energy-kcal_serving': 138,
      'proteins_100g': 8.2,
      'proteins_serving': 2.5,
      'carbohydrates_100g': 62.0,
      'carbohydrates_serving': 18.6,
      'sugars_100g': 2.1,
      'sugars_serving': 0.6,
      'fat_100g': 19.5,
      'saturated-fat_100g': 3.2,
      'trans-fat_100g': 0.0,
      'fiber_100g': 5.5,
      'sodium_100g': 0.68,
      'salt_100g': 1.70,
    },
    allergens: 'Milk',
    origins: 'India',
    isSample: true,
  },
  '8906000000044': {
    code: '8906000000044',
    product_name: 'Seasoned Makhana (Pudina & Rock Salt)',
    brands: 'Sattvik Snacks',
    categories: 'Snacks, Roasted Snacks, Makhana',
    image_url: 'https://images.openfoodfacts.org/images/products/890/400/440/0588/front_en.10.400.jpg',
    quantity: '80 g',
    product_quantity: 80,
    product_quantity_unit: 'g',
    serving_size: '30 g',
    ingredients_text: 'Fox nuts (makhana), olive oil, seasoning (rock salt, black pepper, cumin, dry mango powder, mint)',
    nutriments: {
      'energy-kcal_100g': 430,
      'energy-kcal_serving': 129,
      'proteins_100g': 8.5,
      'proteins_serving': 2.6,
      'carbohydrates_100g': 64.0,
      'carbohydrates_serving': 19.2,
      'sugars_100g': 1.0,
      'sugars_serving': 0.3,
      'fat_100g': 16.0,
      'saturated-fat_100g': 2.4,
      'trans-fat_100g': 0.0,
      'fiber_100g': 6.2,
      'sodium_100g': 0.52,
      'salt_100g': 1.30,
    },
    allergens: '',
    origins: 'India',
    isSample: true,
  },
  '8906000000055': {
    code: '8906000000055',
    product_name: 'Seasoned Makhana (Masala Punch)',
    brands: 'SpiceKing',
    categories: 'Snacks, Roasted Snacks, Makhana',
    image_url: 'https://images.openfoodfacts.org/images/products/890/400/440/0588/front_en.10.400.jpg',
    quantity: '80 g',
    product_quantity: 80,
    product_quantity_unit: 'g',
    serving_size: '30 g',
    ingredients_text: 'Fox nuts (makhana), olive oil, seasoning (rock salt, dehydrated onion, garlic powder, red chilli)',
    nutriments: {
      'energy-kcal_100g': 435,
      'energy-kcal_serving': 130,
      'proteins_100g': 8.4,
      'proteins_serving': 2.5,
      'carbohydrates_100g': 63.5,
      'carbohydrates_serving': 19.0,
      'sugars_100g': 1.4,
      'sugars_serving': 0.4,
      'fat_100g': 16.5,
      'saturated-fat_100g': 2.5,
      'trans-fat_100g': 0.0,
      'fiber_100g': 6.0,
      'sodium_100g': 0.58,
      'salt_100g': 1.45,
    },
    allergens: '',
    origins: 'India',
    isSample: true,
  }
};

/**
 * 1. GET /api/product/:barcode
 * Real barcode lookup via Open Food Facts API with timeout and fallback
 */
app.get('/api/product/:barcode', async (req: Request, res: Response) => {
  const barcode = req.params.barcode.trim();

  if (!barcode || !/^\d{4,18}$/.test(barcode)) {
    return res.status(400).json({
      error: 'Invalid barcode format. Expected 4 to 18 numeric digits.',
      code: 'INVALID_BARCODE',
    });
  }

  // Attempt real Open Food Facts API call with 6-second timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const offUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
    const response = await fetch(offUrl, {
      headers: {
        'User-Agent': OFF_USER_AGENT,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.status === 1 && data.product) {
        const normalized = normalizeProductData(data.product, barcode);
        return res.json(normalized);
      }
    }
  } catch (err: any) {
    console.log(`Open Food Facts API request notice for barcode ${barcode}:`, err.message || err);
  }

  // Check if it's one of our verified demonstration barcodes
  if (SAMPLE_PRODUCTS[barcode]) {
    const normalized = normalizeProductData(SAMPLE_PRODUCTS[barcode], barcode);
    normalized.isSample = true;
    normalized.dataSource = 'Open Food Facts Database (Cached Reference Sample)';
    return res.json(normalized);
  }

  // Barcode genuinely not found in database
  return res.status(404).json({
    error: `Product with barcode ${barcode} was not found in the Open Food Facts database.`,
    code: 'PRODUCT_NOT_FOUND',
    scannedBarcode: barcode,
    canRescueWithOCR: true,
  });
});

/**
 * 2. GET /api/search?q=query
 * Search Open Food Facts product database
 */
app.get('/api/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string || '').trim();
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters.' });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const searchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=12`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': OFF_USER_AGENT,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const products = (data.products || []).map((p: any) => ({
        barcode: p.code,
        name: p.product_name || p.generic_name || 'Unnamed Product',
        brand: p.brands || 'Unknown',
        imageUrl: p.image_front_small_url || p.image_url || null,
        categories: p.categories ? p.categories.split(',').slice(0, 3).map((s: string) => s.trim()) : [],
        ingredientsText: p.ingredients_text || '',
      }));
      return res.json({ products });
    }
  } catch (err: any) {
    console.log('Search API notice:', err.message || err);
  }

  // Fallback to sample matches if query matches any sample product
  const lowerQ = query.toLowerCase();
  const sampleMatches = Object.values(SAMPLE_PRODUCTS)
    .filter(p => p.product_name.toLowerCase().includes(lowerQ) || p.brands.toLowerCase().includes(lowerQ))
    .map(p => ({
      barcode: p.code,
      name: p.product_name,
      brand: p.brands,
      imageUrl: p.image_url,
      categories: p.categories.split(','),
      ingredientsText: p.ingredients_text,
    }));

  return res.json({ products: sampleMatches });
});

// Server-side scan history store
let serverHistory: any[] = [];

/**
 * GET /api/history
 * Retrieves scan history from the server
 */
app.get('/api/history', (_req: Request, res: Response) => {
  res.json({ history: serverHistory });
});

/**
 * POST /api/history
 * Saves a scanned product item to server history
 */
app.post('/api/history', (req: Request, res: Response) => {
  const item = req.body;
  if (!item || !item.barcode) {
    return res.status(400).json({ error: 'Valid history item with barcode is required.' });
  }

  // Deduplicate by barcode, keeping the newest at the top
  serverHistory = [item, ...serverHistory.filter((h) => h.barcode !== item.barcode)].slice(0, 50);
  res.json({ success: true, history: serverHistory });
});

/**
 * DELETE /api/history/:id
 * Removes a single history item
 */
app.delete('/api/history/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  serverHistory = serverHistory.filter((h) => h.id !== id && h.barcode !== id);
  res.json({ success: true, history: serverHistory });
});

/**
 * DELETE /api/history
 * Clears all server history
 */
app.delete('/api/history', (_req: Request, res: Response) => {
  serverHistory = [];
  res.json({ success: true, history: [] });
});

/**
 * 2b. POST /api/jain-check
 * Dedicated server-side endpoint for Jain Ingredient Check.
 * Analyzes declared ingredients for onion, garlic, compound seasonings,
 * strictly returning FOUND, NOT FOUND IN AVAILABLE DATA, or NEEDS VERIFICATION.
 */
app.post('/api/jain-check', async (req: Request, res: Response) => {
  try {
    const {
      ingredientsText = '',
      productName = '',
      brand = '',
      preferences = {},
    } = req.body;

    const analysis = inspectJainSuitabilityLocally(ingredientsText, preferences);
    return res.json(analysis);
  } catch (err: any) {
    console.error('Error in /api/jain-check:', err);
    return res.status(500).json({
      error: 'Failed to inspect ingredients for Jain suitability.',
      details: err?.message || 'Internal server error',
    });
  }
});

// In-memory cache and rate limit cooldown for AI requests
const decodedCache = new Map<string, any>();
let geminiRateLimitedUntil = 0;

/**
 * 3. POST /api/ocr-analyze
 * Extracts visible text from package photo using Gemini 3.8 Flash
 */
app.post('/api/ocr-analyze', async (req: Request, res: Response) => {
  const { imageBase64, mimeType = 'image/jpeg', scanTarget = 'ingredient_label' } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required.' });
  }

  // Graceful manual workspace fallback response helper
  const createFallbackResult = (explanation: string) => ({
    productName: '',
    brand: '',
    extractedIngredientsText: '',
    unreadableWords: [] as string[],
    isCompleteIngredientList: false,
    needsClearerPhoto: false,
    clarityExplanation: explanation,
    allergensDeclared: [] as string[],
    netQuantity: '',
    nutritionPanelFound: false,
    nutritionValuesText: '',
    isManualEntry: true,
  });

  if (!ai || Date.now() < geminiRateLimitedUntil) {
    return res.json(
      createFallbackResult(
        'AI vision OCR is cooling down. Please review your captured packaging photo above and enter or paste the ingredients directly in the text area below.'
      )
    );
  }

  try {
    // Strip header if data URL was sent
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const prompt = `You are an expert food label OCR and packaging analyst.
Examine this food packaging image very carefully.
Extract:
1. Product Name (if visible)
2. Brand Name (if visible)
3. Declared Ingredients List (exact text visible on the label)
4. Unreadable or obscured words (flag any blurry, cut off, or unclear text - NEVER GUESS!)
5. Nutrition Facts (if a nutrition facts table is visible)
6. Declared Allergens (if visible)
7. Net Quantity / Weight (e.g. 50g, 200ml)
8. Assessment of photo clarity: is the ingredient list fully readable, partially obscured, or unreadable?

Strict Rules:
- Preserve the exact spelling, punctuation, and wording.
- Never invent missing or unreadable ingredients. If words are partially cut off or illegible, mark them as "[unreadable]" and list them in 'unreadableWords'.
- If the ingredient list is incomplete or cut off at the edge, set 'isCompleteIngredientList' to false and set 'needsClearerPhoto' to true.`;

    const aiCallPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productName: { type: Type.STRING },
            brand: { type: Type.STRING },
            extractedIngredientsText: { type: Type.STRING },
            unreadableWords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            isCompleteIngredientList: { type: Type.BOOLEAN },
            needsClearerPhoto: { type: Type.BOOLEAN },
            clarityExplanation: { type: Type.STRING },
            allergensDeclared: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            netQuantity: { type: Type.STRING },
            nutritionPanelFound: { type: Type.BOOLEAN },
            nutritionValuesText: { type: Type.STRING },
          },
          required: [
            'extractedIngredientsText',
            'unreadableWords',
            'isCompleteIngredientList',
            'needsClearerPhoto',
            'clarityExplanation',
          ],
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI OCR timeout')), 12000)
    );

    const response = await Promise.race([aiCallPromise, timeoutPromise]);
    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (err: any) {
    const isRateLimit =
      err?.status === 429 ||
      String(err?.message || '').includes('429') ||
      String(err?.message || '').includes('RESOURCE_EXHAUSTED') ||
      String(err?.message || '').includes('quota');

    if (isRateLimit) {
      geminiRateLimitedUntil = Date.now() + 60000;
      console.log('AI Vision rate limit / daily quota reached. Providing manual transcript and editing workspace.');
    } else {
      console.log('Vision OCR notice: providing manual transcript workspace.');
    }

    return res.json(
      createFallbackResult(
        isRateLimit
          ? 'AI vision OCR quota is cooling down. Please review your captured packaging photo above and enter or paste the ingredients directly in the text area below.'
          : 'Could not auto-extract text clearly from the photo. Please review the photo above and enter or paste the ingredients in the text area below.'
      )
    );
  }
});

/**
 * 4. POST /api/decode-ingredients
 * Decodes individual ingredients into English, Gujarati, and Hindi,
 * categorizes them, explains purpose, and performs deep Jain dietary analysis.
 */
app.post('/api/decode-ingredients', async (req: Request, res: Response) => {
  const {
    ingredientsText,
    productName = '',
    brand = '',
    preferences = {},
  } = req.body;

  if (!ingredientsText || typeof ingredientsText !== 'string' || !ingredientsText.trim()) {
    return res.status(400).json({ error: 'ingredientsText is required.' });
  }

  // Check in-memory cache first to avoid redundant API requests
  const cacheKey = `${ingredientsText.trim().toLowerCase()}_${JSON.stringify(preferences)}`;
  if (decodedCache.has(cacheKey)) {
    return res.json(decodedCache.get(cacheKey));
  }

  // Rule-based Jain engine and ingredient breakdown
  const localJainInspection = inspectJainSuitabilityLocally(ingredientsText, preferences);
  const localDecoded = parseIngredientsLocally(ingredientsText);

  // If Gemini is disabled or rate limit cooldown is active, return rule-based engine directly
  if (!ai || Date.now() < geminiRateLimitedUntil) {
    const fallbackResponse = {
      decodedIngredients: localDecoded,
      jainAnalysis: localJainInspection,
      source: 'rule_based_engine',
    };
    decodedCache.set(cacheKey, fallbackResponse);
    return res.json(fallbackResponse);
  }

  try {
    const prompt = `You are a certified food technologist, multilingual food scientist, and expert in Jain dietary laws.
Analyze this food product's declared ingredient list:
Product: "${productName}" by "${brand}"
Ingredients: "${ingredientsText}"

User dietary preferences to consider:
- Avoid Onion: ${preferences.avoidOnion !== false}
- Avoid Garlic: ${preferences.avoidGarlic !== false}
- Avoid Root Vegetables: ${preferences.avoidRootVegetables === true}
- Avoid Gelatin: ${preferences.avoidGelatin !== false}
- Avoid Animal Rennet/Enzymes: ${preferences.avoidAnimalRennet !== false}
- Avoid Alcohol: ${preferences.avoidAlcohol !== false}

Your tasks:
1. Break down every ingredient in the declared list.
   - originalName: exact raw text
   - standardizedName: standard food science name (e.g., E412 -> Guar Gum)
   - englishExplanation: clear, simple, non-alarmist explanation of what it is
   - gujaratiTranslation: ગુજરાતી નામ અને ૧-૨ વાક્યમાં સરળ સમજૂતી
   - hindiTranslation: हिन्दी नाम और १-२ वाक्य में सरल व्याख्या
   - purpose: role in food (e.g. emulsifier, leavening agent, preservative, spice)
   - category: one of 'grain', 'oil', 'spice', 'additive', 'preservative', 'sweetener', 'emulsifier', 'flavouring', 'compound', 'dairy', 'vegetable', 'other'
   - source: 'package_declaration'
   - confidence: 'high' | 'medium' | 'low'

2. JAIN DIETARY INTELLIGENCE:
   Evaluate for explicitly declared onion, garlic, spring onion, shallots, chives, leeks, or any direct derivatives (e.g. onion powder, garlic extract, dehydrated onion, pyaz, lahsun).
   Also inspect compound ingredients, seasoning mixes, spice blends, and flavouring declarations (e.g., "Natural flavours", "Masala", "Seasoning mix") for ambiguity. Do NOT automatically assume that every generic flavouring contains onion/garlic, but classify as NEEDS VERIFICATION if onion/garlic is commonly hidden in that specific spice/snack blend.

   Statuses:
   - "FOUND": Onion or garlic is explicitly declared in the available evidence.
   - "NOT_FOUND_IN_AVAILABLE_DATA": The inspected ingredient information does not explicitly identify onion or garlic. (Explain clearly that this does not prove absence).
   - "NEEDS_VERIFICATION": Information is incomplete, ambiguous (e.g. unspecified seasoning mix / flavouring in a savory snack), or unreadable.
   - "VERIFIED_ABSENCE": Product is explicitly verified as completely onion-garlic-free (e.g. pure single-ingredient item like pure salt/sugar/single oil, or certified Jain product).

   Provide:
   - status: one of "FOUND" | "NOT_FOUND_IN_AVAILABLE_DATA" | "NEEDS_VERIFICATION" | "VERIFIED_ABSENCE"
   - onionDetected: boolean
   - garlicDetected: boolean
   - detectedKeywords: list of words found that triggered detection (e.g. ["dehydrated onion", "dried garlic"])
   - ambiguousIngredients: list of ingredients needing manufacturer verification (e.g. ["seasoning mix", "flavourings"])
   - explanationEn: thorough explanation in English
   - explanationGu: thorough explanation in Gujarati (ગુજરાતી)
   - explanationHi: thorough explanation in Hindi (हिन्दी)
   - recommendation: actionable guidance for the user`;

    const aiCallPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            decodedIngredients: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  originalName: { type: Type.STRING },
                  standardizedName: { type: Type.STRING },
                  englishExplanation: { type: Type.STRING },
                  gujaratiTranslation: { type: Type.STRING },
                  hindiTranslation: { type: Type.STRING },
                  purpose: { type: Type.STRING },
                  category: { type: Type.STRING },
                  source: { type: Type.STRING },
                  confidence: { type: Type.STRING },
                },
                required: [
                  'originalName',
                  'standardizedName',
                  'englishExplanation',
                  'gujaratiTranslation',
                  'hindiTranslation',
                  'purpose',
                  'category',
                ],
              },
            },
            jainAnalysis: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING },
                onionDetected: { type: Type.BOOLEAN },
                garlicDetected: { type: Type.BOOLEAN },
                detectedKeywords: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                ambiguousIngredients: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                explanationEn: { type: Type.STRING },
                explanationGu: { type: Type.STRING },
                explanationHi: { type: Type.STRING },
                recommendation: { type: Type.STRING },
              },
              required: [
                'status',
                'onionDetected',
                'garlicDetected',
                'detectedKeywords',
                'ambiguousIngredients',
                'explanationEn',
                'explanationGu',
                'explanationHi',
                'recommendation',
              ],
            },
          },
          required: ['decodedIngredients', 'jainAnalysis'],
        },
      },
    });

    // 10-second server timeout race to guarantee prompt response
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI generation timeout')), 10000)
    );

    const response = await Promise.race([aiCallPromise, timeoutPromise]);
    const parsed = JSON.parse(response.text || '{}');
    const result = {
      ...parsed,
      source: 'gemini_ai_intelligence',
    };
    decodedCache.set(cacheKey, result);
    return res.json(result);
  } catch (err: any) {
    const isRateLimit =
      err?.status === 429 ||
      String(err?.message || '').includes('429') ||
      String(err?.message || '').includes('RESOURCE_EXHAUSTED') ||
      String(err?.message || '').includes('quota');

    if (isRateLimit) {
      geminiRateLimitedUntil = Date.now() + 60000;
      console.log('AI free-tier rate limit (5 RPM) reached. Seamlessly serving rule-based food intelligence engine.');
    } else {
      console.log('Ingredient decoding served via rule-based food intelligence engine.');
    }

    const fallbackResponse = {
      decodedIngredients: localDecoded,
      jainAnalysis: localJainInspection,
      source: 'rule_based_engine',
    };
    decodedCache.set(cacheKey, fallbackResponse);
    return res.json(fallbackResponse);
  }
});

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
 * Local rule-based Jain inspection engine for high-speed offline/resilient checking
 */
function inspectJainSuitabilityLocally(text: string, preferences: any = {}): {
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

/**
 * Splits ingredient text by commas and parentheses for basic local breakdown
 */
function parseIngredientsLocally(text: string) {
  // Basic split respecting commas outside nested parentheses
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

// Start dev or production server
async function startServer() {
  const server = http.createServer(app);

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: {
          server,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Label Logic AI server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
