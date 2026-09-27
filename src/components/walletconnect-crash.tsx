'use client';

import { useCallback, useRef, useEffect, useState } from 'react';

interface WalletConnectCrashGuardOptions {
  timeout?: number;
  maxRetries?: number;
  fallbackUrl?: string;
}

interface WalletConnectState {
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  retryCount: number;
}

export function useWalletConnectCrashGuard(
  options: WalletConnectCrashGuardOptions = {}
) {
  const { timeout = 30000, maxRetries = 3, fallbackUrl } = options;
  const [state, setState] = useState<WalletConnectState>({
    isConnected: false,
    isLoading: false,
    error: null,
    retryCount: 0,
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const sessionIdRef = useRef(crypto.randomUUID());

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    timeoutRef.current = null;
    retryTimeoutRef.current = null;
  }, []);

  const connect = useCallback(async () => {
    if (!isMountedRef.current) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    clearTimers();

    try {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch('/api/walletconnect/session', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`WalletConnect session failed: ${response.status}`);
      }

      if (!isMountedRef.current) return;

      setState({ isConnected: true, isLoading: false, error: null, retryCount: 0 });
    } catch (err) {
      if (!isMountedRef.current) return;

      const error = err instanceof Error ? err : new Error('WalletConnect connection failed');
      const currentRetry = state.retryCount;

      if (currentRetry < maxRetries) {
        retryTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setState((prev) => ({ ...prev, retryCount: prev.retryCount + 1 }));
            connect();
          }
        }, 2000 * (currentRetry + 1));
      } else {
        setState({
          isConnected: false,
          isLoading: false,
          error,
          retryCount: currentRetry,
        });
      }
    }
  }, [timeout, maxRetries, state.retryCount, clearTimers]);

  const disconnect = useCallback(() => {
    clearTimers();
    if (isMountedRef.current) {
      setState({ isConnected: false, isLoading: false, error: null, retryCount: 0 });
    }
  }, [clearTimers]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  return {
    ...state,
    connect,
    disconnect,
    isRetrying: state.isLoading && state.retryCount > 0,
    canRetry: state.retryCount < maxRetries && !state.isConnected,
  };
}

export function WalletConnectCrashBoundary({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [hasCrashed, setHasCrashed] = useState(false);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[WalletConnectCrashGuard]', event.error);
      setHasCrashed(true);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('[WalletConnectCrashGuard]', event.reason);
      setHasCrashed(true);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (hasCrashed) {
    return <>{fallback || <div>WalletConnect session failed. Please reconnect.</div>}</>;
  }

  return <>{children}</>;
}
