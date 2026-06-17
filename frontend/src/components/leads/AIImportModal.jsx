import React, { useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function AIImportModal({ onClose, onImport }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [parsedLeads, setParsedLeads] = useState(null);

  const acceptedFormats = ['.xlsx', '.csv', '.pdf', '.png', '.jpg'];

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file) => {
    // Validate file type
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!acceptedFormats.includes(fileExt)) {
      alert('Invalid file format. Please upload: ' + acceptedFormats.join(', '));
      return;
    }

    setUploadedFile(file);
    setIsProcessing(true);

    // Simulate AI processing
    setTimeout(() => {
      // Mock parsed data
      setParsedLeads([
        {
          id: 'import_1',
          company: 'Van der Berg International Trading BV',
          contactName: 'Jan van der Berg',
          email: 'jan@vandenberg-trading.nl',
          phone: '+31 20 555 0001',
          mobile: '+31 6 12 345 678',
          country: 'Netherlands',
          industry: 'Import/Export',
          isDuplicate: false,
        },
        {
          id: 'import_2',
          company: 'New Trading Partners Ltd',
          contactName: 'Alice Johnson',
          email: 'alice@newtrading.uk',
          phone: '+44 20 7946 1234',
          mobile: '+44 7911 654321',
          country: 'United Kingdom',
          industry: 'Commodities',
          isDuplicate: false,
        },
        {
          id: 'import_3',
          company: 'Nordic Supply Chain AS',
          contactName: 'Erik Andersen',
          email: 'erik@nordic-supply.no',
          phone: '+47 22 96 96 96',
          mobile: '+47 91 23 45 67',
          country: 'Norway',
          industry: 'Logistics',
          isDuplicate: true, // Marked as duplicate
        },
      ]);
      setIsProcessing(false);
    }, 2000);
  };

  const handleImport = () => {
    if (!parsedLeads) return;

    // Filter out duplicates
    const leadsToImport = parsedLeads
      .filter(lead => !lead.isDuplicate)
      .map(lead => ({
        id: `imported_${Date.now()}_${Math.random()}`,
        company: lead.company,
        contactName: lead.contactName,
        email: lead.email,
        phone: lead.phone,
        mobile: lead.mobile,
        country: lead.country,
        industry: lead.industry,
        website: lead.company.toLowerCase().replace(/\s+/g, '-') + '.com',
        position: 'Contact',
        status: 'New',
        priority: 'Medium',
        score: Math.floor(Math.random() * 40 + 60), // Random 60-100
        called: false,
        onDailyList: false,
        lastCall: null,
        callDuration: 0,
        notes: [
          {
            id: 'n1',
            text: `Imported from file: ${uploadedFile.name}`,
            date: new Date(),
          },
        ],
        documents: [],
        createdAt: new Date(),
      }));

    onImport(leadsToImport);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#e8eaf2] px-8 py-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#011745]">Import Leads with AI</h1>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#f7f8fc] rounded-lg transition-colors text-[#7b859e]"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {!parsedLeads ? (
            <>
              {/* Upload Zone */}
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all mb-6 ${
                  isDragging
                    ? 'border-[#3d61a4] bg-[#eef2fa]'
                    : 'border-[#a4abbe] hover:border-[#3d61a4] hover:bg-[#eef2fa]'
                }`}
              >
                <input
                  type="file"
                  onChange={handleFileInput}
                  accept={acceptedFormats.join(',')}
                  className="hidden"
                  id="import-file-input"
                />
                <label htmlFor="import-file-input" className="cursor-pointer block">
                  {isProcessing ? (
                    <>
                      <Loader
                        size={48}
                        className="mx-auto mb-4 text-[#3d61a4] animate-spin"
                      />
                      <p className="text-[#3d61a4] font-medium mb-2">
                        AI is bezig met verwerken...
                      </p>
                      <p className="text-xs text-[#a4abbe]">
                        Analyseer uw leads en duplicaten detecteren
                      </p>
                    </>
                  ) : uploadedFile ? (
                    <>
                      <CheckCircle
                        size={48}
                        className="mx-auto mb-4 text-[#00c875]"
                      />
                      <p className="text-[#011745] font-medium mb-2">
                        {uploadedFile.name}
                      </p>
                      <p className="text-xs text-[#a4abbe]">
                        Click to upload a different file
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload
                        size={48}
                        className="mx-auto mb-4 text-[#a4abbe]"
                      />
                      <p className="text-[#011745] font-medium mb-2">
                        Drop your file here or click to upload
                      </p>
                      <p className="text-xs text-[#a4abbe]">
                        Supports: {acceptedFormats.join(', ')}
                      </p>
                    </>
                  )}
                </label>
              </div>

              {/* Info Box */}
              <div className="bg-[#eef2fa] rounded-xl p-4 border border-[#5a7fc2]">
                <p className="text-sm text-[#011745]">
                  <span className="font-semibold">Artificial Intelligence will:</span>
                </p>
                <ul className="text-sm text-[#566079] mt-2 space-y-1 ml-4 list-disc">
                  <li>Extract company and contact information</li>
                  <li>Detect and flag duplicate leads</li>
                  <li>Enrich data from available sources</li>
                  <li>Calculate AI lead scores</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* Preview Table */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[#011745] mb-4">
                  Preview: {parsedLeads.length} Leads Found
                </h3>

                <div className="overflow-x-auto border border-[#e8eaf2] rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#f7f8fc] border-b border-[#e8eaf2]">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#566079] uppercase">
                          Company
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#566079] uppercase">
                          Contact
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#566079] uppercase">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#566079] uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          className={`border-b border-[#e8eaf2] ${
                            lead.isDuplicate
                              ? 'bg-[#fff5f5] opacity-60'
                              : 'hover:bg-[#f7f8fc]'
                          }`}
                        >
                          <td className="px-4 py-3 font-medium text-[#011745]">
                            {lead.company}
                          </td>
                          <td className="px-4 py-3 text-[#566079]">
                            {lead.contactName}
                          </td>
                          <td className="px-4 py-3 text-[#3d61a4]">{lead.email}</td>
                          <td className="px-4 py-3">
                            {lead.isDuplicate ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-[#ff642e] text-white">
                                <AlertCircle size={14} />
                                Duplicate
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-[#00c875] text-white">
                                <CheckCircle size={14} />
                                New
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="bg-[#eef2fa] rounded-lg p-4 border border-[#5a7fc2]">
                    <p className="text-xs text-[#7b859e] mb-1">Total Found</p>
                    <p className="text-2xl font-bold text-[#011745]">
                      {parsedLeads.length}
                    </p>
                  </div>
                  <div className="bg-[#f0fdf4] rounded-lg p-4 border border-[#00c875]">
                    <p className="text-xs text-[#7b859e] mb-1">To Import</p>
                    <p className="text-2xl font-bold text-[#00c875]">
                      {parsedLeads.filter(l => !l.isDuplicate).length}
                    </p>
                  </div>
                  <div className="bg-[#fef5f5] rounded-lg p-4 border border-[#ff642e]">
                    <p className="text-xs text-[#7b859e] mb-1">Duplicates</p>
                    <p className="text-2xl font-bold text-[#ff642e]">
                      {parsedLeads.filter(l => l.isDuplicate).length}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-[#e8eaf2] px-8 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg font-medium text-[#566079] bg-[#f7f8fc] hover:bg-[#e8eaf2] transition-colors"
          >
            Cancel
          </button>
          {parsedLeads && (
            <button
              onClick={handleImport}
              disabled={parsedLeads.filter(l => !l.isDuplicate).length === 0}
              className="px-6 py-2.5 rounded-lg font-medium text-white bg-[#3d61a4] hover:bg-[#0a2d6b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircle size={18} />
              Importeer {parsedLeads.filter(l => !l.isDuplicate).length} leads
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
