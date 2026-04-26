import { useEffect, useRef, useCallback } from 'react';

export function useWebSocket(url, onMessage) {
  const wsRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => onMessageRef.current({ type: '_connected' });
    ws.onmessage = (event) => {
      try { onMessageRef.current(JSON.parse(event.data)); } catch {}
    };
    ws.onclose = () => {
      onMessageRef.current({ type: '_disconnected' });
      setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();
  }, [url]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}
