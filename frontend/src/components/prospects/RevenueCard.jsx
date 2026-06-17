import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';

export default function RevenueCard({ fxData = null, tfData = null }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const fxRevenue = useMemo(() => {
    if (!fxData || !fxData.volume || !fxData.margin) return 0;
    return fxData.volume * fxData.margin;
  }, [fxData]);

  const tfRevenue = useMemo(() => {
    if (!tfData || !tfData.totalFacilityAmount || !tfData.margin) return 0;
    return tfData.totalFacilityAmount * tfData.margin;
  }, [tfData]);

  const totalRevenue = fxRevenue + tfRevenue;

  return (
    <div className="bg-white rounded-3xl border border-[#e8eaf2] p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp size={20} className="text-green-600" />
        <h3 className="font-semibold text-[#011745]">Revenue Forecast</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* FX Revenue */}
        {fxData && (
          <div className="bg-[#eef2fa] rounded-2xl p-4">
            <p className="text-xs font-medium text-[#566079] mb-2">FX Revenue</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#7b859e]">Volume:</span>
                <span className="font-medium text-[#011745]">{formatCurrency(fxData.volume)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#7b859e]">Margin:</span>
                <span className="font-medium text-[#011745]">{(fxData.margin * 100).toFixed(2)}%</span>
              </div>
              <div className="border-t border-[#d1d9e8] pt-2 mt-2 flex justify-between">
                <span className="text-sm font-semibold text-[#011745]">Revenue:</span>
                <span className="text-sm font-bold text-green-700">{formatCurrency(fxRevenue)}</span>
              </div>
            </div>
          </div>
        )}

        {/* TF Revenue */}
        {tfData && (
          <div className="bg-[#e8f5e9] rounded-2xl p-4">
            <p className="text-xs font-medium text-[#566079] mb-2">TF Revenue</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#7b859e]">Facility:</span>
                <span className="font-medium text-[#011745]">{formatCurrency(tfData.totalFacilityAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#7b859e]">Margin:</span>
                <span className="font-medium text-[#011745]">{(tfData.margin * 100).toFixed(2)}%</span>
              </div>
              <div className="border-t border-[#c8e6c9] pt-2 mt-2 flex justify-between">
                <span className="text-sm font-semibold text-[#011745]">Revenue:</span>
                <span className="text-sm font-bold text-green-700">{formatCurrency(tfRevenue)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Total Revenue */}
      <div className="bg-gradient-to-r from-[#3d61a4] to-[#5a7fc2] rounded-2xl p-4 text-white">
        <p className="text-sm font-medium opacity-90 mb-1">Total Revenue</p>
        <p className="text-3xl font-bold">{formatCurrency(totalRevenue)}</p>
      </div>
    </div>
  );
}
