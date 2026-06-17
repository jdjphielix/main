import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';

const COUNTRIES = [
  { code: 'NL', name: 'Netherlands', currency: 'EUR' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF' },
  { code: 'NO', name: 'Norway', currency: 'NOK' },
  { code: 'SE', name: 'Sweden', currency: 'SEK' },
  { code: 'DK', name: 'Denmark', currency: 'DKK' },
  { code: 'PL', name: 'Poland', currency: 'PLN' },
  { code: 'CZ', name: 'Czech Republic', currency: 'CZK' },
  { code: 'HU', name: 'Hungary', currency: 'HUF' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR' },
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD' },
  { code: 'CA', name: 'Canada', currency: 'CAD' },
  { code: 'JP', name: 'Japan', currency: 'JPY' },
  { code: 'CN', name: 'China', currency: 'CNY' },
  { code: 'SG', name: 'Singapore', currency: 'SGD' },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR' },
];

const CURRENCIES = [
  'EUR', 'USD', 'GBP', 'CHF', 'NOK', 'SEK', 'DKK', 'PLN',
  'CZK', 'HUF', 'ZAR', 'AUD', 'NZD', 'CAD', 'JPY', 'CNY',
  'SGD', 'HKD', 'AED', 'SAR'
];

export default function CurrencySelector({
  entries = [],
  onChange = () => {},
  type = 'country', // 'country' or 'currency'
}) {
  const [showSearch, setShowSearch] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = useMemo(() => {
    if (type === 'country') {
      return COUNTRIES.filter(
        (country) =>
          country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          country.code.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      return CURRENCIES.filter((currency) =>
        currency.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  }, [searchQuery, type]);

  const handleAdd = () => {
    const newEntry = type === 'country'
      ? { country: '', currency: '' }
      : { currency: '', volume: 0 };
    onChange([...entries, newEntry]);
  };

  const handleSelect = (index, option) => {
    const updated = [...entries];
    if (type === 'country') {
      updated[index] = { ...updated[index], ...option };
    } else {
      updated[index] = { ...updated[index], ...option };
    }
    onChange(updated);
    setShowSearch(null);
    setSearchQuery('');
  };

  const handleUpdateVolume = (index, volume) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], volume: parseFloat(volume) || 0 };
    onChange(updated);
  };

  const handleRemove = (index) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Entries */}
      {entries.map((entry, index) => (
        <div key={index} className="flex gap-2 items-end">
          {type === 'country' ? (
            <>
              {/* Incoming Country */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#566079] mb-1">In Country</label>
                <div className="relative">
                  <button
                    onClick={() => setShowSearch(showSearch === `in-${index}` ? null : `in-${index}`)}
                    className="w-full px-3 py-2 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm text-left text-[#566079] hover:border-[#3d61a4] transition-colors"
                  >
                    {entry.inCountry || 'Select country...'}
                  </button>
                  {showSearch === `in-${index}` && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e8eaf2] rounded-lg shadow-lg z-10">
                      <div className="p-2 border-b border-[#e8eaf2]">
                        <input
                          type="text"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full px-2 py-1 text-sm bg-[#f7f8fc] border border-[#e8eaf2] rounded focus:outline-none"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {filteredOptions.map((country) => (
                          <button
                            key={country.code}
                            onClick={() => handleSelect(index, { inCountry: country.name })}
                            className="w-full text-left px-3 py-2 text-sm text-[#566079] hover:bg-[#f7f8fc]"
                          >
                            {country.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Outgoing Country */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#566079] mb-1">Out Country</label>
                <div className="relative">
                  <button
                    onClick={() => setShowSearch(showSearch === `out-${index}` ? null : `out-${index}`)}
                    className="w-full px-3 py-2 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm text-left text-[#566079] hover:border-[#3d61a4] transition-colors"
                  >
                    {entry.outCountry || 'Select country...'}
                  </button>
                  {showSearch === `out-${index}` && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e8eaf2] rounded-lg shadow-lg z-10">
                      <div className="p-2 border-b border-[#e8eaf2]">
                        <input
                          type="text"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full px-2 py-1 text-sm bg-[#f7f8fc] border border-[#e8eaf2] rounded focus:outline-none"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {filteredOptions.map((country) => (
                          <button
                            key={country.code}
                            onClick={() => handleSelect(index, { outCountry: country.name })}
                            className="w-full text-left px-3 py-2 text-sm text-[#566079] hover:bg-[#f7f8fc]"
                          >
                            {country.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Buying Currency */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#566079] mb-1">Buying</label>
                <div className="relative">
                  <button
                    onClick={() => setShowSearch(showSearch === `buy-${index}` ? null : `buy-${index}`)}
                    className="w-full px-3 py-2 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm text-left text-[#566079] hover:border-[#3d61a4] transition-colors"
                  >
                    {entry.buyingCurrency || 'Select...'}
                  </button>
                  {showSearch === `buy-${index}` && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e8eaf2] rounded-lg shadow-lg z-10">
                      <div className="p-2 border-b border-[#e8eaf2]">
                        <input
                          type="text"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full px-2 py-1 text-sm bg-[#f7f8fc] border border-[#e8eaf2] rounded focus:outline-none"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {CURRENCIES.filter((c) => c.toLowerCase().includes(searchQuery.toLowerCase())).map((currency) => (
                          <button
                            key={currency}
                            onClick={() => handleSelect(index, { buyingCurrency: currency })}
                            className="w-full text-left px-3 py-2 text-sm text-[#566079] hover:bg-[#f7f8fc]"
                          >
                            {currency}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Selling Currency */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#566079] mb-1">Selling</label>
                <div className="relative">
                  <button
                    onClick={() => setShowSearch(showSearch === `sell-${index}` ? null : `sell-${index}`)}
                    className="w-full px-3 py-2 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm text-left text-[#566079] hover:border-[#3d61a4] transition-colors"
                  >
                    {entry.sellingCurrency || 'Select...'}
                  </button>
                  {showSearch === `sell-${index}` && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e8eaf2] rounded-lg shadow-lg z-10">
                      <div className="p-2 border-b border-[#e8eaf2]">
                        <input
                          type="text"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full px-2 py-1 text-sm bg-[#f7f8fc] border border-[#e8eaf2] rounded focus:outline-none"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {CURRENCIES.filter((c) => c.toLowerCase().includes(searchQuery.toLowerCase())).map((currency) => (
                          <button
                            key={currency}
                            onClick={() => handleSelect(index, { sellingCurrency: currency })}
                            className="w-full text-left px-3 py-2 text-sm text-[#566079] hover:bg-[#f7f8fc]"
                          >
                            {currency}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Volume */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#566079] mb-1">Volume</label>
                <input
                  type="number"
                  value={entry.volume || ''}
                  onChange={(e) => handleUpdateVolume(index, e.target.value)}
                  className="w-full px-3 py-2 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm text-[#566079] focus:border-[#3d61a4] focus:outline-none"
                  placeholder="Amount"
                />
              </div>
            </>
          ) : (
            <>
              {/* Currency */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#566079] mb-1">Currency</label>
                <div className="relative">
                  <button
                    onClick={() => setShowSearch(showSearch === `curr-${index}` ? null : `curr-${index}`)}
                    className="w-full px-3 py-2 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm text-left text-[#566079] hover:border-[#3d61a4] transition-colors"
                  >
                    {entry.currency || 'Select currency...'}
                  </button>
                  {showSearch === `curr-${index}` && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e8eaf2] rounded-lg shadow-lg z-10">
                      <div className="p-2 border-b border-[#e8eaf2]">
                        <input
                          type="text"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full px-2 py-1 text-sm bg-[#f7f8fc] border border-[#e8eaf2] rounded focus:outline-none"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {CURRENCIES.filter((c) => c.toLowerCase().includes(searchQuery.toLowerCase())).map((currency) => (
                          <button
                            key={currency}
                            onClick={() => handleSelect(index, { currency })}
                            className="w-full text-left px-3 py-2 text-sm text-[#566079] hover:bg-[#f7f8fc]"
                          >
                            {currency}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Volume */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#566079] mb-1">Volume</label>
                <input
                  type="number"
                  value={entry.volume || ''}
                  onChange={(e) => handleUpdateVolume(index, e.target.value)}
                  className="w-full px-3 py-2 bg-[#f7f8fc] border border-[#e8eaf2] rounded-lg text-sm text-[#566079] focus:border-[#3d61a4] focus:outline-none"
                  placeholder="Amount"
                />
              </div>
            </>
          )}

          {/* Delete Button */}
          <button
            onClick={() => handleRemove(index)}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-600"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ))}

      {/* Add Button */}
      <button
        onClick={handleAdd}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#3d61a4] hover:bg-[#eef2fa] rounded-lg transition-colors"
      >
        <Plus size={16} />
        Add {type === 'country' ? 'Currency Pair' : 'Currency'}
      </button>
    </div>
  );
}
