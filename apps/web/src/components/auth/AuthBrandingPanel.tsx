import { Link } from 'react-router-dom';
import { ShieldCheck, TrendingUp, Landmark, Users } from 'lucide-react';

export function AuthBrandingPanel() {
  return (
    <div className="lg:w-1/2 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 p-8 sm:p-12 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/60 relative overflow-hidden">
      {/* Subtle decorative glow accents */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand header */}
      <div className="relative z-10">
        <Link to="/" className="inline-flex items-center gap-3 group">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
            <ShieldCheck className="w-7 h-7 text-slate-950" />
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight text-white flex items-center gap-2">
              WealthNest
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                v0.1.0-alpha
              </span>
            </span>
            <p className="text-xs text-slate-400">Family Wealth & Asset Management</p>
          </div>
        </Link>
      </div>

      {/* Central Hero pitch */}
      <div className="my-12 lg:my-auto relative z-10 max-w-lg">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
          Build a clearer picture of your wealth.
        </h1>
        <p className="text-base sm:text-lg text-slate-300 mb-8 leading-relaxed">
          Track your assets, investments, loans and family net worth in one place.
        </p>

        {/* Three Key Benefits */}
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Understand your total net worth.
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated calculations across cash balances, demat holdings, physical gold, and
                liabilities.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0 mt-0.5">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Track investments and property values.
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Live NSE/BSE quotes, mutual fund NAV feeds, CAS/Tradebook statement importers, and
                loan amortization.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Manage household assets and liabilities.
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Coordinate portfolios across household entities with Section 112A tax shields and
                secure RLS.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Precision footer note */}
      <div className="relative z-10 pt-4 border-t border-slate-800/60 flex items-center gap-3 text-xs text-slate-400">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>
          PostgreSQL Row Level Security &bull; Zero floating-point drift (integer paise)
        </span>
      </div>
    </div>
  );
}

