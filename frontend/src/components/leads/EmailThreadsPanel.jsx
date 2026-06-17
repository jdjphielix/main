import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Mail, Inbox, Send, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

const token = () => sessionStorage.getItem('auth_token');

const sanitize = (html) => {
  if (typeof window !== 'undefined' && window.DOMPurify) {
    return window.DOMPurify.sanitize(html || '', { USE_PROFILES: { html: true } });
  }
  return html || '';
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Gisteren';
  if (diffDays < 7) return d.toLocaleDateString('nl-NL', { weekday: 'short' });
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function formatFullDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('nl-NL', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function groupEmailsByThread(emails) {
  const threadMap = new Map();
  for (const email of emails) {
    const threadKey = email.gmail_thread_id || `subject:${email.subject || 'geen onderwerp'}`;
    if (!threadMap.has(threadKey)) {
      threadMap.set(threadKey, {
        threadId: threadKey,
        subject: email.subject || '(geen onderwerp)',
        emails: [],
      });
    }
    threadMap.get(threadKey).emails.push(email);
  }

  // Sort emails within each thread by received_at ASC
  for (const thread of threadMap.values()) {
    thread.emails.sort((a, b) => {
      const da = a.received_at ? new Date(a.received_at) : new Date(0);
      const db_ = b.received_at ? new Date(b.received_at) : new Date(0);
      return da - db_;
    });
  }

  // Sort threads by most recent email DESC
  const threads = Array.from(threadMap.values());
  threads.sort((a, b) => {
    const latestA = a.emails[a.emails.length - 1]?.received_at;
    const latestB = b.emails[b.emails.length - 1]?.received_at;
    const da = latestA ? new Date(latestA) : new Date(0);
    const db_ = latestB ? new Date(latestB) : new Date(0);
    return db_ - da;
  });

  return threads;
}

function ThreadDetailModal({ thread, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(1,23,69,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-2xl max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8eaf2]">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[#011745] truncate">{thread.subject}</h3>
            <p className="text-xs text-[#7b859e] mt-0.5">{thread.emails.length} berichten in thread</p>
          </div>
          <button onClick={onClose} className="ml-4 p-1.5 rounded-lg hover:bg-[#f3f4f8] transition-colors text-[#7b859e]">
            <X size={18} />
          </button>
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {thread.emails.map((email, i) => (
            <EmailItem key={email.id || i} email={email} defaultOpen={i === thread.emails.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmailItem({ email, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const isInbound = email.direction === 'inbound';

  return (
    <div className="rounded-xl border border-[#e8eaf2] overflow-hidden">
      {/* Email header — clickable to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#f7f8fc] transition-colors text-left"
      >
        <div className="mt-0.5 flex-shrink-0">
          {isInbound
            ? <Inbox size={14} style={{ color: '#3d61a4' }} />
            : <Send size={14} style={{ color: '#566079' }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[#011745] truncate">
              {isInbound ? email.from_email : `Aan: ${email.to_email}`}
            </span>
            <span className="text-xs text-[#a4abbe] flex-shrink-0">{formatFullDate(email.received_at)}</span>
          </div>
          {!open && email.snippet && (
            <p className="text-xs text-[#7b859e] truncate mt-0.5">{email.snippet}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-[#a4abbe]">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Email body */}
      {open && (
        <div className="border-t border-[#e8eaf2]">
          {/* Meta */}
          <div className="px-4 py-2 bg-[#f7f8fc] text-xs space-y-0.5" style={{ color: '#566079' }}>
            <div><span className="font-medium">Van:</span> {email.from_email}</div>
            <div><span className="font-medium">Aan:</span> {email.to_email}</div>
          </div>
          {/* Body */}
          <div className="px-4 py-3">
            {email.body_html ? (
              <div
                className="prose prose-sm max-w-none text-[#011745]"
                style={{ fontSize: '13px', lineHeight: '1.6' }}
                dangerouslySetInnerHTML={{ __html: sanitize(email.body_html) }}
              />
            ) : email.snippet ? (
              <p className="text-sm text-[#566079]">{email.snippet}</p>
            ) : (
              <p className="text-xs text-[#a4abbe] italic">Geen inhoud beschikbaar</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmailThreadsPanel({ leadId }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [openThread, setOpenThread] = useState(null);

  const fetchEmails = async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/emails`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmails(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch emails:', err);
    }
    setLoading(false);
  };

  const syncGmail = async () => {
    if (!leadId || syncing) return;
    setSyncing(true);
    try {
      await fetch(`/api/v1/leads/${leadId}/sync-gmail`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      await fetchEmails();
    } catch (err) {
      console.error('Gmail sync failed:', err);
    }
    setSyncing(false);
  };

  useEffect(() => {
    fetchEmails();
  }, [leadId]);

  const threads = useMemo(() => groupEmailsByThread(emails), [emails]);
  const activeThread = openThread ? threads.find(t => t.threadId === openThread) : null;

  if (loading && emails.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin" style={{ color: '#3d61a4' }} />
        <span className="ml-2 text-sm" style={{ color: '#7b859e' }}>E-mails laden...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mail size={14} style={{ color: '#3d61a4' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7b859e' }}>
            {threads.length} thread{threads.length !== 1 ? 's' : ''} · {emails.length} berichten
          </span>
        </div>
        <button
          onClick={syncing ? undefined : syncGmail}
          disabled={syncing}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
          style={{ backgroundColor: '#011745', color: '#fff' }}
        >
          {syncing
            ? <><Loader2 size={12} className="animate-spin" /> Synchroniseren...</>
            : <><RefreshCw size={12} /> Gmail Sync</>}
        </button>
      </div>

      {/* Thread list */}
      {threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 rounded-xl" style={{ backgroundColor: '#f7f8fc' }}>
          <Mail size={28} className="mb-2" style={{ color: '#cdd1e0' }} />
          <p className="text-sm font-medium" style={{ color: '#7b859e' }}>Geen e-mails gevonden</p>
          <p className="text-xs mt-1" style={{ color: '#a4abbe' }}>Klik op Gmail Sync om e-mails op te halen</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-[#e8eaf2]">
          {threads.map((thread, i) => {
            const latest = thread.emails[thread.emails.length - 1];
            const oldest = thread.emails[0];
            const lastSender = latest?.direction === 'inbound' ? latest?.from_email : `Jij → ${latest?.to_email}`;
            const isInbound = latest?.direction === 'inbound';

            return (
              <button
                key={thread.threadId}
                onClick={() => setOpenThread(thread.threadId)}
                className={`w-full text-left px-4 py-3.5 transition-colors hover:bg-[#f7f8fc] ${
                  i > 0 ? 'border-t border-[#e8eaf2]' : ''
                }`}
                style={{ backgroundColor: '#fff' }}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">
                    {isInbound
                      ? <Inbox size={14} style={{ color: '#3d61a4' }} />
                      : <Send size={14} style={{ color: '#566079' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#011745] truncate">{thread.subject}</span>
                      <span className="text-xs flex-shrink-0" style={{ color: '#a4abbe' }}>
                        {formatDate(latest?.received_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                        style={isInbound
                          ? { backgroundColor: '#eef2fa', color: '#3d61a4' }
                          : { backgroundColor: '#f3f4f8', color: '#566079' }}
                      >
                        {thread.emails.length} bericht{thread.emails.length !== 1 ? 'en' : ''}
                      </span>
                      <span className="text-xs truncate" style={{ color: '#7b859e' }}>{lastSender}</span>
                    </div>
                    {latest?.snippet && (
                      <p className="text-xs mt-1 truncate" style={{ color: '#a4abbe' }}>{latest.snippet}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Thread detail modal */}
      {activeThread && (
        <ThreadDetailModal
          thread={activeThread}
          onClose={() => setOpenThread(null)}
        />
      )}
    </div>
  );
}
