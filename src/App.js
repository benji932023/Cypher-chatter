import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { getOrCreateKeypair, exportPublicKey, encryptGroupMessage, decryptGroupMessage, generateRoomCode } from './crypto';

const RELAY_URL = process.env.REACT_APP_RELAY_URL || 'ws://localhost:8080';

const styles = {
  app: { height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#e0e0e0', fontFamily: "'Courier New', monospace" },
  header: { padding: '12px 20px', borderBottom: '1px solid #1a1a2e', background: '#050510', display: 'flex', alignItems: 'center', gap: '12px' },
  logo: { fontSize: '18px', color: '#00ff88', fontWeight: 'bold', letterSpacing: '2px' },
  badge: { fontSize: '10px', background: '#00ff8820', color: '#00ff88', border: '1px solid #00ff8840', borderRadius: '4px', padding: '2px 8px' },
  roomInfo: { marginLeft: 'auto', fontSize: '11px', color: '#555' },
  landing: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '20px' },
  title: { fontSize: '32px', color: '#00ff88', letterSpacing: '4px', textAlign: 'center' },
  subtitle: { fontSize: '13px', color: '#444', textAlign: 'center', maxWidth: '400px', lineHeight: '1.6' },
  card: { background: '#111', border: '1px solid #1a1a2e', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '12px' },
  label: { fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px' },
  input: { background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px', padding: '10px 14px', color: '#e0e0e0', fontFamily: "'Courier New', monospace", fontSize: '14px', outline: 'none', width: '100%' },
  btn: { background: '#00ff88', color: '#0a0a0a', border: 'none', borderRadius: '8px', padding: '10px 20px', fontFamily: "'Courier New', monospace", fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' },
  btnGhost: { background: 'transparent', color: '#00ff88', border: '1px solid #00ff8840', borderRadius: '8px', padding: '10px 20px', fontFamily: "'Courier New', monospace", fontSize: '13px', cursor: 'pointer', letterSpacing: '1px' },
  divider: { textAlign: 'center', color: '#333', fontSize: '12px' },
  messages: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' },
  message: { maxWidth: '70%', padding: '8px 14px', borderRadius: '12px', fontSize: '13px', lineHeight: '1.5' },
  myMessage: { alignSelf: 'flex-end', background: '#00ff8820', border: '1px solid #00ff8840', color: '#e0e0e0' },
  theirMessage: { alignSelf: 'flex-start', background: '#111', border: '1px solid #1a1a2e', color: '#e0e0e0' },
  systemMessage: { alignSelf: 'center', color: '#333', fontSize: '11px', fontStyle: 'italic' },
  senderName: { fontSize: '10px', color: '#00ff88', marginBottom: '2px' },
  inputRow: { display: 'flex', gap: '8px', padding: '12px 20px', borderTop: '1px solid #1a1a2e', background: '#050510' },
  msgInput: { flex: 1, background: '#111', border: '1px solid #1a1a2e', borderRadius: '8px', padding: '10px 14px', color: '#e0e0e0', fontFamily: "'Courier New', monospace", fontSize: '13px', outline: 'none' },
  sendBtn: { background: '#00ff88', color: '#0a0a0a', border: 'none', borderRadius: '8px', padding: '10px 16px', fontFamily: "'Courier New', monospace", fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
  peers: { fontSize: '11px', color: '#00ff8880' },
  codeBox: { background: '#0a0a0a', border: '1px solid #00ff8830', borderRadius: '8px', padding: '10px 14px', color: '#00ff88', fontSize: '18px', letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold' },
  copyBtn: { fontSize: '11px', color: '#00ff88', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', textAlign: 'center' }
};
  export default function App() {
  const keypair = getOrCreateKeypair();
  const myPublicKey = exportPublicKey(keypair);
  const [screen, setScreen] = useState('landing');
  const [nickname, setNickname] = useState(localStorage.getItem('cipher_nickname') || '');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [peers, setPeers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [inRoom, setInRoom] = useState(false);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef(null);
  const activeRoomCode = useRef('');

  const addMessage = useCallback((msg) => setMessages(prev => [...prev, msg]), []);

  const { send } = useWebSocket(RELAY_URL, useCallback((data) => {
    switch (data.type) {
      case '_connected': setConnected(true); break;
      case '_disconnected': setConnected(false); addMessage({ system: true, text: 'Connection lost. Reconnecting...' }); break;
      case 'joined': setInRoom(true); addMessage({ system: true, text: 'Joined room. You are anonymous — identified only by your key.' }); break;
      case 'peer_list': setPeers(data.peers); if (data.peers.length > 0) addMessage({ system: true, text: `${data.peers.length} other member(s) in room.` }); break;
      case 'peer_joined': setPeers(prev => [...prev, { clientId: data.clientId, publicKey: data.publicKey, nickname: data.nickname }]); addMessage({ system: true, text: `${data.nickname} joined the room.` }); break;
      case 'peer_left': setPeers(prev => prev.filter(p => p.clientId !== data.clientId)); addMessage({ system: true, text: 'A member left the room.' }); break;
      case 'message': { const decrypted = decryptGroupMessage(data.payload, activeRoomCode.current); if (decrypted) addMessage({ from: data.clientId, nickname: data.nickname, text: decrypted, timestamp: data.timestamp, mine: false }); break; }
      default: break;
    }
  }, [addMessage]));

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function handleCreate() { const code = generateRoomCode(); setRoomCode(code); setScreen('create'); }
  function handleJoinRoom(code) {
    const nick = nickname || 'Ghost';
    localStorage.setItem('cipher_nickname', nick);
    activeRoomCode.current = code;
    setRoomCode(code);
    send({ type: 'join', roomId: code, publicKey: myPublicKey, nickname: nick });
    setScreen('chat');
  }
  function handleSend() {
    if (!input.trim() || !inRoom) return;
    const encrypted = encryptGroupMessage(input.trim(), activeRoomCode.current);
    send({ type: 'message', payload: encrypted });
    addMessage({ mine: true, text: input.trim(), timestamp: Date.now(), nickname: nickname || 'You' });
    setInput('');
  }
  function handleCopy(text) { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
<pre>if (screen === 'landing') return (
    <div style={styles.app}>
      <div style={styles.header}>
        <span style={styles.logo}>⬡ CIPHER</span>
        <span style={styles.badge}>E2E ENCRYPTED</span>
        <span style={styles.roomInfo}>{connected ? '● relay connected' : '○ connecting...'}</span>
      </div>
      <div style={styles.landing}>
        <div style={styles.title}>CIPHER CHAT</div>
        <div style={styles.subtitle}>End-to-end encrypted. No accounts. No logs. No traces.<br />Your messages are encrypted before they leave your device.</div>
        <div style={styles.card}>
          <div style={styles.label}>Your nickname (optional)</div>
          <input style={styles.input} placeholder="Ghost" value={nickname} onChange={e => setNickname(e.target.value)} />
          <button style={styles.btn} onClick={handleCreate}>+ Create Room</button>
          <div style={styles.divider}>— or —</div>
          <div style={styles.label}>Enter room code to join</div>
          <input style={styles.input} placeholder="XXXXXXXXXXXXXXXX" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} />
          <button style={styles.btnGhost} onClick={() => joinCode && handleJoinRoom(joinCode)}>Join Room</button>
        </div>
      </div>
    </div>
  );

  if (screen === 'create') return (
    <div style={styles.app}>
      <div style={styles.header}><span style={styles.logo}>⬡ CIPHER</span><span style={styles.badge}>E2E ENCRYPTED</span></div>
      <div style={styles.landing}>
        <div style={{ fontSize: '14px', color: '#00ff88', letterSpacing: '2px' }}>ROOM CREATED</div>
        <div style={styles.card}>
          <div style={styles.label}>Your room code — share this with your circle</div>
          <div style={styles.codeBox}>{roomCode}</div>
          <button style={styles.copyBtn} onClick={() => handleCopy(roomCode)}>{copied ? '✓ Copied!' : 'Copy code'}</button>
          <div style={{ fontSize: '11px', color: '#444', lineHeight: '1.6' }}>⚠️ Only share this code through a secure channel. Anyone with this code can join the room.</div>
          <button style={styles.btn} onClick={() => handleJoinRoom(roomCode)}>Enter Room →</button>
        </div>
      </div>
    </div>
  );

  if (screen === 'chat') return (
    <div style={styles.app}>
      <div style={styles.header}>
        <span style={styles.logo}>⬡ CIPHER</span>
        <span style={styles.badge}>E2E ENCRYPTED</span>
        <span style={styles.peers}>{peers.length + 1} member{peers.length !== 0 ? 's' : ''}</span>
        <span style={styles.roomInfo}>{connected ? '● live' : '○ reconnecting...'}</span>
      </div>
      <div style={styles.messages}>
        {messages.map((msg, i) => msg.system ? (
          <div key={i} style={styles.systemMessage}>{msg.text}</div>
        ) : (
          <div key={i} style={{ alignSelf: msg.mine ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
            {!msg.mine && <div style={styles.senderName}>{msg.nickname}</div>}
            <div style={{ ...styles.message, ...(msg.mine ? styles.myMessage : styles.theirMessage) }}>{msg.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div style={styles.inputRow}>
        <input style={styles.msgInput} placeholder="Type a message..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} />
        <button style={styles.sendBtn} onClick={handleSend}>SEND</button>
      </div>
    </div>
  );
}</pre>


