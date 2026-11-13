import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Building2 } from 'lucide-react';
import { PropertyType, RealEstatePropertyInput } from '@wealthnest/domain';
import { Button } from '@/components/ui/Button';

export interface PropertyMetricsOverride {
  propertyType: PropertyType;
  location?: string;
  purchaseDate?: string;
  purchasePricePaise: bigint;
  monthlyRentPaise: bigint;
  annualMaintenancePaise: bigint;
  propertyTaxPaise: bigint;
}

interface PropertyMetricsModalProps {
  isOpen: boolean;
  property: RealEstatePropertyInput | null;
  onClose: () => void;
  onSave: (propertyId: string, override: PropertyMetricsOverride) => void;
}

function paiseToRupeeInput(paise: bigint): string {
  if (paise <= 0n) return '0';
  return (Number(paise) / 100).toString();
}

function rupeeInputToPaise(raw: string): bigint {
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) return 0n;
  return BigInt(Math.round(num * 100));
}

export function PropertyMetricsModal({
  isOpen,
  property,
  onClose,
  onSave,
}: PropertyMetricsModalProps) {
  const [propertyType, setPropertyType] = useState<PropertyType>('residential');
  const [location, setLocation] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [monthlyRent, setMonthlyRent] = useState('0');
  const [annualMaintenance, setAnnualMaintenance] = useState('0');
  const [propertyTax, setPropertyTax] = useState('0');

  useEffect(() => {
    if (isOpen && property) {
      setPropertyType(property.propertyType);
      setLocation(property.location || '');
      setPurchaseDate(property.purchaseDate || '');
      setPurchasePrice(paiseToRupeeInput(property.purchasePricePaise));
      setMonthlyRent(paiseToRupeeInput(property.monthlyRentPaise));
      setAnnualMaintenance(paiseToRupeeInput(property.annualMaintenancePaise));
      setPropertyTax(paiseToRupeeInput(property.propertyTaxPaise));
    }
  }, [isOpen, property]);

  if (!isOpen || !property) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(property.id, {
      propertyType,
      location: location.trim() || undefined,
      purchaseDate: purchaseDate || undefined,
      purchasePricePaise: rupeeInputToPaise(purchasePrice),
      monthlyRentPaise: rupeeInputToPaise(monthlyRent),
      annualMaintenancePaise: rupeeInputToPaise(annualMaintenance),
      propertyTaxPaise: rupeeInputToPaise(propertyTax),
    });
    onClose();
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="property-metrics-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="property-metrics-modal-title" className="text-base font-semibold text-white">
                Property Rental & Cost Details
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-[300px]">{property.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="prop-type" className="block text-xs font-medium text-slate-300 mb-1.5">
                Property Type
              </label>
              <select
                id="prop-type"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="land">Plot / Land</option>
                <option value="reit">REIT</option>
              </select>
            </div>

            <div>
              <label htmlFor="prop-location" className="block text-xs font-medium text-slate-300 mb-1.5">
                Location / City
              </label>
              <input
                id="prop-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Ahmedabad, Gujarat"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="prop-purchase-date" className="block text-xs font-medium text-slate-300 mb-1.5">
                Purchase Date
              </label>
              <input
                id="prop-purchase-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="prop-purchase-price" className="block text-xs font-medium text-slate-300 mb-1.5">
                Purchase Price (₹)
              </label>
              <input
                id="prop-purchase-price"
                type="number"
                min="0"
                step="1"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="prop-monthly-rent" className="block text-xs font-medium text-slate-300 mb-1.5">
                Monthly Rent (₹)
              </label>
              <input
                id="prop-monthly-rent"
                type="number"
                min="0"
                step="1"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="prop-maint" className="block text-xs font-medium text-slate-300 mb-1.5">
                Annual Maint. (₹)
              </label>
              <input
                id="prop-maint"
                type="number"
                min="0"
                step="1"
                value={annualMaintenance}
                onChange={(e) => setAnnualMaintenance(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="prop-tax" className="block text-xs font-medium text-slate-300 mb-1.5">
                Property Tax / Yr (₹)
              </label>
              <input
                id="prop-tax"
                type="number"
                min="0"
                step="1"
                value={propertyTax}
                onChange={(e) => setPropertyTax(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save Metrics</Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

