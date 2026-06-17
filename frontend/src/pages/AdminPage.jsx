import React, { useState } from 'react';
import { Users, ClipboardCheck, DollarSign, Shield, Mail } from 'lucide-react';
import UsersTab from '../components/admin/UsersTab';
import RequirementsTab from '../components/admin/RequirementsTab';
import PnLTab from '../components/admin/PnLTab';
import ComplianceTab from '../components/admin/ComplianceTab';
import ComplianceInboxTab from '../components/admin/ComplianceInboxTab';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users');

  const tabs = [
    { key: 'users', label: 'Gebruikers', icon: Users },
    { key: 'requirements', label: 'Onboarding Vereisten', icon: ClipboardCheck },
    { key: 'pnl', label: 'P&L Management', icon: DollarSign },
    { key: 'compliance', label: 'Compliance', icon: Shield },
    { key: 'compliance_inbox', label: 'Compliance Inbox', icon: Mail },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#f7f8fc]">
      {/* Header */}
      <div className="bg-white border-b border-[#e8eaf2] px-8 py-5">
        <h1 className="text-2xl font-bold mb-3" style={{ color: '#011745' }}>Admin</h1>
        <div className="flex gap-1 bg-[#f3f4f8] rounded-lg p-1 w-fit">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key ? 'bg-white shadow-sm' : 'hover:bg-white/50'
                }`}
                style={{ color: activeTab === tab.key ? '#3d61a4' : '#7b859e' }}>
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'requirements' && <RequirementsTab />}
        {activeTab === 'pnl' && <PnLTab />}
        {activeTab === 'compliance' && <ComplianceTab />}
        {activeTab === 'compliance_inbox' && <ComplianceInboxTab />}
      </div>
    </div>
  );
}
