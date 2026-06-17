import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for WebSocket connections
 * Handles connection, reconnection, message sending/receiving
 *
 * @param {string} url - WebSocket URL
 * @param {function} onMessage - Callback when message is received
 * @param {object} options - Configuration options
 * @param {number} options.reconnectInterval - Milliseconds to wait before reconnecting (default: 3000)
 * @param {number} options.maxReconnectAttempts - Max reconnection attempts (default: 5)
 * @param {boolean} options.autoConnect - Auto connect on mount (default: true)
 * @returns {object} WebSocket state and methods
 */
export const useWebSocket = (url, onMessage, options = {}) => {
  const {
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    autoConnect = true,
  } = options;

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const messageQueueRef = useRef([]);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [readyState, setReadyState] = useState(null);

  // Connect to WebSocket
  const connect = (connectUrl = url) => {
    if (!connectUrl) {
      console.error('WebSocket URL is required');
      return;
    }

    if (isConnecting || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ws = new WebSocket(connectUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        setReadyState(ws.readyState);
        reconnectAttemptsRef.current = 0;

        // Send queued messages
        while (messageQueueRef.current.length > 0) {
          const message = messageQueueRef.current.shift();
          ws.send(JSON.stringify(message));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) {
            onMessage(data);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
          if (onMessage) {
            onMessage(event.data);
          }
        }
      };

      ws.onerror = (wsEvent) => {
        console.error('WebSocket error:', wsEvent);
        const errorMsg = 'WebSocket connection error';
        setError(errorMsg);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setIsConnecting(false);
        setReadyState(ws.readyState);

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          console.log(
            `Reconnecting... Attempt ${reconnectAttemptsRef.current} of ${maxReconnectAttempts}`
          );
          reconnectTimeoutRef.current = setTimeout(() => {
            connect(connectUrl);
          }, reconnectInterval);
        } else {
          const finalError = `Max reconnection attempts (${maxReconnectAttempts}) reached`;
          console.error(finalError);
          setError(finalError);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError(err.message);
      setIsConnecting(false);
    }
  };

  // Disconnect from WebSocket
  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setError(null);
    messageQueueRef.current = [];
  };

  // Send message
  const send = (data) => {
    const message = typeof data === 'string' ? data : JSON.stringify(data);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
      return true;
    } else {
      // Queue message if not connected
      messageQueueRef.current.push(data);
      return false;
    }
  };

  // Send message and wait for response
  const sendAsync = (data, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('WebSocket message timeout'));
      }, timeout);

      const originalOnMessage = onMessage;
      const tempOnMessage = (response) => {
        clearTimeout(timeoutId);
        resolve(response);
        if (originalOnMessage) {
          originalOnMessage(response);
        }
      };

      // Temporarily override onMessage to capture response
      const previousCallback = onMessage;
      const socket = wsRef.current;
      if (!socket) {
        clearTimeout(timeoutId);
        reject(new Error('WebSocket not connected'));
        return;
      }
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          tempOnMessage(data);
        } catch (err) {
          tempOnMessage(event.data);
        }
        // Restore original handler
        if (previousCallback) {
          socket.onmessage = (e) => {
            const d = JSON.parse(e.data);
            previousCallback(d);
          };
        }
      };

      send(data);
    });
  };

  // Reset reconnection attempts
  const resetReconnectAttempts = () => {
    reconnectAttemptsRef.current = 0;
  };

  // Initialize connection
  useEffect(() => {
    if (autoConnect && url) {
      connect(url);
    }

    return () => {
      disconnect();
    };
  }, [url, autoConnect]);

  return {
    isConnected,
    isConnecting,
    error,
    readyState,
    connect,
    disconnect,
    send,
    sendAsync,
    resetReconnectAttempts,
    ws: wsRef.current,
  };
};

/**
 * Hook for managing multiple WebSocket subscriptions
 *
 * @param {string} baseUrl - Base WebSocket URL
 * @param {object} subscriptions - Map of subscription name to handler
 * @returns {object} WebSocket state and subscription methods
 */
export const useWebSocketSubscriptions = (baseUrl, subscriptions = {}) => {
  const [activeSubscriptions, setActiveSubscriptions] = useState(new Set());

  const handleMessage = (data) => {
    const { type, payload } = data;
    if (subscriptions[type]) {
      subscriptions[type](payload);
    }
  };

  const { send, ...wsState } = useWebSocket(baseUrl, handleMessage);

  const subscribe = (topic) => {
    send({ type: 'subscribe', topic });
    setActiveSubscriptions((prev) => new Set([...prev, topic]));
  };

  const unsubscribe = (topic) => {
    send({ type: 'unsubscribe', topic });
    setActiveSubscriptions((prev) => {
      const next = new Set(prev);
      next.delete(topic);
      return next;
    });
  };

  const subscribeToMultiple = (topics) => {
    topics.forEach(subscribe);
  };

  const unsubscribeFromAll = () => {
    activeSubscriptions.forEach(unsubscribe);
  };

  return {
    ...wsState,
    activeSubscriptions: Array.from(activeSubscriptions),
    subscribe,
    unsubscribe,
    subscribeToMultiple,
    unsubscribeFromAll,
    send,
  };
};

/**
 * Hook for managing WebSocket connection with auth
 *
 * @param {string} baseUrl - Base WebSocket URL (without protocol)
 * @param {string} userId - User ID for the connection
 * @param {string} token - Auth token
 * @param {function} onMessage - Message handler
 * @returns {object} WebSocket state and methods
 */
export const useAuthenticatedWebSocket = (
  baseUrl,
  userId,
  token,
  onMessage
) => {
  const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Pass token as a query parameter so the backend can authenticate before accepting the connection
  const url = userId && token
    ? `${wsProtocol}//${baseUrl}/ws/${userId}?token=${encodeURIComponent(token)}`
    : null;

  const { send, ...wsState } = useWebSocket(url, onMessage, {
    autoConnect: !!token && !!userId,
  });

  return {
    ...wsState,
    send,
  };
};

export default useWebSocket;
