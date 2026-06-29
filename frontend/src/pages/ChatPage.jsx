import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Plus, Send, Hash, Users, User, Loader2, Search,
  X, Smile, Paperclip, AtSign, ChevronDown, AlertCircle, Lock, Calendar
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const token = () => sessionStorage.getItem('auth_token');

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
  const [teamUsers, setTeamUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [addingMember, setAddingMember] = useState(null);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      const data = await api('/api/v1/chat/channels');
      setChannels(data.channels || []);
      // Auto-select first channel
      if (!activeChannel && data.channels?.length > 0) {
        setActiveChannel(data.channels[0]);
      }
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  // Fetch messages for active channel
  const fetchMessages = useCallback(async (channelId) => {
    if (!channelId) return;
    setLoadingMessages(true);
    try {
      const data = await api(`/api/v1/chat/channels/${channelId}/messages?page_size=100`);
      setMessages(data.messages || []);
      // Mark as read
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

  useEffect(() => {
    if (activeChannel) {
      fetchMessages(activeChannel.id);
    }
  }, [activeChannel, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keep activeChannel in a ref so the WS handler always has the latest value
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
          if (data.type === 'message' && data.channel_id === activeChannelRef.current?.id) {
            setMessages(prev => [...prev, {
              id: data.message_id,
              user_id: data.user_id,
              user_name: data.user_name,
              content: data.content,
              created_at: data.timestamp,
              message_type: 'text',
            }]);
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

  // Send message
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

  // Load team users when the new channel form opens
  React.useEffect(() => {
    if (showNewChannel) {
      setSelectedMembers([]);
      setMemberSearch('');
      api('/api/v1/users/team').then(data => {
        setTeamUsers((data || []).filter(u => u.status !== 'inactive'));
      }).catch(() => {});
    }
  }, [showNewChannel]);

  // Create channel
  async function handleCreateChannel() {
    if (!newChannelName.trim()) return;
    try {
      await api('/api/v1/chat/channels', {
        method: 'POST',
        body: JSON.stringify({
          channel_type: 'channel',
          name: newChannelName.trim(),
          member_ids: selectedMembers,
        }),
      });
      setNewChannelName('');
      setShowNewChannel(false);
      setSelectedMembers([]);
      setMemberSearch('');
      fetchChannels();
    } catch (err) {
      alert('Kanaal aanmaken mislukt: ' + err.message);
    }
  }

  function toggleMember(userId) {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  }

  // Load all team users for member panel
  async function openMemberPanel() {
    setShowMemberPanel(true);
    setAddMemberSearch('');
    try {
      const data = await api('/api/v1/users/team');
      setAllUsers((data || []).filter(u => u.status !== 'inactive'));
    } catch {}
  }

  async function addMemberToChannel(userId) {
    if (!activeChannel || addingMember) return;
    setAddingMember(userId);
    try {
      await api(`/api/v1/chat/channels/${activeChannel.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
      // Update local channel members
      const addedUser = allUsers.find(u => u.id === userId);
      if (addedUser) {
        setActiveChannel(prev => ({
          ...prev,
          members: [...(prev.members || []), { id: userId, name: addedUser.full_name }],
        }));
        setChannels(prev => prev.map(c =>
          c.id === activeChannel.id
            ? { ...c, members: [...(c.members || []), { id: userId, name: addedUser.full_name }] }
            : c
        ));
      }
    } catch (err) {
      alert('Toevoegen mislukt: ' + err.message);
    }
    setAddingMember(null);
  }

  async function removeMemberFromChannel(userId) {
    if (!activeChannel) return;
    if (!window.confirm('Lid verwijderen uit kanaal?')) return;
    try {
      const res = await fetch(`/api/v1/chat/channels/${activeChannel.id}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        setActiveChannel(prev => ({
          ...prev,
          members: (prev.members || []).filter(m => m.id !== userId),
        }));
        setChannels(prev => prev.map(c =>
          c.id === activeChannel.id
            ? { ...c, members: (c.members || []).filter(m => m.id !== userId) }
            : c
        ));
      }
    } catch {}
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

  const filteredChannels = channels.filter(c =>
    !searchQuery || (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-screen flex bg-[#f7f8fc]">
      {/* Channel Sidebar */}
      <div className="w-72 bg-white border-r border-[#e8eaf2] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#e8eaf2]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold" style={{ color: '#011745' }}>Chat</h2>
            <button onClick={() => setShowNewChannel(true)}
              className="p-2 rounded-lg hover:bg-[#eef2fa] transition-colors" style={{ color: '#3d61a4' }}>
              <Plus size={18} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a4abbe' }} />
            <input type="text" placeholder="Zoek kanaal..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2] text-xs focus:outline-none focus:border-[#3d61a4]"
              style={{ color: '#566079' }} />
          </div>
        </div>

        {/* New Channel Form */}
        {showNewChannel && (
          <div className="p-3 border-b border-[#e8eaf2] bg-[#f7f8fc]">
            <input type="text" placeholder="Kanaalnaam..."
              value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateChannel()}
              autoFocus
              className="w-full px-3 py-2 bg-white rounded-lg border border-[#e8eaf2] text-xs focus:outline-none focus:border-[#3d61a4] mb-2"
              style={{ color: '#566079' }} />
            {/* Member selection */}
            <input
              type="text"
              placeholder="Leden zoeken..."
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              className="w-full px-3 py-1.5 bg-white rounded-lg border border-[#e8eaf2] text-xs focus:outline-none focus:border-[#3d61a4] mb-1"
              style={{ color: '#566079' }} />
            <div className="max-h-32 overflow-y-auto mb-2 space-y-0.5">
              {teamUsers
                .filter(u => !memberSearch || u.full_name?.toLowerCase().includes(memberSearch.toLowerCase()))
                .map(u => (
                  <div key={u.id}
                    onClick={() => toggleMember(u.id)}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer hover:bg-[#eef2fa] transition-colors">
                    <div className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: selectedMembers.includes(u.id) ? '#3d61a4' : '#cdd1e0',
                        backgroundColor: selectedMembers.includes(u.id) ? '#3d61a4' : 'transparent',
                      }}>
                      {selectedMembers.includes(u.id) && (
                        <svg viewBox="0 0 10 10" width="8" height="8" fill="none">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: '#566079' }}>{u.full_name}</span>
                    <span className="text-[10px] ml-auto" style={{ color: '#a4abbe' }}>{u.role}</span>
                  </div>
                ))}
            </div>
            {selectedMembers.length > 0 && (
              <p className="text-[10px] mb-1.5" style={{ color: '#3d61a4' }}>
                {selectedMembers.length} lid{selectedMembers.length !== 1 ? 'en' : ''} geselecteerd
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={handleCreateChannel}
                className="flex-1 px-3 py-1.5 rounded-lg text-white text-xs font-medium"
                style={{ backgroundColor: '#3d61a4' }}>Aanmaken</button>
              <button onClick={() => { setShowNewChannel(false); setNewChannelName(''); }}
                className="px-3 py-1.5 rounded-lg text-xs" style={{ color: '#7b859e' }}>Annuleer</button>
            </div>
          </div>
        )}

        {/* Channel List */}
        <div className="flex-1 overflow-auto">
          {loadingChannels ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin" style={{ color: '#3d61a4' }} />
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="p-4 text-center">
              <MessageSquare size={24} className="mx-auto mb-2" style={{ color: '#cdd1e0' }} />
              <p className="text-xs" style={{ color: '#7b859e' }}>
                {channels.length === 0 ? 'Maak een kanaal aan om te beginnen' : 'Geen resultaten'}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {filteredChannels.map(channel => (
                <button key={channel.id}
                  onClick={() => setActiveChannel(channel)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-2.5 ${
                    activeChannel?.id === channel.id
                      ? 'bg-[#eef2fa]'
                      : 'hover:bg-[#f7f8fc]'
                  }`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: activeChannel?.id === channel.id ? '#3d61a4' : '#f3f4f8',
                      color: activeChannel?.id === channel.id ? '#fff' : '#7b859e',
                    }}>
                    {channel.channel_type === 'dm' ? <User size={14} /> :
                      channel.channel_type === 'group' ? <Users size={14} /> : <Hash size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate"
                      style={{ color: activeChannel?.id === channel.id ? '#011745' : '#566079' }}>
                      {channel.name || 'Direct Message'}
                    </p>
                    <p className="text-[10px]" style={{ color: '#a4abbe' }}>
                      {channel.members?.length || 0} leden
                    </p>
                  </div>
                </button>
              ))}
            </div>
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
                  {activeChannel.channel_type === 'dm' ? <User size={16} /> :
                    activeChannel.channel_type === 'group' ? <Users size={16} /> : <Hash size={16} />}
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: '#011745' }}>{activeChannel.name || 'Direct Message'}</h3>
                  <p className="text-xs" style={{ color: '#7b859e' }}>
                    {activeChannel.members?.length || 0} leden
                    {activeChannel.description && ` • ${activeChannel.description}`}
                  </p>
                </div>
              </div>
              <button
                onClick={openMemberPanel}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#eef2fa] transition-colors"
                style={{ color: '#3d61a4' }}
                title="Leden beheren"
              >
                <Users size={15} />
                Leden beheren
              </button>
            </div>

            {/* Member Panel */}
            {showMemberPanel && (
              <div className="bg-white border-b border-[#e8eaf2] px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold" style={{ color: '#011745' }}>Kanaalleden</h4>
                  <button onClick={() => setShowMemberPanel(false)} style={{ color: '#a4abbe' }}>
                    <X size={16} />
                  </button>
                </div>

                {/* Current members */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {(activeChannel.members || []).map(m => (
                    <div key={m.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}>
                      <span>{m.name}</span>
                      <button
                        onClick={() => removeMemberFromChannel(m.id)}
                        className="hover:text-red-500 transition-colors ml-0.5"
                        title="Verwijderen"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add member search */}
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a4abbe' }} />
                  <input
                    type="text"
                    placeholder="Gebruiker zoeken om toe te voegen..."
                    value={addMemberSearch}
                    onChange={e => setAddMemberSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#f7f8fc] rounded-lg border border-[#e8eaf2] text-xs focus:outline-none focus:border-[#3d61a4]"
                    style={{ color: '#566079' }}
                  />
                </div>
                <div className="max-h-36 overflow-y-auto space-y-0.5">
                  {allUsers
                    .filter(u => {
                      const alreadyMember = (activeChannel.members || []).some(m => m.id === u.id);
                      const matchSearch = !addMemberSearch || u.full_name?.toLowerCase().includes(addMemberSearch.toLowerCase()) || u.email?.toLowerCase().includes(addMemberSearch.toLowerCase());
                      return !alreadyMember && matchSearch;
                    })
                    .map(u => (
                      <div key={u.id}
                        className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#f7f8fc] transition-colors">
                        <div>
                          <span className="text-xs font-medium" style={{ color: '#011745' }}>{u.full_name}</span>
                          <span className="text-[10px] ml-2" style={{ color: '#a4abbe' }}>{u.email}</span>
                        </div>
                        <button
                          onClick={() => addMemberToChannel(u.id)}
                          disabled={addingMember === u.id}
                          className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-50"
                          style={{ backgroundColor: '#eef2fa', color: '#3d61a4' }}
                        >
                          {addingMember === u.id ? '...' : '+ Toevoegen'}
                        </button>
                      </div>
                    ))}
                  {allUsers.filter(u => {
                    const alreadyMember = (activeChannel.members || []).some(m => m.id === u.id);
                    const matchSearch = !addMemberSearch || u.full_name?.toLowerCase().includes(addMemberSearch.toLowerCase()) || u.email?.toLowerCase().includes(addMemberSearch.toLowerCase());
                    return !alreadyMember && matchSearch;
                  }).length === 0 && (
                    <p className="text-xs text-center py-2" style={{ color: '#a4abbe' }}>
                      {addMemberSearch ? 'Geen gebruikers gevonden' : 'Alle teamleden zijn al lid'}
                    </p>
                  )}
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
                          <div className={`px-4 py-2.5 rounded-2xl ${
                            isMe
                              ? 'rounded-br-md text-white'
                              : 'rounded-bl-md'
                          }`}
                            style={{
                              backgroundColor: isMe ? '#3d61a4' : '#f3f4f8',
                              color: isMe ? '#fff' : '#011745',
                            }}>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <p className={`text-[10px] mt-1 ${isMe ? 'text-right' : ''}`}
                            style={{ color: '#a4abbe' }}>
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
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
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
            <p className="font-semibold" style={{ color: '#011745' }}>Selecteer een kanaal</p>
            <p className="text-sm" style={{ color: '#7b859e' }}>of maak een nieuw kanaal aan</p>
          </div>
        )}
      </div>
    </div>
  );
}
