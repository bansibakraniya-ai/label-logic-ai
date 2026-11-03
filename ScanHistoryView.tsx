import React from 'react';
import {
  History,
  Trash2,
  ScanLine,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { Language, ScanHistoryItem } from '../types';
import { translations } from '../translations';
import { getJainStatusColor } from '../utils/jainRules';

interface ScanHistoryViewProps {
  language: Language;
  history: ScanHistoryItem[];
  onSelectBarcode: (barcode: string) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onNavigateToScan: () => void;
}

export const ScanHistoryView: React.FC<ScanHistoryViewProps> = ({
  language,
  history,
  onSelectBarcode,
  onRemoveItem,
  onClearAll,
  onNavigateToScan,
}) => {
  const t = translations[language];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'FOUND':
        return <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />;
      case 'NEEDS_VERIFICATION':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
      case 'VERIFIED_ABSENCE':
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold mb-1">
            <History className="w-3.5 h-3.5 text-emerald-600" />
            Audit Trail & Scanned Products
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {t.history.title}
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            {t.history.subtitle}
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm(t.history.confirmClear)) {
                onClearAll();
              }
            }}
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t.history.clearAll}
          </button>
        )}
      </div>

      {/* History List or Empty State */}
      {history.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-100">
            <History className="w-8 h-8" />
          </div>
          <p className="text-slate-600 text-sm max-w-sm mx-auto">
            {t.history.empty}
          </p>
          <button
            onClick={onNavigateToScan}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            {t.hero.btnScan}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => {
            const colors = getJainStatusColor(item.jainStatus);
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 p-4 sm:p-5 shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div
                  onClick={() => onSelectBarcode(item.barcode)}
                  className="flex items-center gap-4 cursor-pointer flex-1 min-w-0"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-14 h-14 object-contain rounded-xl bg-slate-50 border p-1 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                      Food
                    </div>
                  )}

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-emerald-700 transition-colors truncate">
                        {item.name}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${colors.badgeBg}`}
                      >
                        {getStatusIcon(item.jainStatus)}
                        {item.jainStatus}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500">
                      {item.brand} • Barcode: <span className="font-mono text-slate-700">{item.barcode}</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Scanned on {new Date(item.scannedAt).toLocaleDateString()} at{' '}
                      {new Date(item.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => onSelectBarcode(item.barcode)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {t.history.viewProduct}
                    <ArrowRight className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                    title={t.history.remove}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
