import { useEffect, useRef, useState } from 'react';
import { useSystemState } from '../engine/SystemState';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokens: number;
  latency_ms: number;
}

export interface MLServerStatus {
  connected: boolean;
  backend: string;
  latency: number;
}

export function useMLServer() {
  const [status, setStatus] = useState<MLServerStatus>({ connected: false, backend: 'none', latency: 0 });
  const [streamingTokens, setStreamingTokens] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const setLastInferenceResult = useSystemState((s) => s.setLastInferenceResult);

  useEffect(() => {
    // Check ML server health on mount and every 10s
    const checkHealth = async () => {
      const start = Date.now();
      try {
        const res = await fetch('http://localhost:8000/ml/health');
        if (res.ok) {
          const data = await res.json();
          setStatus({ connected: true, backend: data.backend, latency: Date.now() - start });
        } else {
          setStatus((prev) => ({ ...prev, connected: false }));
        }
      } catch {
        setStatus((prev) => ({ ...prev, connected: false }));
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const embed = async (text: string): Promise<EmbeddingResult | null> => {
    try {
      const res = await fetch('http://localhost:8000/ml/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, dim: 512 }),
      });
      if (res.ok) {
        const data: EmbeddingResult = await res.json();
        setLastInferenceResult(data);
        return data;
      }
    } catch {
      // ML server offline — fail silently
    }
    return null;
  };

  const streamGenerate = (prompt: string, maxTokens: number = 50) => {
    // Close any existing stream before opening a new one
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket('ws://localhost:8000/ml/ws/stream');
    wsRef.current = ws;
    setStreamingTokens([]);
    setIsStreaming(true);

    ws.onopen = () => {
      ws.send(JSON.stringify({ prompt, max_tokens: maxTokens }));
    };

    ws.onmessage = (ev: MessageEvent) => {
      const data = JSON.parse(ev.data as string);
      if (data.done) {
        setIsStreaming(false);
        ws.close();
      } else {
        setStreamingTokens((prev) => [...prev.slice(-19), data.token as string]);
      }
    };

    ws.onerror = () => {
      setIsStreaming(false);
    };

    ws.onclose = () => {
      setIsStreaming(false);
    };
  };

  const stopStream = () => {
    wsRef.current?.close();
    setIsStreaming(false);
  };

  return { status, embed, streamGenerate, stopStream, streamingTokens, isStreaming };
}
