import { useState } from 'react';
import { Check, Copy, Smartphone, X } from 'lucide-react';
import { EXPO_BLUEPRINT_FILES } from '../data/mobileBlueprint';

interface ExpoKitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExpoKitModal({ isOpen, onClose }: ExpoKitModalProps) {
  const [activeId, setActiveId] = useState(EXPO_BLUEPRINT_FILES[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeFile =
    EXPO_BLUEPRINT_FILES.find((f) => f.id === activeId) ||
    EXPO_BLUEPRINT_FILES[0];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(activeFile.code);
      setCopiedId(activeFile.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard blocked in restricted frame
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expo-kit-title"
    >
      <div className="w-full sm:max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Smartphone size={20} className="text-teal-700 shrink-0" />
            <div className="min-w-0">
              <h2
                id="expo-kit-title"
                className="font-display text-base sm:text-lg font-bold text-slate-900 truncate"
              >
                React Native Expo, Supabase &amp; GitHub Kit
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Native mobile TypeScript source aligned with your live
                PostgreSQL schema
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close mobile kit"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {EXPO_BLUEPRINT_FILES.map((file) => {
            const active = file.id === activeFile.id;
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => setActiveId(file.id)}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {file.filename}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-600">{activeFile.summary}</p>
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[38px] px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-800 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedId === activeFile.id ? (
              <>
                <Check size={14} className="text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-950 p-5">
          <pre className="text-xs font-mono text-slate-100 leading-relaxed whitespace-pre">
            <code>{activeFile.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
