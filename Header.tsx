import React, { useState } from 'react';
import { Shield, Leaf, ScanLine, Menu, X, Globe, Sparkles, CheckCircle2 } from 'lucide-react';
import { Language, Product } from '../types';
import { translations } from '../translations';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  activeProduct: Product | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  language,
  onLanguageChange,
  activeProduct,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = translations[language];

  const navItems = [
    { id: 'home', label: t.nav.home },
    { id: 'scan', label: t.nav.scan },
    { id: 'jain', label: t.nav.jain },
    { id: 'decoder', label: t.nav.decoder },
    { id: 'nutrition', label: t.nav.nutrition },
    { id: 'history', label: t.nav.history },
    { id: 'settings', label: t.nav.settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-emerald-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Tagline */}
          <div
            onClick={() => onNavigate('home')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            {/* Green Shield Logo with White Leaf and Scanner Brackets */}
            <div className="relative w-11 h-11 flex items-center justify-center bg-gradient-to-br from-emerald-600 to-green-700 text-white rounded-xl shadow-md shadow-emerald-700/20 group-hover:scale-105 transition-transform">
              {/* Outer scanning corner marks */}
              <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-500 rounded-tl-sm"></div>
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-500 rounded-tr-sm"></div>
              <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-emerald-500 rounded-bl-sm"></div>
              <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-500 rounded-br-sm"></div>
              
              <Shield className="w-8 h-8 fill-emerald-600/20 stroke-white stroke-[1.8]" />
              <Leaf className="w-4.5 h-4.5 text-white absolute fill-white drop-shadow-xs" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-tight text-slate-900 group-hover:text-emerald-700 transition-colors">
                  {t.appName}
                </span>
                <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 uppercase">
                  Verified
                </span>
              </div>
              <p className="text-xs font-medium text-emerald-700 tracking-normal hidden sm:block">
                {t.tagline}
              </p>
            </div>
          </div>

          {/* Active Product Mini Badge (informational status only - does not redirect route) */}
          {activeProduct && (
            <div
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-xs max-w-xs select-none"
              title={activeProduct.name}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-slate-500 font-medium shrink-0">Current:</span>
              <span className="text-slate-800 font-semibold truncate">
                {activeProduct.name}
              </span>
            </div>
          )}

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`px-2 xl:px-2.5 py-1.5 rounded-lg text-xs xl:text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Tools: Language Picker & Mobile Menu */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="relative flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  language === 'en'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('gu')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  language === 'gu'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ગુજરાતી
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('hi')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  language === 'hi'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                हिन्दी
              </button>
            </div>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-1 shadow-lg">
          {activeProduct && (
            <div
              className="mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs select-none"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="truncate">
                <span className="text-slate-500">Loaded: </span>
                <span className="font-bold text-slate-800">{activeProduct.name}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
