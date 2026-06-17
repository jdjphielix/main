import React from 'react';
import { Check, X, TrendingUp, DollarSign, Phone, Flame } from 'lucide-react';

function OwnerBadge({ name }) {
  if (!name) return <span className="text-[#a4abbe] text-xs">-</span>;
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = [
    'bg-[#3d61a4] text-white', 'bg-[#0a2d6b] text-white',
    'bg-purple-600 text-white', 'bg-teal-600 text-white',
    'bg-orange-500 text-white', 'bg-pink-600 text-white',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className="flex items-center gap-2">
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${colors[idx]}`}>
        {initials}
      </span>
      <span className="text-sm text-[#566079] truncate max-w-[100px]">{name.split(' ')[0]}</span>
    </div>
  );
}

export default function ProspectTable({ prospects, onSelectProspect, onClearFilter, activeFilter, showOwner, onToggleHot }) {
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

  const hasRevenue = (prospect) => {
    return (prospect.revenuePotential || 0) > 0;
  };

  return (
    <div>
      {activeFilter && (
        <div className="px-6 py-3 bg-[#f7f8fc] border-b border-[#e8eaf2] flex items-center justify-between">
          <span className="text-sm text-[#566079]">Active filter: <span className="font-semibold">{activeFilter}</span></span>
          <button onClick={onClearFilter}
            className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white border border-[#cdd1e0] text-[#566079] hover:bg-[#f7f8fc] transition-colors text-sm font-medium">
            <X size={16} /> Clear filter
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-white border-b border-[#e8eaf2]">
            <tr>
              {onToggleHot && <th className="px-4 py-4 text-center text-sm font-semibold text-[#566079] w-12">Hot</th>}
              <th className="px-6 py-4 text-left text-sm font-semibold text-[#566079]">Bedrijf</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-[#566079]">Contactpersoon</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-[#566079]">Mobiel</th>
              {showOwner && <th className="px-6 py-4 text-left text-sm font-semibold text-[#566079]">Eigenaar</th>}
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
              <tr key={prospect.id} onClick={() => onSelectProspect(prospect)}
                className="border-b border-[#e8eaf2] hover:bg-[#f7f8fc] cursor-pointer transition-colors">
                {onToggleHot && (
                  <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      title={prospect.isHot ? 'Hot prospect — klik om te verwijderen' : (hasRevenue(prospect) ? 'Markeer als hot prospect' : 'Stel eerst FX of TF revenue in')}
                      onClick={() => onToggleHot(prospect.id)}
                      disabled={!prospect.isHot && !hasRevenue(prospect)}
                      className={`p-1.5 rounded-lg transition-all ${
                        prospect.isHot
                          ? 'text-orange-500 bg-orange-50 hover:bg-orange-100'
                          : hasRevenue(prospect)
                            ? 'text-[#cdd1e0] hover:text-orange-400 hover:bg-orange-50'
                            : 'text-[#e8eaf2] cursor-not-allowed'
                      }`}
                    >
                      <Flame size={18} fill={prospect.isHot ? 'currentColor' : 'none'} />
                    </button>
                  </td>
                )}
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-[#011745]">
                      {prospect.isHot && <span className="inline-block mr-1 text-orange-500 text-xs">🔥</span>}
                      {prospect.company}
                    </p>
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
                    <a href={`tel:${prospect.mobile}`} onClick={(e) => e.stopPropagation()}
                      className="text-[#00c875] hover:text-[#037f4c] transition-colors text-sm font-medium flex items-center gap-2 w-fit">
                      <Phone size={16} className="flex-shrink-0" />{prospect.mobile}
                    </a>
                  ) : <span className="text-[#a4abbe] text-sm">-</span>}
                </td>
                {showOwner && (
                  <td className="px-6 py-4">
                    <OwnerBadge name={prospect.salesOwnerName} />
                  </td>
                )}
                <td className="px-6 py-4 text-center">
                  <div className="flex justify-center">
                    {prospect.taperPayActive ? <Check size={20} className="text-green-600" /> : <X size={20} className="text-gray-400" />}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex justify-center">
                    {prospect.taperTradeActive ? <Check size={20} className="text-green-600" /> : <X size={20} className="text-gray-400" />}
                  </div>
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
                    <DollarSign size={16} />{formatCurrency(prospect.revenuePotential)}
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
            <p className="text-[#7b859e] font-medium">Geen prospects gevonden</p>
            <p className="text-sm text-[#a4abbe]">Pas je filters of zoekopdracht aan</p>
          </div>
        )}
      </div>
    </div>
  );
}
