import React, { useState } from 'react';
import { Calculator, CheckCircle2, Info, ArrowRight, Sparkles } from 'lucide-react';
import { ShopPricing } from '../types';

interface AcceptanceCalculatorWidgetProps {
  pricing: ShopPricing;
  onApplySample?: (params: {
    totalPages: number;
    copies: number;
    printType: 'BW' | 'COLOUR';
    printingSide: 'SINGLE' | 'BOTH';
  }) => void;
}

export const AcceptanceCalculatorWidget: React.FC<AcceptanceCalculatorWidgetProps> = ({
  pricing,
  onApplySample,
}) => {
  const [activeTest, setActiveTest] = useState<number | null>(null);

  const tests = [
    {
      id: 1,
      title: 'Test 1: 6 Pages B&W Single',
      pages: 6,
      copies: 1,
      printType: 'BW' as const,
      printingSide: 'SINGLE' as const,
      rate: pricing.bwSingle, // 5
      expected: 6 * 1 * pricing.bwSingle, // 30
      formula: `6 pages × 1 copy × ₹${pricing.bwSingle}/page`,
      note: 'Single side B&W standard print rate.',
    },
    {
      id: 2,
      title: 'Test 2: 6 Pages B&W Both Side (Duplex)',
      pages: 6,
      copies: 1,
      printType: 'BW' as const,
      printingSide: 'BOTH' as const,
      rate: pricing.bwBoth, // 5
      expected: 6 * 1 * pricing.bwBoth, // 30
      formula: `6 pages × 1 copy × ₹${pricing.bwBoth}/page`,
      note: 'Charged for 6 pages at ₹5/page (NOT divided into 3 sheets!).',
    },
    {
      id: 3,
      title: 'Test 3: 6 Pages Colour Single Side',
      pages: 6,
      copies: 1,
      printType: 'COLOUR' as const,
      printingSide: 'SINGLE' as const,
      rate: pricing.colorSingle, // 10
      expected: 6 * 1 * pricing.colorSingle, // 60
      formula: `6 pages × 1 copy × ₹${pricing.colorSingle}/page`,
      note: 'Colour single side standard print rate.',
    },
    {
      id: 4,
      title: 'Test 4: 6 Pages Colour Both Side',
      pages: 6,
      copies: 1,
      printType: 'COLOUR' as const,
      printingSide: 'BOTH' as const,
      rate: pricing.colorBoth, // 10
      expected: 6 * 1 * pricing.colorBoth, // 60
      formula: `6 pages × 1 copy × ₹${pricing.colorBoth}/page`,
      note: 'Charged for 6 pages at ₹10/page.',
    },
    {
      id: 5,
      title: 'Test 5: 7 Pages B&W Both Side (Odd Page Count)',
      pages: 7,
      copies: 1,
      printType: 'BW' as const,
      printingSide: 'BOTH' as const,
      rate: pricing.bwBoth, // 5
      expected: 7 * 1 * pricing.bwBoth, // 35
      formula: `7 pages × 1 copy × ₹${pricing.bwBoth}/page`,
      note: 'Crucial: 7 × ₹5 = ₹35 (each page calculated at ₹5/page).',
    },
    {
      id: 6,
      title: 'Test 6: 2 Copies of 6 Pages B&W Both Side',
      pages: 6,
      copies: 2,
      printType: 'BW' as const,
      printingSide: 'BOTH' as const,
      rate: pricing.bwBoth, // 4
      expected: 6 * 2 * pricing.bwBoth, // 48
      formula: `6 pages × 2 copies × ₹${pricing.bwBoth}/page`,
      note: 'Multiplies total pages by number of copies.',
    },
    {
      id: 7,
      title: 'Test 7: Multiple Files (3p + 5p = 8p) Colour Both Side',
      pages: 8,
      copies: 1,
      printType: 'COLOUR' as const,
      printingSide: 'BOTH' as const,
      rate: pricing.colorBoth, // 7.5
      expected: 8 * 1 * pricing.colorBoth, // 60
      formula: `8 pages × 1 copy × ₹${pricing.colorBoth}/page`,
      note: 'Combined total across all files: 8 × ₹7.50 = ₹60.',
    },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Calculator className="w-4 h-4" />
            <span>RSCC Verified Acceptance Tests</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Transparent Pricing Engine
          </h3>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            At Riddhi Siddhi Choice Centre, price is strictly calculated by the{' '}
            <strong className="text-amber-300">number of pages in your document</strong>, never by physical sheets used.
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-xs text-slate-300">
          <div className="text-amber-400 font-bold mb-1 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            Formula
          </div>
          <div>Total = Total Pages × Copies × Rate/page</div>
        </div>
      </div>

      {/* Interactive Acceptance Test Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
        {tests.map((test) => {
          const isSelected = activeTest === test.id;
          return (
            <button
              key={test.id}
              onClick={() => setActiveTest(isSelected ? null : test.id)}
              className={`p-3.5 rounded-xl text-left transition border flex flex-col justify-between ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-[1.02]'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span
                    className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-slate-950 text-amber-300' : 'bg-slate-900 text-amber-400'
                    }`}
                  >
                    Test {test.id}
                  </span>
                  <span
                    className={`font-black text-sm ${
                      isSelected ? 'text-slate-950' : 'text-emerald-400'
                    }`}
                  >
                    ₹{test.expected}
                  </span>
                </div>

                <div
                  className={`text-xs font-bold ${
                    isSelected ? 'text-slate-950' : 'text-white'
                  }`}
                >
                  {test.pages} pgs • {test.printType} • {test.printingSide === 'BOTH' ? 'Both Side' : 'Single Side'}
                  {test.copies > 1 ? ` (${test.copies} cps)` : ''}
                </div>
              </div>

              <div
                className={`text-[11px] mt-2 font-mono ${
                  isSelected ? 'text-slate-900 font-semibold' : 'text-slate-400'
                }`}
              >
                {test.formula}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Test Detail Drawer */}
      {activeTest !== null && (
        <div className="bg-slate-950/80 rounded-xl p-4 border border-amber-500/40 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in">
          <div>
            <div className="text-amber-400 font-bold text-sm mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{tests[activeTest - 1].title}</span>
            </div>
            <p className="text-slate-300">
              {tests[activeTest - 1].note}
            </p>
          </div>

          {onApplySample && (
            <button
              onClick={() => {
                const t = tests[activeTest - 1];
                onApplySample({
                  totalPages: t.pages,
                  copies: t.copies,
                  printType: t.printType,
                  printingSide: t.printingSide,
                });
              }}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-4 py-2 rounded-lg transition shrink-0 flex items-center gap-1.5 shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Test This in Order Form</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
