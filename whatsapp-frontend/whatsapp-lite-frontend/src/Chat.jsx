import { useState, useEffect, useRef } from 'react';
import api from './api';
import './index.css';

// --- Icons ---
const SendIcon = () => (<svg style={{ width: '24px', height: '24px' }} viewBox="0 0 24 24"><path fill="currentColor" d="M2,21L23,12L2,3V10L17,12L2,14V21Z" /></svg>);
const PlusIcon = () => (<svg style={{ width: '24px', height: '24px' }} viewBox="0 0 24 24"><path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" /></svg>);
const GroupIcon = () => (<svg style={{ width: '24px', height: '24px' }} viewBox="0 0 24 24"><path fill="currentColor" d="M16,14C17.66,14 19,12.66 19,11C19,9.34 17.66,8 16,8C14.34,8 13,9.34 13,11C13,12.66 14.34,14 16,14M8,14C9.66,14 11,12.66 11,11C11,9.34 9.66,8 8,8C6.34,8 5,9.34 5,11C5,12.66 6.34,14 8,14M8,16C5.33,16 2,17.34 2,20V22H14V20C14,17.34 10.67,16 8,16M16,16C15.71,16 15.38,16.03 15.03,16.08C16.37,17.05 17,18.36 17,20V22H22V20C22,17.34 18.67,16 16,16Z" /></svg>);
const SingleTick = () => (<svg style={{ width: '16px', height: '16px' }} viewBox="0 0 16 11"><path fill="#8696a0" d="M11.071.653a.457.457,0,0,0-.304-.102.526.526,0,0,0-.381.178l-6.19,7.363L2.3,5.747a.519.519,0,0,0-.381-.178.457.457,0,0,0-.304.102.387.387,0,0,0-.144.291.493.493,0,0,0,.152.346L4.336,9.487a.519.519,0,0,0,.381.178.462.462,0,0,0,.381-.193L11.223,1.348a.487.487,0,0,0,.127-.33A.391.391,0,0,0,11.071.653Z" /></svg>);
const DoubleTick = ({ color = "#8696a0" }) => (<svg style={{ width: '16px', height: '16px' }} viewBox="0 0 16 11"><path fill={color} d="M11.071.653a.457.457,0,0,0-.304-.102.526.526,0,0,0-.381.178l-6.19,7.363L2.3,5.747a.519.519,0,0,0-.381-.178.457.457,0,0,0-.304.102.387.387,0,0,0-.144.291.493.493,0,0,0,.152.346L4.336,9.487a.519.519,0,0,0,.381.178.462.462,0,0,0,.381-.193L11.223,1.348a.487.487,0,0,0,.127-.33A.391.391,0,0,0,11.071.653Zm4.127,0a.457.457,0,0,0-.3-.1.526.526,0,0,0-.381.178l-6.19,7.363-.513-.564-.636.751,1.152,1.241a.519.519,0,0,0,.381.178.462.462,0,0,0,.381-.193l6.922-8.321a.487.487,0,0,0,.127-.33A.391.391,0,0,0,15.2.653Z" /></svg>);
const FailedIcon = () => (<svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24"><path fill="#f15c6d" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,17L17,12H14V8H10V12H7L12,17Z" /></svg>);
const UserPlusIcon = () => (<svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24"><path fill="currentColor" d="M14,14C17.86,14 21,15.79 21,18V20H7V18C7,15.79 10.14,14 14,14M14,4A4,4 0 0,1 18,8A4,4 0 0,1 14,12A4,4 0 0,1 10,8A4,4 0 0,1 14,4M19,8H21V11H24V13H21V16H19V13H16V11H19V8Z" /></svg>);
const SearchIcon = () => (<svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24"><path fill="currentColor" d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" /></svg>);
const BackIcon = () => (<svg style={{ width: '24px', height: '24px' }} viewBox="0 0 24 24"><path fill="currentColor" d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z" /></svg>);
const TrashIcon = () => (<svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24"><path fill="currentColor" d="M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z" /></svg>);
const MenuIcon = () => (<svg style={{ width: '24px', height: '24px' }} viewBox="0 0 24 24"><path fill="currentColor" d="M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z" /></svg>);

const formatTime = (isoStr) => {
  if (!isoStr) return "";
  const date = new Date(isoStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const API_BASE_URL = 'http://localhost:8000';

const STATUS_ORDER = { 'FAILED': 0, 'SENT': 1, 'DLVR': 2, 'READ': 3 };

const Avatar = ({ src, name, size = 48 }) => {
  const [imgError, setImgError] = useState(false);
  const initial = (name || "R").charAt(0).toUpperCase();
  
  const style = {
    width: `${size}px`, height: `${size}px`, borderRadius: '50%', 
    backgroundColor: '#008069', color: 'white', display: 'flex', 
    alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', 
    fontSize: `${size * 0.4}px`, objectFit: 'cover', flexShrink: 0
  };

  // If the src is a relative URL (starts with /media/), prepend the backend base URL
  let imgSrc = src;
  if (imgSrc && imgSrc.startsWith('/media/')) {
    imgSrc = `${API_BASE_URL}${imgSrc}`;
  }

  // If we have a valid src and no error, show the image
  if (imgSrc && !imgError) {
    return <img src={imgSrc} style={style} alt="avatar" onError={() => setImgError(true)} />;
  }
  
  // Otherwise, show the initial letter
  return <div style={style}>{initial}</div>;
};

function Chat({ user, setUser }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [activeRoomData, setActiveRoomData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingTextMap, setTypingTextMap] = useState({});
  const [otherUserPresence, setOtherUserPresence] = useState({ online: false, last_seen: null });
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // UI State
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreate1to1Modal, setShowCreate1to1Modal] = useState(false); // <-- ADD THIS
  const [new1to1Phone, setNew1to1Phone] = useState('');                 // <-- ADD THIS
  const [showAddParticipantsModal, setShowAddParticipantsModal] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showContactInfoModal, setShowContactInfoModal] = useState(false);
  const [profileData, setProfileData] = useState({ about: "", avatar: "" });
  const [contactInfo, setContactInfo] = useState(null);

  // ADD THESE 3 LINES FOR BLOCKING
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [showBlockedListModal, setShowBlockedListModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  
  const [newGroupName, setNewGroupName] = useState('');
  const [contacts, setContacts] = useState([]);
  const [phonesToAdd, setPhonesToAdd] = useState('');
  const [activeMenuMsgId, setActiveMenuMsgId] = useState(null);

  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const activeRoomDataRef = useRef(activeRoomData);
  const pendingReadRef = useRef(null);

  useEffect(() => { activeRoomDataRef.current = activeRoomData; }, [activeRoomData]);

  const fetchRooms = async () => {
    try {
      const res = await api.get('/rooms/');
      const list = res.data.results || res.data;
      setRooms(list);
      if (activeRoom) {
        const current = list.find(r => r.id === activeRoom);
        setActiveRoomData(current);
      }
    } catch (err) { console.error(err); }
  };

  const fetchOnlineUsers = async () => {
    try {
      const res = await api.get('/users/online/');
      setOnlineUsers(new Set(res.data.map(u => u.id)));
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchRooms();
    fetchOnlineUsers();
    return () => { if (typingIntervalRef.current) clearInterval(typingIntervalRef.current); };
  }, []);

  useEffect(() => {
    if (!activeRoom) return;
    pendingReadRef.current = null;

    const token = localStorage.getItem('access_token');
    const ws = new WebSocket(`ws://localhost:8000/ws/chat/${activeRoom}/`, ['chat', token]);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'chat.mark_delivered' }));
      if (pendingReadRef.current) {
        ws.send(JSON.stringify({ type: 'chat.read', last_message_id: pendingReadRef.current }));
        pendingReadRef.current = null;
      }
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'chat.message') {
        setMessages(prev => {
          if (data.message.temp_id) {
            const tempIndex = prev.findIndex(m => m.id === data.message.temp_id);
            if (tempIndex !== -1) {
              const newMessages = [...prev];
              const oldStatus = prev[tempIndex].status;
              const newStatus = data.message.status;
              const bestStatus = STATUS_ORDER[newStatus] > STATUS_ORDER[oldStatus] ? newStatus : oldStatus;
              newMessages[tempIndex] = { ...data.message, status: bestStatus };
              return newMessages;
            }
          }

          const exists = prev.find(m => m.id === data.message.id);
          if (exists) {
            return prev.map(m => {
              if (m.id === data.message.id) {
                const bestStatus = STATUS_ORDER[data.message.status] > STATUS_ORDER[m.status] ? data.message.status : m.status;
                return { ...data.message, status: bestStatus };
              }
              return m;
            });
          }
          
          // FIX: If the message is marked as deleted and we don't have it locally 
          // (e.g., we already deleted it for ourselves), do NOT append it back.
          if (data.message.is_deleted) {
            return prev;
          }
          
          return [...prev, data.message];
        });

        updateRoomPreview(activeRoom, data.message);
        const senderId = typeof data.message.sender === 'object' ? data.message.sender.id : data.message.sender_id;
        if (senderId !== user.id) {
          ws.send(JSON.stringify({ type: 'chat.mark_delivered' }));
          if (document.hasFocus()) ws.send(JSON.stringify({ type: 'chat.read', last_message_id: data.message.id }));
        }
      }
      else if (data.type === 'chat.typing') {
        if (data.user_id !== user.id) {
          setTypingTextMap(prev => ({ ...prev, [activeRoom]: `${data.username} is typing...` }));
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setTypingTextMap(prev => ({ ...prev, [activeRoom]: '' })), 3000);
        }
      }
      else if (data.type === 'chat.read') {
        setMessages(prev => prev.map(m => {
          const msgSender = typeof m.sender === 'object' ? m.sender.id : m.sender_id;
          if (msgSender === user.id) return { ...m, status: 'READ' };
          return m;
        }));
      }
      else if (data.type === 'chat.delivered') {
        setMessages(prev => prev.map(m => {
          if (data.delivered_ids.includes(m.id)) return { ...m, status: 'DLVR' };
          return m;
        }));
      }
      else if (data.type === 'chat.status') {
        setMessages(prev => prev.map(m => {
          if (m.id === data.message_id) {
            const bestStatus = STATUS_ORDER[data.status] > STATUS_ORDER[m.status] ? data.status : m.status;
            return { ...m, status: bestStatus };
          }
          return m;
        }));
      }
      else if (data.type === 'presence.update') {
        const otherUser = activeRoomDataRef.current?.participants?.find(p => p.user.id !== user.id)?.user;
        if (otherUser && data.user_id === otherUser.id) {
          setOtherUserPresence({ online: data.online, last_seen: data.last_seen });
        }
        fetchOnlineUsers();
      }
      else if (data.type === 'room.update') {
        // Refetch rooms, which also updates activeRoomData and the open modals
        fetchRooms(); 
      }
      else if (data.type === 'system.kicked') {
        alert('You have been removed from this room.');
        setActiveRoom(null);
        fetchRooms();
      }
    };

    ws.onclose = () => { setOtherUserPresence({ online: false, last_seen: null }); };
    ws.onerror = () => console.error('WebSocket Error');

    return () => {
      ws.close();
      setMessages([]);
      setTypingTextMap(prev => ({ ...prev, [activeRoom]: '' }));
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    };
  }, [activeRoom, user]);

  useEffect(() => {
    if (!activeRoom) return;
    const fetchMessages = async () => {
      try {
        const res = await api.get(`/rooms/${activeRoom}/messages/`);
        const msgs = res.data.results || res.data;
        setMessages(msgs.reverse());

        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          const lastSender = typeof lastMsg.sender === 'object' ? lastMsg.sender.id : lastMsg.sender_id;

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'chat.mark_delivered' }));
            if (lastSender !== user.id) wsRef.current.send(JSON.stringify({ type: 'chat.read', last_message_id: lastMsg.id }));
          } else if (lastSender !== user.id) {
            pendingReadRef.current = lastMsg.id;
          }
        }
      } catch (err) { console.error(err); }
    };
    fetchMessages();
  }, [activeRoom, user]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingTextMap[activeRoom]]);

  // --- Global Notification Socket ---
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const ws = new WebSocket(`ws://localhost:8000/ws/notifications/`, ['chat', token]);
    
    ws.onopen = () => {
      console.log("Notification socket connected");
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'new_room') {
        // Instantly refresh the sidebar when someone starts a chat with you
        fetchRooms(); 
      }
    };

    ws.onclose = () => console.log('Notification socket closed');
    ws.onerror = () => console.error('Notification socket error');

    return () => {
      ws.close();
    };
  }, [user]); // Reconnect if user changes

  const updateRoomPreview = (roomId, message) => {
    setRooms(prevRooms => prevRooms.map(r =>
      r.id === roomId ? {
        ...r,
        last_message: {
          content: message.content,
          sender_id: typeof message.sender === 'object' ? message.sender.id : message.sender_id,
          sender: typeof message.sender === 'object' ? message.sender.username : message.sender,
          created_at: message.created_at,
          status: message.status
        }
      } : r
    ));
  };

  const safeSend = (data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    const text = messageText.trim();
    if (!text) return;

    const tempId = `temp-${Date.now()}`;
    const msgObj = {
      id: tempId, content: text, sender: { id: user.id, username: user.username },
      sender_id: user.id, status: 'SENT', created_at: new Date().toISOString()
    };

    if (!safeSend({ type: 'chat.message', content: text, temp_id: tempId })) msgObj.status = 'FAILED';

    setMessages(prev => [...prev, msgObj]);
    updateRoomPreview(activeRoom, msgObj);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    setMessageText(''); setIsTyping(false);
    safeSend({ type: 'chat.stop_typing' });
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
  };

  const handleTyping = (e) => {
    setMessageText(e.target.value);
    if (e.target.value.length > 0) {
      if (!isTyping) {
        setIsTyping(true);
        safeSend({ type: 'chat.typing' });
        typingIntervalRef.current = setInterval(() => safeSend({ type: 'chat.typing' }), 2000);
      }
    } else {
      if (isTyping) {
        setIsTyping(false);
        safeSend({ type: 'chat.stop_typing' });
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      }
    }
  };

  const handleLogout = () => { localStorage.clear(); setUser(null); };

  const handleClearChat = async () => {
    if (!window.confirm("Clear this chat? Messages will only be removed for you.")) return;
    try {
      await api.post(`/rooms/${activeRoom}/clear_chat/`);
      setMessages([]); // Instantly clear the screen
      setShowHeaderMenu(false);
    } catch (err) { alert("Failed to clear chat"); }
  };

  const handleDeleteContact = async () => {
    if (!window.confirm("Delete this contact? The chat will be removed from your list.")) return;
    try {
      await api.post(`/rooms/${activeRoom}/delete_contact/`);
      setShowHeaderMenu(false);
      setActiveRoom(null);
      fetchRooms(); // Remove from sidebar
    } catch (err) { alert("Failed to delete contact"); }
  };


  const handleDeleteForEveryone = (msgId) => {
    safeSend({ type: 'chat.delete', message_id: msgId });
    setActiveMenuMsgId(null);
  };

  // ADD THIS: Handle Delete for Me via REST API
  const handleDeleteForMe = async (msgId) => {
    try {
      await api.post(`/messages/${msgId}/delete/`);
      // Instantly remove from local state
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (err) { 
      console.error(err); 
      alert("Failed to delete message"); 
    }
    setActiveMenuMsgId(null);
  };

  const handleDeleteRoom = async () => {
    if (!window.confirm("Delete this room? This cannot be undone.")) return;
    try {
      await api.delete(`/rooms/${activeRoom}/`);
      setShowHeaderMenu(false);
      setActiveRoom(null);
      fetchRooms();
    } catch (err) { alert("Failed to delete room"); }
  };

  // ADD THIS: Allow non-admins to leave the group
  const handleLeaveRoom = async () => {
    if (!window.confirm("Leave this group?")) return;
    try {
      await api.post(`/rooms/${activeRoom}/leave/`);
      setShowHeaderMenu(false);
      setActiveRoom(null);
      fetchRooms();
    } catch (err) { alert("Failed to leave group"); }
  };


  const create1to1Room = async () => {
    if (!new1to1Phone.trim()) return alert("Phone number is required");
    try {
      const res = await api.post('/rooms/', { participant_phones: [new1to1Phone], is_group: false });
      await fetchRooms();
      handleSelectRoom(res.data);
      
      // FIX: Close modal and clear input on success
      setShowCreate1to1Modal(false);
      setNew1to1Phone('');
    } catch (err) { 
      alert(err.response?.data?.detail || "Failed to create room"); 
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return alert("Group name is required");
    try {
      const res = await api.post('/rooms/', { name: newGroupName, is_group: true, participant_phones: [] });
      setShowCreateGroupModal(false); setNewGroupName('');
      fetchRooms(); handleSelectRoom(res.data);
    } catch (err) { alert("Failed to create group"); }
  };

  const openAddParticipantsModal = async () => {
    try { const res = await api.get('/users/'); setContacts(res.data); setShowAddParticipantsModal(true); } catch (err) { console.error(err); }
  };

  const handleAddParticipants = async (selectedPhones) => {
    try {
      await api.post(`/rooms/${activeRoom}/add_participants/`, { phones: selectedPhones });
      setShowAddParticipantsModal(false); setPhonesToAdd('');
      fetchRooms(); alert("Participants added successfully!");
    } catch (err) { alert(err.response?.data?.detail || "Failed to add participants"); }
  };

  const handleSelectRoom = (room) => {
    setActiveRoom(room.id);
    setActiveRoomData(room);
    setIsBlocked(false); // <-- ADD THIS LINE to reset block state on room switch
    const otherUser = room.participants?.find(p => p.user.id !== user.id)?.user;
    if (otherUser) setOtherUserPresence({ online: onlineUsers.has(otherUser.id), last_seen: otherUser.last_seen });
  };

  // --- ADD THESE BLOCKING FUNCTIONS ---
  const handleBlockUser = async () => {
    if (!contactInfo || contactInfo.type === 'GRP') return;
    if (!window.confirm(`Block ${contactInfo.username}?`)) return;
    try {
      await api.post(`/users/${contactInfo.id}/block/`);
      setIsBlocked(true);
      alert("User blocked. They can no longer send you messages.");
      setShowContactInfoModal(false);
    } catch (err) { alert("Failed to block user"); }
  };

  const handleUnblockUser = async (userId) => {
    try {
      await api.post(`/users/${userId}/unblock/`);
      setBlockedUsers(prev => prev.filter(u => u.id !== userId));
      // If unblocking the user whose chat is currently open, update UI
      const otherUser = activeRoomData?.participants.find(p => p.user.id !== user.id)?.user;
      if (otherUser && otherUser.id === userId) {
        setIsBlocked(false);
      }
    } catch (err) { alert("Failed to unblock"); }
  };

  const openBlockedList = async () => {
    try {
      const res = await api.get('/users/blocked/');
      setBlockedUsers(res.data);
      setShowBlockedListModal(true);
    } catch (err) { console.error(err); }
  };



  // --- Profile Logic ---
  const openProfile = async () => {
    try {
      const res = await api.get('/users/me/');
      setProfileData({ about: res.data.about || "", avatar: res.data.avatar || "" });
      setShowProfileModal(true);
    } catch (err) { console.error(err); }
  };

  // --- Group Avatar Logic ---
  const handleGroupAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('avatar', file);
      
      // PATCH the room to update the group avatar
      // Do NOT set manual headers, Axios handles FormData automatically
      const res = await api.patch(`/rooms/${contactInfo.id}/`, formData);
      
      // Update the contactInfo modal state
      setContactInfo({ ...contactInfo, avatar: res.data.avatar });
      
      // Update the activeRoomData state if this is the active room
      if (activeRoom === contactInfo.id) {
        setActiveRoomData({ ...activeRoomData, avatar: res.data.avatar });
      }
      
      // Update the rooms list so the sidebar updates
      setRooms(prev => prev.map(r => r.id === contactInfo.id ? { ...r, avatar: res.data.avatar } : r));
      
    } catch (err) {
      console.error("Group avatar error:", err.response?.data || err.message);
      alert("Failed to update group avatar. Make sure you are an admin.");
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('about', profileData.about);
      if (profileData.avatarFile) formData.append('avatar', profileData.avatarFile);
      
      // FIX: Removed the manual headers. Axios handles FormData automatically.
      const res = await api.patch('/users/me/', formData);
      
      localStorage.setItem('username', res.data.username);
      localStorage.setItem('avatar', res.data.avatar || '');
      
      // Force React to re-render the avatar by creating a new object
      setUser({ ...user, username: res.data.username, avatar: res.data.avatar });
      
      setShowProfileModal(false);
    } catch (err) { 
      console.error("Profile update error:", err.response?.data || err.message);
      alert("Failed to update profile"); 
    }
  };

  const openContactInfo = async () => {
    if (!activeRoomData) return;
    setShowHeaderMenu(false);
    if (activeRoomData.type === 'ONE') {
      const otherUser = activeRoomData.participants.find(p => p.user.id !== user.id)?.user;
      if (otherUser) {
        try {
          const res = await api.get(`/users/${otherUser.id}/`);
          setContactInfo(res.data);
          setShowContactInfoModal(true);
        } catch (err) { console.error(err); }
      }
    } else {
      setContactInfo(activeRoomData);
      setShowContactInfoModal(true);
    }
  };

  const renderTicks = (status) => {
    if (status === 'FAILED') return <FailedIcon />;
    if (status === 'READ') return <DoubleTick color="#53bdeb" />;
    if (status === 'DLVR') return <DoubleTick />;
    if (status === 'SENT') return <SingleTick />;
    return null;
  };

  const styles = {
    sidebar: { backgroundColor: '#ffffff', borderRight: '1px solid #e9edef' },
    sidebarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f0f2f5', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    sidebarActions: { display: 'flex', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #e9edef' },
    actionButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 16px', backgroundColor: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#54656f', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', minWidth: '120px' },
    roomList: { flex: 1, overflowY: 'auto' },
    roomItem: { display: 'flex', alignItems: 'center', padding: '16px', cursor: 'pointer', borderBottom: '1px solid #e9edef', transition: 'background-color 0.2s', backgroundColor: 'transparent' },
    chatArea: { backgroundColor: '#efeae2' },
    chatHeader: { display: 'flex', alignItems: 'center', padding: '12px 16px', backgroundColor: '#008069', color: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', gap: '12px', position: 'relative' },
    searchContainer: { display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: '8px', padding: '4px 12px', flex: 1 },
    searchInput: { border: 'none', outline: 'none', width: '100%', padding: '8px 4px', fontSize: '14px', color: '#111b21' },
    messagesContainer: { flex: 1, overflowY: 'auto', padding: '20px', backgroundImage: 'linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)', backgroundSize: '20px 20px' },
    messageRow: { display: 'flex', flexDirection: 'column', marginBottom: '2px', alignItems: 'flex-start', position: 'relative' },
    messageBubble: { padding: '8px 12px', borderRadius: '8px', maxWidth: '65%', fontSize: '15px', lineHeight: '1.4', position: 'relative', boxShadow: '0 1px 0.5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' },
    bubbleIn: { backgroundColor: '#ffffff', borderTopLeftRadius: '0' },
    bubbleOut: { backgroundColor: '#d9fdd3', borderTopRightRadius: '0', marginLeft: 'auto' },
    messageMeta: { display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '2px', fontSize: '11px', color: '#667781' },
    msgActions: { position: 'absolute', top: '20px', right: '0', backgroundColor: 'white', borderRadius: '4px', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', zIndex: 20, overflow: 'hidden' },
    msgActionBtn: { padding: '10px 16px', cursor: 'pointer', color: '#111b21', border: 'none', background: 'transparent', fontSize: '14px', textAlign: 'left', whiteSpace: 'nowrap' },
    headerMenu: { position: 'absolute', top: '50px', right: '10px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, overflow: 'hidden' },
    headerMenuItem: { padding: '12px 24px', cursor: 'pointer', color: '#111b21', border: 'none', background: 'transparent', fontSize: '14px', textAlign: 'left', whiteSpace: 'nowrap', width: '100%' },
    inputArea: { display: 'flex', padding: '16px', backgroundColor: '#f0f2f5', alignItems: 'center', gap: '12px' },
    inputField: { flex: 1, padding: '12px 16px', border: 'none', borderRadius: '24px', outline: 'none', fontSize: '15px', backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    sendButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#008069', color: 'white', border: 'none', cursor: 'pointer', transition: 'transform 0.1s', boxShadow: '0 2px 5px rgba(0,128,105,0.3)' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalCard: { backgroundColor: 'white', padding: '24px', borderRadius: '8px', width: '400px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
    modalInput: { width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '16px', boxSizing: 'border-box' },
    modalBtn: { padding: '10px 16px', backgroundColor: '#008069', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 },
    contactItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #eee' }
  };

  return (
    <div className={`app-container ${activeRoom ? 'mobile-chat-active' : ''}`}>
      <div className="sidebar" style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={openProfile}>
            <Avatar src={user.avatar} name={user.username} size={40} />
            <h3 style={{ margin: 0, fontSize: '20px', color: '#54656f' }}>{user.username}</h3>
          </div>
          <button onClick={handleLogout} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#f15c6d', border: '1px solid #f15c6d', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>Logout</button>
        </div>

        <div style={styles.sidebarActions}>
          {/* FIX: Open modal instead of calling create1to1Room directly */}
          <button onClick={() => setShowCreate1to1Modal(true)} style={styles.actionButton}><PlusIcon /> 1-to-1</button>
          <button onClick={() => setShowCreateGroupModal(true)} style={styles.actionButton}><GroupIcon /> Group</button>
        </div>

        <div style={styles.roomList}>
          {rooms.map(room => {
            const isTypingInThisRoom = typingTextMap[room.id];
            const lastMsg = room.last_message;
            const lastMsgSender = lastMsg?.sender === user.username ? "You" : lastMsg?.sender;
            const isMyLastMsg = lastMsg?.sender_id === user.id;

            return (
              <div key={room.id} onClick={() => handleSelectRoom(room)} style={{ ...styles.roomItem, backgroundColor: activeRoom === room.id ? '#f0f2f5' : 'transparent' }}>
                <Avatar src={room.avatar} name={room.display_name || room.name} size={48} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', marginLeft: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{room.display_name || `Room`}</span>
                    {lastMsg && <span style={{ fontSize: '12px', color: '#667781', marginLeft: '8px' }}>{formatTime(lastMsg.created_at)}</span>}
                  </div>
                  {isTypingInThisRoom ? (
                    <div style={{ fontSize: '14px', color: '#008069', marginTop: '2px', fontStyle: 'italic' }}>{isTypingInThisRoom}</div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', color: '#667781', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isMyLastMsg && room.type === 'ONE' && renderTicks(lastMsg.status)}
                      <span>{lastMsgSender ? `${lastMsgSender}: ` : ''}{lastMsg?.content || 'No messages yet'}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="chat-area" style={styles.chatArea}>
        {!activeRoom ? (
          <div style={{ margin: 'auto', color: '#54656f', textAlign: 'center' }}><h2>Select a room to start chatting</h2></div>
        ) : (
          <>
            <div style={styles.chatHeader} onClick={() => setShowHeaderMenu(false)}>
              <button onClick={(e) => { e.stopPropagation(); setActiveRoom(null); }} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><BackIcon /></button>
              <div onClick={openContactInfo} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer' }}>
                <Avatar src={activeRoomData?.avatar} name={activeRoomData?.display_name || activeRoomData?.name} size={40} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 500, fontSize: '18px' }}>{activeRoomData?.display_name || 'Chat'}</span>
                  {/* FIX: Group typing indicator now shows in header */}
                  <span style={{ fontSize: '13px', opacity: 0.8, marginTop: '2px' }}>
                    {typingTextMap[activeRoom] || (activeRoomData?.type === 'ONE' ? (otherUserPresence.online ? 'online' : (otherUserPresence.last_seen ? `last seen ${formatTime(otherUserPresence.last_seen)}` : 'offline')) : '')}
                  </span>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setShowHeaderMenu(!showHeaderMenu); }} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><MenuIcon /></button>
              
              {showHeaderMenu && (
                <div style={styles.headerMenu} onClick={(e) => e.stopPropagation()}>
                  {activeRoomData?.type === 'GRP' && (
                    <>
                      {activeRoomData.participants?.find(p => p.user.id === user.id)?.is_admin ? (
                        <>
                          <button style={styles.headerMenuItem} onClick={() => { openAddParticipantsModal(); setShowHeaderMenu(false); }}>Add Participants</button>
                          <button style={{ ...styles.headerMenuItem, color: '#f15c6d' }} onClick={handleDeleteRoom}>Delete Group</button>
                        </>
                      ) : (
                        <button style={{ ...styles.headerMenuItem, color: '#f15c6d' }} onClick={handleLeaveRoom}>Leave Group</button>
                      )}
                    </>
                  )}
                  {activeRoomData?.type === 'ONE' && (
                    <>
                      <button style={styles.headerMenuItem} onClick={handleClearChat}>Clear Chat</button>
                      <button style={{ ...styles.headerMenuItem, color: '#f15c6d' }} onClick={handleDeleteContact}>Delete Contact</button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div ref={messagesContainerRef} style={styles.messagesContainer} onClick={() => { setActiveMenuMsgId(null); setShowHeaderMenu(false); }}>
              {messages.map((msg, index) => {
                const senderId = typeof msg.sender === 'object' ? msg.sender.id : msg.sender_id;
                const senderName = typeof msg.sender === 'object' ? msg.sender.username : msg.sender;
                const isMine = senderId === user.id;

                const prevMsg = index > 0 ? messages[index - 1] : null;
                const prevSenderId = prevMsg ? (typeof prevMsg.sender === 'object' ? prevMsg.sender.id : prevMsg.sender_id) : null;
                const isGrouped = prevMsg && prevSenderId === senderId && (new Date(msg.created_at) - new Date(prevMsg.created_at) < 120000);

                return (
                  <div key={msg.id} style={{ ...styles.messageRow, alignItems: isMine ? 'flex-end' : 'flex-start', marginTop: isGrouped ? '2px' : '12px' }}>
                    <div
                      style={{
                        ...styles.messageBubble,
                        ...(isMine ? styles.bubbleOut : styles.bubbleIn),
                        backgroundColor: msg.is_deleted ? '#eee' : (isMine ? '#d9fdd3' : '#ffffff'),
                        color: msg.is_deleted ? '#888' : '#111b21',
                        fontStyle: msg.is_deleted ? 'italic' : 'normal',
                        borderTopLeftRadius: (!isMine && isGrouped) ? '8px' : styles.bubbleIn.borderTopLeftRadius,
                        borderTopRightRadius: (isMine && isGrouped) ? '8px' : styles.bubbleOut.borderTopRightRadius,
                      }}
                      onClick={(e) => { e.stopPropagation(); if (!msg.is_deleted) setActiveMenuMsgId(prev => prev === msg.id ? null : msg.id); }}
                    >
                      {!isMine && activeRoomData?.type === 'GRP' && !isGrouped && (
                        <span style={{ fontSize: '13px', color: '#06cf9c', fontWeight: 600, marginBottom: '2px' }}>{senderName}</span>
                      )}
                      <span>{msg.content}</span>
                      <div style={{ ...styles.messageMeta, color: isMine && msg.status === 'FAILED' ? 'rgba(255,255,255,0.8)' : '#667781' }}>
                        {formatTime(msg.created_at)}
                        {isMine && renderTicks(msg.status)}
                      </div>
                    </div>

                    {activeMenuMsgId === msg.id && !msg.is_deleted && (
                      <div style={styles.msgActions} onClick={(e) => e.stopPropagation()}>
                        <button style={styles.msgActionBtn} onClick={() => handleDeleteForMe(msg.id)}>Delete for Me</button>
                        {isMine && (
                          <button style={{ ...styles.msgActionBtn, color: '#f15c6d' }} onClick={() => handleDeleteForEveryone(msg.id)}>Delete for Everyone</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} style={styles.inputArea}>
              <input style={styles.inputField} placeholder="Type a message" value={messageText} onChange={handleTyping} />
              <button type="submit" style={styles.sendButton}><SendIcon /></button>
            </form>
          </>
        )}
      </div>

      {/* My Profile Modal */}
      {showProfileModal && (
        <div style={styles.modalOverlay} onClick={() => setShowProfileModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#111b21' }}>Profile</h3>
            <form onSubmit={handleSaveProfile}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
                <Avatar src={profileData.avatar} name={user.username} size={80} />
                <label style={{ marginTop: '10px', color: '#008069', cursor: 'pointer', fontWeight: 500 }}>
                  Change Photo
                  <input type="file" accept="image/*" onChange={e => setProfileData({ ...profileData, avatarFile: e.target.files[0], avatar: URL.createObjectURL(e.target.files[0]) })} style={{ display: 'none' }} />
                </label>
              </div>
              <label style={{ fontSize: '14px', color: '#667781', display: 'block', marginBottom: '8px' }}>Username</label>
              <input style={styles.modalInput} value={user.username} disabled />
              <label style={{ fontSize: '14px', color: '#667781', display: 'block', marginBottom: '8px' }}>About</label>
              <input style={styles.modalInput} placeholder="Hey there! I am using WhatsApp Lite." value={profileData.about} onChange={e => setProfileData({ ...profileData, about: e.target.value })} />

              {/* ADD THIS BLOCKED LIST BUTTON */}
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
                <button type="button" onClick={openBlockedList} style={{ backgroundColor: 'transparent', color: '#008069', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                  View Blocked List
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowProfileModal(false)} style={{ ...styles.modalBtn, backgroundColor: '#e9edef', color: '#54656f', marginRight: '10px' }}>Cancel</button>
                <button type="submit" style={styles.modalBtn}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact Info Modal */}
      {showContactInfoModal && contactInfo && (
        <div style={styles.modalOverlay} onClick={() => setShowContactInfoModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#111b21' }}>{contactInfo.type === 'GRP' ? 'Group Info' : 'Contact Info'}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
              <Avatar src={contactInfo.avatar} name={contactInfo.type === 'GRP' ? contactInfo.name : contactInfo.username} size={100} />
              
              {/* GROUP AVATAR UPLOAD BUTTON - Always show for groups */}
              {contactInfo.type === 'GRP' && (
                <label style={{ marginTop: '10px', color: '#008069', cursor: 'pointer', fontWeight: 500 }}>
                  Change Group Photo
                  <input type="file" accept="image/*" onChange={handleGroupAvatarChange} style={{ display: 'none' }} />
                </label>
              )}
              
              <h2 style={{ margin: '15px 0 5px' }}>{contactInfo.type === 'GRP' ? contactInfo.name : contactInfo.username}</h2>
              {contactInfo.type !== 'GRP' && <p style={{ color: '#667781', margin: 0 }}>{contactInfo.phone}</p>}
              {contactInfo.type !== 'GRP' && <p style={{ color: '#667781', fontSize: '14px', marginTop: '5px', fontStyle: 'italic' }}>{contactInfo.about}</p>}
            </div>

            {/* ADD THIS BLOCK BUTTON FOR 1-TO-1 CHATS */}
            {contactInfo.type !== 'GRP' && (
              <button 
                onClick={handleBlockUser} 
                style={{ width: '100%', padding: '12px', backgroundColor: '#fdecee', color: '#f15c6d', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, marginBottom: '16px' }}
              >
                Block User
              </button>
            )}

            {contactInfo.type === 'GRP' && (
              <div style={{ borderTop: '1px solid #eee', paddingTop: '15px' }}>
                <h4>Participants ({contactInfo.participants?.length})</h4>
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {contactInfo.participants?.map(p => (
                    <div key={p.user.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
                      <Avatar src={p.user.avatar} name={p.user.username} size={32} />
                      <span>{p.user.username} {p.is_admin && '(Admin)'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setShowContactInfoModal(false)} style={{ ...styles.modalBtn, backgroundColor: '#e9edef', color: '#54656f' }}>Close</button>
            </div>
          </div>
        </div>
      )}


      {/* Create 1-to-1 Modal */}
      {showCreate1to1Modal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreate1to1Modal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#111b21' }}>New 1-to-1 Chat</h3>
            <input 
              style={styles.modalInput} 
              placeholder="Enter phone number (e.g. +1234567890)" 
              value={new1to1Phone} 
              onChange={e => setNew1to1Phone(e.target.value)} 
              autoFocus 
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowCreate1to1Modal(false)} style={{ ...styles.modalBtn, backgroundColor: '#e9edef', color: '#54656f' }}>Cancel</button>
              <button onClick={create1to1Room} style={styles.modalBtn}>Start Chat</button>
            </div>
          </div>
        </div>
      )}

      

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateGroupModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#111b21' }}>Create New Group</h3>
            <input style={styles.modalInput} placeholder="Enter group name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} autoFocus />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowCreateGroupModal(false)} style={{ ...styles.modalBtn, backgroundColor: '#e9edef', color: '#54656f' }}>Cancel</button>
              <button onClick={handleCreateGroup} style={styles.modalBtn}>Create Group</button>
            </div>
          </div>
        </div>
      )}

      {showAddParticipantsModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAddParticipantsModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#111b21' }}>Add Participants</h3>
            <label style={{ fontSize: '14px', color: '#667781', display: 'block', marginBottom: '8px' }}>Enter phone numbers (comma separated):</label>
            <input style={styles.modalInput} placeholder="+1234567890, +9876543210" value={phonesToAdd} onChange={(e) => setPhonesToAdd(e.target.value)} />
            <button onClick={() => { const p = phonesToAdd.split(',').map(p => p.trim()).filter(p => p); if (p.length) handleAddParticipants(p); }} style={{ ...styles.modalBtn, width: '100%', marginBottom: '24px' }}>Add Numbers</button>
            <div style={{ borderTop: '1px solid #e9edef', paddingTop: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#54656f' }}>Or select from contacts:</h4>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {contacts.map(c => {
                  const isAlreadyInRoom = activeRoomData?.participants?.some(p => p.user.id === c.id);
                  return (
                    <div key={c.id} style={styles.contactItem}>
                      <span style={{ fontWeight: 500 }}>{c.username} ({c.phone})</span>
                      <button onClick={() => handleAddParticipants([c.phone])} disabled={isAlreadyInRoom} style={{ ...styles.modalBtn, padding: '6px 12px', backgroundColor: isAlreadyInRoom ? '#ccc' : '#008069', cursor: isAlreadyInRoom ? 'not-allowed' : 'pointer' }}>{isAlreadyInRoom ? 'Added' : 'Add'}</button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setShowAddParticipantsModal(false)} style={{ ...styles.modalBtn, backgroundColor: '#e9edef', color: '#54656f' }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Blocked List Modal */}
      {showBlockedListModal && (
        <div style={styles.modalOverlay} onClick={() => setShowBlockedListModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#111b21' }}>Blocked Users</h3>
            {blockedUsers.length === 0 ? (
              <p style={{ color: '#667781' }}>You haven't blocked anyone.</p>
            ) : (
              <div>
                {blockedUsers.map(u => (
                  <div key={u.id} style={styles.contactItem}>
                    <span style={{ fontWeight: 500 }}>{u.username} ({u.phone})</span>
                    <button onClick={() => handleUnblockUser(u.id)} style={{ ...styles.modalBtn, padding: '6px 12px', fontSize: '12px' }}>Unblock</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setShowBlockedListModal(false)} style={{ ...styles.modalBtn, backgroundColor: '#e9edef', color: '#54656f' }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;