import { useEffect, useRef, useCallback } from 'react';
import { useSystemState } from './SystemState';

export function useNeuralSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const setTelemetry = useSystemState((s) => s.setTelemetry);
  const setInference = useSystemState((s) => s.setInference);
  const setLastInferenceResult = useSystemState((s) => s.setLastInferenceResult);

  useEffect(() => {
    let reconnectTimeout: number;

    const connect = () => {
      try {
        const socket = new WebSocket('ws://localhost:3001/ws/telemetry');
        wsRef.current = socket;

        socket.onopen = () => {
          console.log('[NEURAL SOCKET] Connected to telemetry pipeline.');
          setTelemetry({ online: true });
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'TELEMETRY_TICK') {
              setTelemetry({
                cpuUsage: data.metrics.cpuUsage,
                memoryUsedMB: data.metrics.memoryUsedMB,
                memoryPercent: data.metrics.memoryPercent,
                activeNodes: data.metrics.activeNodes,
                gflops: data.metrics.simulatedTensorsGFLOPS,
                online: true,
              });
            } else if (data.type === 'INFERENCE_STATE_CHANGE') {
              setInference(data.state);
              if (data.result) {
                setLastInferenceResult(data.result);
              }
            }
          } catch (err) {
            console.error('[NEURAL SOCKET] Parse error:', err);
          }
        };

        socket.onclose = () => {
          setTelemetry({ online: false });
          reconnectTimeout = window.setTimeout(connect, 3000);
        };

        socket.onerror = () => {
          socket.close();
        };
      } catch (e) {
        setTelemetry({ online: false });
        reconnectTimeout = window.setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [setTelemetry, setInference, setLastInferenceResult]);

  // Dispatch inference action to backend
  const dispatchInference = useCallback(async (module: string, payload: any) => {
    try {
      const endpoint = `http://localhost:3001/api/inference/${module}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err) {
      console.warn('[NEURAL API] Backend request failed:', err);
      return { success: false, error: 'Connection to backend failed' };
    }
  }, []);

  return { dispatchInference };
}
