// App.js
import React, { useState, useEffect, useRef } from 'react';
import EmojiPicker from 'emoji-picker-react';
import io from 'socket.io-client';
import './styles/App.css';

const socket = io('http://localhost:5000');

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [receiver, setReceiver] = useState('');
  const [group, setGroup] = useState('');
  const [chatMode, setChatMode] = useState('private');
  const [availableGroups] = useState(['General', 'Study', 'Chill']);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [typingUser, setTypingUser] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const chatEndRef = useRef(null);

  // --- SOCKET SETUP ---
  useEffect(() => {
    socket.on('receive_message', (msg) => {
      if (
        (msg.username === username && msg.receiver === receiver) ||
        (msg.username === receiver && msg.receiver === username) ||
        (msg.receiver === username && !receiver)
      ) {
        setChat(prev => [...prev, msg]);
      }
    });

    socket.on('receive_group_message', (msg) => {
      if (chatMode === 'group' && msg.group === group) {
        setChat(prev => [...prev, msg]);
      }
    });

    socket.on('receive_message_history', (messages) => {
      const filtered = messages.filter(msg =>
        (msg.username === username && msg.receiver === receiver) ||
        (msg.username === receiver && msg.receiver === username)
      );
      setChat(filtered);
    });

    socket.on('typing', (typingName) => {
      if (typingName !== username) {
        setTypingUser(typingName);
        setTimeout(() => setTypingUser(''), 2000);
      }
    });

    socket.on('online_users', (users) => {
      setOnlineUsers([...new Set(users)]);
    });

    socket.on('message_edited', (updated) => {
      setChat(prev =>
        prev.map(msg => msg.id === updated.id ? { ...msg, message: updated.message } : msg)
      );
    });

    socket.on('message_deleted', (id) => {
      setChat(prev => prev.filter(msg => msg.id !== id));
    });

    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      socket.off();
    };
  }, [username, receiver, group, chatMode]);

  useEffect(() => {
    const handleGroupHistory = (messages) => {
      const filtered = messages.filter(msg => msg.group === group);
      setChat(filtered);
    };

    socket.on('receive_group_history', handleGroupHistory);
    return () => socket.off('receive_group_history', handleGroupHistory);
  }, [group]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  useEffect(() => {
    if (chatMode === 'group' && group) {
      socket.emit('join_group', group);
    }
  }, [group, chatMode]);

  // --- MESSAGE SENDER ---
  const sendMessage = () => {
    if (!message.trim()) return;

    const data = {
      id: Date.now(),
      username,
      message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    if (editingMessageId) {
      socket.emit('edit_message', { id: editingMessageId, message, username });
      setEditingMessageId(null);
    } else if (chatMode === 'group') {
      if (!group) return;
      data.group = group;
      socket.emit('send_group_message', data);
    } else {
      // ✅ Send to self if no receiver selected
      data.receiver = receiver || username;
      socket.emit('send_message', data);
    }

    setMessage('');
    setShowEmojiPicker(false);
  };

  const handleEdit = (msg) => {
    setMessage(msg.message);
    setEditingMessageId(msg.id);
    setOpenMenuId(null);
  };

  const handleDelete = (id) => {
    socket.emit('delete_message', id);
    setOpenMenuId(null);
  };

  const handleLogin = () => {
    if (username.trim() && password.trim()) {
      setChat([]);
      socket.emit('login', username);
      setLoggedIn(true);
    } else {
      alert('Please enter both username and password');
    }
  };

  const handleEmojiClick = (emojiData) => {
    setMessage(prev => prev + emojiData.emoji);
  };

  if (!loggedIn) {
    return (
      <div className="login">
        <div className="login-card">
          <h1 style={{ color: '#4a90e2' }}>ChatifyX</h1>
          <h2>Login to Continue</h2>
          <input
            type="text"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button onClick={handleLogin}>Join Chat</button>
        </div>
      </div>
    );
  }

  // --- MAIN UI ---
  return (
    <div className="chat-container">
      <h2>ChatifyX</h2>

      <div className="online-users">
        <strong>Online:</strong> {[...new Set(onlineUsers)].join(', ')}
      </div>

      <div className="receiver-select">
        <label>Chat Mode:</label>
        <select value={chatMode} onChange={(e) => { setChatMode(e.target.value); setChat([]); }}>
          <option value="private">Private</option>
          <option value="group">Group</option>
        </select>

        {chatMode === 'private' ? (
          <>
            <label>User:</label>
            <select value={receiver} onChange={(e) => { setReceiver(e.target.value); setChat([]); }}>
              <option value="">(Just You)</option>
              {onlineUsers.filter(user => user !== username).map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label>Group:</label>
            <select value={group} onChange={(e) => { setGroup(e.target.value); setChat([]); }}>
              {availableGroups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="chat-box">
        {chat.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.username === username ? 'you' : 'other'}`}>
            <div className="chat-meta">
              <div>{msg.username}</div>
              {msg.username === username && (
                <div className="menu-trigger" onClick={(e) => e.stopPropagation()}>
                  <button className="menu-button" onClick={() => setOpenMenuId(openMenuId === msg.id ? null : msg.id)}>⋮</button>
                  {openMenuId === msg.id && (
                    <div className="message-menu">
                      <button onClick={() => handleEdit(msg)}>Edit</button>
                      <button onClick={() => handleDelete(msg.id)}>Delete</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="chat-text">{msg.message}</div>
            <div className="chat-time">{msg.time}</div>
          </div>
        ))}
        {typingUser && <div className="typing-indicator">{typingUser} is typing...</div>}
        <div ref={chatEndRef} />
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={message}
          placeholder="Type your message..."
          onChange={(e) => {
            setMessage(e.target.value);
            socket.emit('typing', username);
          }}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={() => setShowEmojiPicker(prev => !prev)}>😊</button>
        <button onClick={sendMessage}>
          {editingMessageId ? 'Update' : 'Send'}
        </button>
        {showEmojiPicker && (
          <div style={{ position: 'absolute', bottom: '70px', right: '20px', zIndex: 10 }}>
            <EmojiPicker onEmojiClick={handleEmojiClick} previewConfig={{ showPreview: false }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
