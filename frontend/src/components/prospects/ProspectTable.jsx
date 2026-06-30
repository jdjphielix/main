import React from 'react';
import { Check, X, TrendingUp, DollarSign, Phone } from 'lucide-react';

export default function ProspectTable({ prospects, onSelectProspect, onClearFilter, activeFilter }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status) => {
    const colors = {
      'Discovery': 'bg-[#eef2fa] text-[#3d61a4]',
      'In Negotiation': 'bg-[#fff4e6] text-[#ff9800]',
      'Proposal Sent': 'bg-[#f3e5f5] text-[#9c27b0]',
      'Onboarding': 'bg-[#e8f5e9] text-[#4caf50]',
    };
    return colors[status] || 'bg-[#e8eaf2] text-[#566079]';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'Critical': 'text-red-600',
      'High': 'text-orange-600',
      'Medium': 'text-blue-600',
      'Low': 'text-gray-600',
    };
    return colors[priority] || 'text-gray-600';
  };

  return (
    <div>
      {/* Filter Clear Button */}
      {activeFilter && (
        <div className="px-6 py-3 bg-[#f7f8fc] border-b border-[#e8eaf2] flex items-center justify-between">
          <span className="text-sm text-[#566079]">Active filter: <span className="font-semibold">{activeFilter}</span></span>
          <button
            onClick={onClearFilter}
            className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white border border-[#cdd1e0] text-[#566079] hover:bg-[#f7f8fc] transition-colors text-sm font-medium"
          >
            <X size={16} />
            Clear filter
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-white border-b border-[#e8eaf2]">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-[#566079]">Bedrijf</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-[#566079]">Contactpersoon</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-[#566079]">Mobiel</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-[#566079]">TaperPay</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-[#566079]">TaperTrade</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-[#566079]">FX Volume</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-[#566079]">TF Volume</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-[#566079]">Revenue Potentie</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-[#566079]">Status</th>
            </tr>
          </thead>
          <tbody>
            {prospects.map((prospect) => (
              <tr
                key={prospect.id}
                onClick={() => onSelectProspect(prospect)}
                className="border-b border-[#e8eaf2] hover:bg-[#f7f8fc] cursor-pointer transition-colors"
              >
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-[#011745]">{prospect.company}</p>
                    <p className="text-sm text-[#7b859e]">{prospect.country}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-[#011745]">{prospect.contactName}</p>
                    <p className="text-sm text-[#7b859e]">{prospect.position}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {prospect.mobile ? (
                    <a
                      href={`tel:${prospect.mobile}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[#00c875] hover:text-[#037f4c] transition-colors text-sm font-medium flex items-center gap-2 w-fit"
                    >
                      <Phone size={16} className="flex-shrink-0" />
                      {prospect.mobile}
                    </a>
                  ) : (
                    <span className="text-[#a4abbe] text-sm">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  {prospect.taperPayActive ? (
                    <div className="flex justify-center">
                      <Check size={20} className="text-green-600" />
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <X size={20} className="text-gray-400" />
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  {prospect.taperTradeActive ? (
                    <div className="flex justify-center">
                      <Check size={20} className="text-green-600" />
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <X size={20} className="text-gray-400" />
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="font-medium text-[#011745]">
                    {prospect.fxVolume > 0 ? formatCurrency(prospect.fxVolume) : '-'}
                  </p>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="font-medium text-[#011745]">
                    {prospect.tfVolume > 0 ? formatCurrency(prospect.tfVolume) : '-'}
                  </p>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="font-medium text-green-700 flex items-center justify-end gap-1">
                    <DollarSign size={16} />
                    {formatCurrency(prospect.revenuePotential)}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(prospect.status)}`}>
                    {prospect.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {prospects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp size={48} className="text-[#cdd1e0] mb-3" />
            <p className="text-[#7b859e] font-medium">No prospects found</p>
            <p className="text-sm text-[#a4abbe]">Try adjusting your filters or search criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}
