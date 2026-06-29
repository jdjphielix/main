import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Plus, Send, Hash, Users, Loader2, Search,
  X, Smile, Paperclip, AtSign, ChevronDown, AlertCircle, Lock,
  User, UserPlus, UserMinus, Check, Settings
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const token = () => sessionStorage.getItem('auth_token');

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // DELETE may return empty body
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export default function ChatPage() {
  const { user } = useAuth();
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [showManageMembers, setShowManageMembers] = useState(false);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  // Fetch all team members (for DMs, group creation and member management)
  const fetchUsers = useCallback(async () => {
    try {
      const data = await api('/api/v1/users/team');
      setAllUsers(Array.isArray(data) ? data.filter(u => u.id !== user?.id) : []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, [user?.id]);

  // Fetch channels; preserve current selection by id
  const fetchChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      const data = await api('/api/v1/chat/channels');
      const list = data.channels || [];
      setChannels(list);
      setActiveChannel(prev => {
        if (prev) {
          const updated = list.find(c => c.id === prev.id);
          if (updated) return updated;
        }
        return prev || (list.length > 0 ? list[0] : null);
      });
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  const fetchMessages = useCallback(async (channelId) => {
    if (!channelId) return;
    setLoadingMessages(true);
    try {
      const data = await api(`/api/v1/chat/channels/${channelId}/messages?page_size=100`);
      setMessages(data.messages || []);
      await fetch(`/api/v1/chat/channels/${channelId}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}` },
      });
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    if (activeChannel) fetchMessages(activeChannel.id);
  }, [activeChannel?.id, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeChannelRef = useRef(activeChannel);
  useEffect(() => { activeChannelRef.current = activeChannel; }, [activeChannel]);

  // WebSocket connection
  useEffect(() => {
    if (!user?.id) return;
    const authToken = token();
    if (!authToken) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/chat/ws/${user.id}?token=${encodeURIComponent(authToken)}`;
    try {
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Ignore our own broadcast — we already append locally on send (prevents duplicates)
          if (data.type === 'message'
              && data.channel_id === activeChannelRef.current?.id
              && data.user_id !== user.id) {
            setMessages(prev => {
              if (prev.some(m => m.id === data.message_id)) return prev;
              return [...prev, {
                id: data.message_id,
                user_id: data.user_id,
                user_name: data.user_name,
                content: data.content,
                created_at: data.timestamp,
                message_type: 'text',
              }];
            });
          }
        } catch (err) {
          console.error('WebSocket message parse error:', err);
        }
      };
      wsRef.current = ws;
    } catch (err) {
      console.error('WebSocket connection failed:', err);
    }
    return () => { wsRef.current?.close(); };
  }, [user?.id]);

  async function handleSend() {
    if (!newMessage.trim() || !activeChannel) return;
    setSending(true);
    try {
      const msg = await api(`/api/v1/chat/channels/${activeChannel.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      setMessages(prev => [...prev, {
        id: msg.id,
        user_id: user.id,
        user_name: user.full_name,
        content: newMessage.trim(),
        created_at: msg.created_at,
        message_type: 'text',
      }]);
      setNewMessage('');
    } catch (err) {
      alert('Bericht verzenden mislukt: ' + err.message);
    } finally {
      setSending(false);
    }
  }

  // Create a group/channel with selected members
  async function handleCreateChannel() {
    if (!newChannelName.trim()) return;
    try {
      await api('/api/v1/chat/channels', {
        method: 'POST',
        body: JSON.stringify({
          channel_type: selectedMemberIds.length > 0 ? 'group' : 'channel',
          name: newChannelName.trim(),
          member_ids: selectedMemberIds,
        }),
      });
      setNewChannelName('');
      setSelectedMemberIds([]);
      setShowNewChannel(false);
      fetchChannels();
    } catch (err) {
      alert('Kanaal aanmaken mislukt: ' + err.message);
    }
  }

  // Start (or open existing) direct message with a user
  async function handleStartDm(otherUserId) {
    try {
      const ch = await api('/api/v1/chat/channels', {
        method: 'POST',
        body: JSON.stringify({ channel_type: 'dm', member_ids: [otherUserId] }),
      });
      await fetchChannels();
      setActiveChannel(prev => ({ id: ch.id, name: ch.name, channel_type: 'dm', members: [] }));
    } catch (err) {
      alert('Gesprek starten mislukt: ' + err.message);
    }
  }

  async function handleAddMember(uid) {
    if (!activeChannel) return;
    try {
      await api(`/api/v1/chat/channels/${activeChannel.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_ids: [uid] }),
      });
      fetchChannels();
    } catch (err) {
      alert('Lid toevoegen mislukt: ' + err.message);
    }
  }

  async function handleRemoveMember(uid) {
    if (!activeChannel) return;
    try {
      await api(`/api/v1/chat/channels/${activeChannel.id}/members/${uid}`, { method: 'DELETE' });
      fetchChannels();
    } catch (err) {
      alert('Lid verwijderen mislukt: ' + err.message);
    }
  }

  function toggleMemberSelection(uid) {
    setSelectedMemberIds(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) + ' ' +
      d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }

  function channelDisplayName(c) {
    if (!c) return '';
    if (c.name) return c.name;
    if (c.channel_type === 'dm') {
      const other = (c.members || []).find(m => m.id !== user?.id);
      return other?.name || 'Direct Message';
    }
    return 'Kanaal';
  }

  function ChannelIcon({ type, size = 14 }) {
    if (type === 'dm') return <User size={size} />;
    if (type === 'group') return <Users size={size} />;
    return <Hash size={size} />;
  }

  const filteredChannels = channels.filter(c =>
    !searchQuery || channelDisplayName(c).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Users without a 1-on-1 DM yet (for the "Personen" quick-start list)
  const dmUserIds = new Set(
    channels.filter(c => c.channel_type === 'dm')
      .flatMap(c => (c.members || []).map(m => m.id))
  );
  const filteredUsers = allUsers.filter(u =>
    !searchQuery || (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentMemberIds = new Set((activeChannel?.members || []).map(m => m.id));
  const addableUsers = allUsers.filter(u => !currentMemberIds.has(u.id));

  return (
    <div className="h-screen flex bg-[#f7f8fc]">
      {/* Channel Sidebar */}
      <div className="w-72 bg-white border-r border-[#e8eaf2] flex flex-col">
        <div className="p-4 border-b border-[#e8eaf2]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold" style={{ color: '#011745' }}>Chat</h2>
            <button onClick={() => setShowNewChannel(true)}
              title="Nieuwe groep / kanaal"
              className="p-2 rounded-lg hover:bg-[#eef2fa] transition-colors" style={{ color: '#3d61a4' }}>
              <Plus size={18} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a4abbe' }} />
            <input type="text" placeholder="Zoek kanaal of persoon..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2] text-xs focus:outline-none focus:border-[#3d61a4]"
              style={{ color: '#566079' }} />
          </div>
        </div>

        {/* New Channel / Group Form */}
        {showNewChannel && (
          <div className="p-3 border-b border-[#e8eaf2] bg-[#f7f8fc]">
            <input type="text" placeholder="Naam van groep/kanaal..."
              value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateChannel()}
              autoFocus
              className="w-full px-3 py-2 bg-white rounded-lg border border-[#e8eaf2] text-xs focus:outline-none focus:border-[#3d61a4] mb-2"
              style={{ color: '#566079' }} />
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#a4abbe' }}>
              Leden toevoegen ({selectedMemberIds.length})
            </p>
            <div className="max-h-40 overflow-auto rounded-lg border border-[#e8eaf2] bg-white mb-2">
              {allUsers.length === 0 ? (
                <p className="text-[11px] p-2" style={{ color: '#a4abbe' }}>Geen andere gebruikers</p>
              ) : allUsers.map(u => (
                <button key={u.id} onClick={() => toggleMemberSelection(u.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[#f7f8fc] text-left">
                  <span className="w-4 h-4 rounded flex items-center justify-center border"
                    style={{
                      borderColor: selectedMemberIds.includes(u.id) ? '#3d61a4' : '#cdd1e0',
                      backgroundColor: selectedMemberIds.includes(u.id) ? '#3d61a4' : '#fff',
                    }}>
                    {selectedMemberIds.includes(u.id) && <Check size={11} color="#fff" />}
                  </span>
                  <span className="text-xs truncate" style={{ color: '#566079' }}>{u.full_name}</span>
                  <span className="text-[10px] ml-auto" style={{ color: '#a4abbe' }}>{u.role}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreateChannel}
                className="flex-1 px-3 py-1.5 rounded-lg text-white text-xs font-medium"
                style={{ backgroundColor: '#3d61a4' }}>Aanmaken</button>
              <button onClick={() => { setShowNewChannel(false); setNewChannelName(''); setSelectedMemberIds([]); }}
                className="px-3 py-1.5 rounded-lg text-xs" style={{ color: '#7b859e' }}>Annuleer</button>
            </div>
          </div>
        )}

        {/* Channel + People List */}
        <div className="flex-1 overflow-auto">
          {loadingChannels ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin" style={{ color: '#3d61a4' }} />
            </div>
          ) : (
            <>
              <div className="p-2 space-y-0.5">
                {filteredChannels.length === 0 ? (
                  <p className="text-[11px] px-3 py-2" style={{ color: '#a4abbe' }}>Nog geen gesprekken</p>
                ) : filteredChannels.map(channel => (
                  <button key={channel.id}
                    onClick={() => setActiveChannel(channel)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-2.5 ${
                      activeChannel?.id === channel.id ? 'bg-[#eef2fa]' : 'hover:bg-[#f7f8fc]'
                    }`}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: activeChannel?.id === channel.id ? '#3d61a4' : '#f3f4f8',
                        color: activeChannel?.id === channel.id ? '#fff' : '#7b859e',
                      }}>
                      <ChannelIcon type={channel.channel_type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate"
                        style={{ color: activeChannel?.id === channel.id ? '#011745' : '#566079' }}>
                        {channelDisplayName(channel)}
                      </p>
                      <p className="text-[10px]" style={{ color: '#a4abbe' }}>
                        {channel.channel_type === 'dm' ? 'Direct bericht' : `${channel.members?.length || 0} leden`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* People — start a direct message */}
              <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#a4abbe' }}>Personen</p>
              </div>
              <div className="p-2 pt-0 space-y-0.5">
                {filteredUsers.length === 0 ? (
                  <p className="text-[11px] px-3 py-1" style={{ color: '#a4abbe' }}>Geen gebruikers</p>
                ) : filteredUsers.map(u => (
                  <button key={u.id} onClick={() => handleStartDm(u.id)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#f7f8fc] flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold"
                      style={{ backgroundColor: '#5a7fc2' }}>
                      {(u.full_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: '#566079' }}>{u.full_name}</p>
                      <p className="text-[10px] truncate" style={{ color: '#a4abbe' }}>{u.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeChannel ? (
          <>
            {/* Channel Header */}
            <div className="px-6 py-4 bg-white border-b border-[#e8eaf2] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                  <ChannelIcon type={activeChannel.channel_type} size={16} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: '#011745' }}>{channelDisplayName(activeChannel)}</h3>
                  <p className="text-xs" style={{ color: '#7b859e' }}>
                    {activeChannel.channel_type === 'dm'
                      ? 'Direct bericht'
                      : `${activeChannel.members?.length || 0} leden`}
                    {activeChannel.description && ` • ${activeChannel.description}`}
                  </p>
                </div>
              </div>
              {activeChannel.channel_type !== 'dm' && (
                <button onClick={() => setShowManageMembers(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#eef2fa]"
                  style={{ color: '#3d61a4' }}>
                  <Settings size={14} /> Leden
                </button>
              )}
            </div>

            {/* Manage members panel */}
            {showManageMembers && activeChannel.channel_type !== 'dm' && (
              <div className="px-6 py-4 bg-[#f7f8fc] border-b border-[#e8eaf2]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#7b859e' }}>
                      Leden ({activeChannel.members?.length || 0})
                    </p>
                    <div className="space-y-1 max-h-40 overflow-auto">
                      {(activeChannel.members || []).map(m => (
                        <div key={m.id} className="flex items-center gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-[#e8eaf2]">
                          <span className="text-xs truncate flex-1" style={{ color: '#566079' }}>{m.name}</span>
                          {m.id !== activeChannel.created_by_id && (
                            <button onClick={() => handleRemoveMember(m.id)} title="Verwijderen"
                              className="p-1 rounded hover:bg-red-50" style={{ color: '#c0392b' }}>
                              <UserMinus size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#7b859e' }}>
                      Toevoegen
                    </p>
                    <div className="space-y-1 max-h-40 overflow-auto">
                      {addableUsers.length === 0 ? (
                        <p className="text-[11px]" style={{ color: '#a4abbe' }}>Iedereen zit al in dit kanaal</p>
                      ) : addableUsers.map(u => (
                        <button key={u.id} onClick={() => handleAddMember(u.id)}
                          className="w-full flex items-center gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-[#e8eaf2] hover:border-[#3d61a4]">
                          <UserPlus size={13} style={{ color: '#3d61a4' }} />
                          <span className="text-xs truncate flex-1 text-left" style={{ color: '#566079' }}>{u.full_name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={24} className="animate-spin" style={{ color: '#3d61a4' }} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <MessageSquare size={40} style={{ color: '#cdd1e0' }} />
                  <p className="font-semibold" style={{ color: '#011745' }}>Geen berichten</p>
                  <p className="text-sm" style={{ color: '#7b859e' }}>Stuur het eerste bericht!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, idx) => {
                    const isMe = msg.user_id === user?.id;
                    const showAvatar = idx === 0 || messages[idx - 1]?.user_id !== msg.user_id;
                    return (
                      <div key={msg.id} className={`flex gap-3 ${isMe ? 'justify-end' : ''}`}>
                        {!isMe && showAvatar && (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                            style={{ backgroundColor: '#3d61a4' }}>
                            {(msg.user_name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        {!isMe && !showAvatar && <div className="w-8 flex-shrink-0" />}
                        <div className={`max-w-[70%] ${isMe ? 'order-1' : ''}`}>
                          {showAvatar && !isMe && (
                            <p className="text-xs font-medium mb-1" style={{ color: '#3d61a4' }}>
                              {msg.user_name}
                            </p>
                          )}
                          <div className={`px-4 py-2.5 rounded-2xl ${isMe ? 'rounded-br-md text-white' : 'rounded-bl-md'}`}
                            style={{
                              backgroundColor: isMe ? '#3d61a4' : '#f3f4f8',
                              color: isMe ? '#fff' : '#011745',
                            }}>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <p className={`text-[10px] mt-1 ${isMe ? 'text-right' : ''}`} style={{ color: '#a4abbe' }}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-6 py-4 bg-white border-t border-[#e8eaf2]">
              <div className="flex items-end gap-3">
                <div className="flex-1 bg-[#f7f8fc] rounded-xl border border-[#e8eaf2] focus-within:border-[#3d61a4] transition-colors">
                  <textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                    placeholder="Typ een bericht..."
                    rows={1}
                    className="w-full px-4 py-3 bg-transparent resize-none focus:outline-none text-sm"
                    style={{ color: '#011745', maxHeight: '120px' }}
                  />
                </div>
                <button onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="p-3 rounded-xl text-white transition-all disabled:opacity-40"
                  style={{ backgroundColor: '#3d61a4' }}>
                  {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <MessageSquare size={48} style={{ color: '#cdd1e0' }} />
            <p className="font-semibold" style={{ color: '#011745' }}>Selecteer een kanaal of persoon</p>
            <p className="text-sm" style={{ color: '#7b859e' }}>of maak een nieuwe groep aan</p>
          </div>
        )}
      </div>
    </div>
  );
}
