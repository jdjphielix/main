import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Shield, Clock, Save, Loader2, Camera } from 'lucide-react';

const API = '/api/v1';
const token = () => sessionStorage.getItem('auth_token');

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const avatarInputRef = useRef(null);

  const handleAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setMessage({ type: 'error', text: 'Alleen JPG of PNG bestanden zijn toegestaan' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Bestand is te groot (max 5 MB)' });
      return;
    }

    try {
      setUploadingAvatar(true);
      setMessage(null);
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch(`${API}/users/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (setUser) setUser(prev => ({ ...prev, avatar_url: data.avatar_url }));
        setMessage({ type: 'success', text: 'Profielfoto bijgewerkt' });
      } else {
        const err = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: err.detail || 'Upload mislukt' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Er ging iets mis bij het uploaden' });
    } finally {
      setUploadingAvatar(false);
      // Reset input so same file can be re-selected
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      const res = await fetch(`${API}/users/me`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const updated = await res.json();
        if (setUser) setUser(prev => ({ ...prev, ...updated }));
        setMessage({ type: 'success', text: 'Profiel bijgewerkt' });
      } else {
        setMessage({ type: 'error', text: 'Opslaan mislukt' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Er ging iets mis' });
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = {
    admin_pay: 'Admin TaperPay',
    admin_trade: 'Admin TaperTrade',
    sales: 'Sales',
    backoffice: 'Backoffice',
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Hidden file input */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleAvatarChange}
      />

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={handleAvatarClick}
          disabled={uploadingAvatar}
          className="relative w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-white text-2xl font-bold group focus:outline-none"
          style={{ backgroundColor: '#3d61a4' }}
          title="Klik om profielfoto te wijzigen"
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt="Profielfoto"
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{user?.full_name?.charAt(0).toUpperCase()}</span>
          )}
          {/* Hover overlay */}
          <span
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            {uploadingAvatar
              ? <Loader2 size={20} className="animate-spin text-white" />
              : <Camera size={20} className="text-white" />
            }
          </span>
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#011745', fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}>
            Mijn Profiel
          </h1>
          <p className="text-sm" style={{ color: '#566079' }}>
            Beheer je accountgegevens
          </p>
        </div>
      </div>

      {/* Profile card */}
      <div className="rounded-xl border p-6" style={{ backgroundColor: '#fff', borderColor: '#e8eaf2' }}>
        {/* Role badge */}
        <div className="flex items-center gap-2 mb-6">
          <Shield size={16} style={{ color: '#3d61a4' }} />
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}
          >
            {roleLabel[user?.role] || user?.role}
          </span>
          {user?.is_teamleader && (
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ backgroundColor: '#dcfce7', color: '#166534' }}
            >
              Teamleider
            </span>
          )}
        </div>

        {/* Form */}
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3b4560' }}>
              Volledige naam
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a4abbe' }} />
              <input
                type="text"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: '#e8eaf2', '--tw-ring-color': '#3d61a4' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3b4560' }}>
              E-mailadres
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a4abbe' }} />
              <input
                type="email"
                value={form.email}
                disabled
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm bg-gray-50 cursor-not-allowed"
                style={{ borderColor: '#e8eaf2', color: '#7b859e' }}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: '#a4abbe' }}>E-mailadres kan niet worden gewijzigd</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#3b4560' }}>
              Telefoonnummer
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+31 6 ..."
              className="w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: '#e8eaf2', '--tw-ring-color': '#3d61a4' }}
            />
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className="mt-4 px-4 py-2.5 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: message.type === 'success' ? '#166534' : '#991b1b',
            }}
          >
            {message.text}
          </div>
        )}

        {/* Save button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors hover:shadow-md disabled:opacity-60"
            style={{ backgroundColor: '#3d61a4' }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>

      {/* Account info */}
      <div className="mt-6 rounded-xl border p-6" style={{ backgroundColor: '#f7f8fc', borderColor: '#e8eaf2' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#3b4560' }}>Accountinformatie</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span style={{ color: '#a4abbe' }}>Account ID</span>
            <p className="font-medium" style={{ color: '#566079' }}>{user?.id || '—'}</p>
          </div>
          <div>
            <span style={{ color: '#a4abbe' }}>Rol</span>
            <p className="font-medium" style={{ color: '#566079' }}>{roleLabel[user?.role] || user?.role}</p>
          </div>
          <div>
            <span style={{ color: '#a4abbe' }}>Status</span>
            <p className="font-medium" style={{ color: user?.is_active !== false ? '#166534' : '#991b1b' }}>
              {user?.is_active !== false ? 'Actief' : 'Inactief'}
            </p>
          </div>
          <div>
            <span style={{ color: '#a4abbe' }}>Aangemaakt</span>
            <p className="font-medium" style={{ color: '#566079' }}>
              {user?.created_at ? new Date(user.created_at).toLocaleDateString('nl-NL') : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
