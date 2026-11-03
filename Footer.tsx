import React from 'react';
import { Shield, Leaf, CheckCircle, Info } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../translations';

interface FooterProps {
  language: Language;
  onNavigate: (view: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ language, onNavigate }) => {
  const t = translations[language];

  return (
    <footer className="mt-16 bg-white border-t border-slate-200 py-10 text-slate-600 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <Shield className="w-5 h-5 fill-emerald-600 stroke-white stroke-[2]" />
              </div>
              <span className="font-bold text-lg text-slate-900">{t.appName}</span>
            </div>
            <p className="text-slate-600 text-sm max-w-md leading-relaxed">
              {t.tagline} Empowering consumers with radical packaging transparency,
              real-time barcode scanning, chemical ingredient decoding, and rigorous
              Jain dietary suitability intelligence without speculation.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle className="w-3.5 h-3.5" /> Open Food Facts API
              </span>
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle className="w-3.5 h-3.5" /> Gemini 3.8 Flash Vision OCR
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
              Features
            </h4>
            <ul className="space-y-2 text-xs font-medium">
              <li>
                <button
                  onClick={() => onNavigate('scan')}
                  className="hover:text-emerald-700 transition-colors cursor-pointer"
                >
                  {t.nav.scan}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('jain')}
                  className="hover:text-emerald-700 transition-colors cursor-pointer"
                >
                  {t.nav.jain}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('ocr')}
                  className="hover:text-emerald-700 transition-colors cursor-pointer"
                >
                  {t.nav.ocr}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('decoder')}
                  className="hover:text-emerald-700 transition-colors cursor-pointer"
                >
                  {t.nav.decoder}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('nutrition')}
                  className="hover:text-emerald-700 transition-colors cursor-pointer"
                >
                  {t.nav.nutrition}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('history')}
                  className="hover:text-emerald-700 transition-colors cursor-pointer"
                >
                  {t.nav.history}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('settings')}
                  className="hover:text-emerald-700 transition-colors cursor-pointer"
                >
                  {t.nav.settings}
                </button>
              </li>
            </ul>
          </div>

          {/* Dietary Compliance Notice */}
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-emerald-600" /> Integrity Policy
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              We never fabricate missing ingredients or assume absence from database omission.
              Jain assessments strictly evaluate declared label evidence and certified marks.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Label Logic AI. All rights reserved.</p>
          <p className="mt-2 sm:mt-0">English • ગુજરાતી • हिन्दी</p>
        </div>
      </div>
    </footer>
  );
};
