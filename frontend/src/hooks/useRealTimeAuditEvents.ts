import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '@/services/api';
import type { AuditLog, AuditSeverity } from '@/types';

export interface AuditSecurityAlert {
  type: string;
  auditEntry: {
    id: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    timestamp: string;
  };
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface UseRealTimeAuditEventsResult {
  realtimeLogs: AuditLog[];
  securityAlerts: AuditSecurityAlert[];
  isConnected: boolean;
  clearRealtimeLogs: () => void;
  appendIncomingEvent: (event: AuditLog) => void;
}

export function useRealTimeAuditEvents(): UseRealTimeAuditEventsResult {
  const [realtimeLogs, setRealtimeLogs] = useState<AuditLog[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<AuditSecurityAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    // Use current origin so Nginx proxies /socket.io correctly in all environments
    const socketUrl = `${window.location.protocol}//${window.location.host}/audit-events`;

    const socket = io(socketUrl, {
      path: '/socket.io',
      auth: { token },
      query: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('subscribe');
    });

    socket.on('connected', () => {
      setIsConnected(true);
    });

    socket.on('subscribed', () => {
      setIsConnected(true);
    });

    socket.on('audit:created', (data: any) => {
      if (!data) return;

      const normalized: AuditLog = {
        id: data.id || `live-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        organizationId: data.organizationId || '',
        userId: data.userId || data.user?.id || '',
        user: data.user || (data.metadata?.triggeredBy ? {
          id: data.userId || '',
          email: data.metadata.triggeredBy,
          name: data.metadata.triggeredBy.split('@')[0],
        } : undefined),
        action: data.action,
        resourceType: data.resourceType || 'System',
        resourceId: data.resourceId || undefined,
        metadata: data.metadata,
        severity: ((data.severity || 'LOW') as string).toUpperCase() as AuditSeverity,
        timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
        ipAddress: data.ipAddress || '127.0.0.1',
        userAgent: data.userAgent,
      };

      setRealtimeLogs((prev) => [normalized, ...prev.slice(0, 99)]);
    });

    socket.on('audit:security_alert', (alert: AuditSecurityAlert) => {
      if (!alert) return;
      setSecurityAlerts((prev) => [alert, ...prev.slice(0, 49)]);

      const alertLog: AuditLog = {
        id: alert.auditEntry?.id || `alert-${Date.now()}`,
        organizationId: '',
        userId: alert.auditEntry?.userId || '',
        action: alert.type || 'SECURITY_ALERT',
        resourceType: alert.auditEntry?.resourceType || 'SecurityAlert',
        resourceId: alert.auditEntry?.resourceId || undefined,
        metadata: alert.details,
        severity: 'CRITICAL',
        timestamp: alert.timestamp ? new Date(alert.timestamp).toISOString() : new Date().toISOString(),
        ipAddress: 'Internal Detection',
      };

      setRealtimeLogs((prev) => [alertLog, ...prev.slice(0, 99)]);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const clearRealtimeLogs = useCallback(() => {
    setRealtimeLogs([]);
  }, []);

  const appendIncomingEvent = useCallback((event: AuditLog) => {
    setRealtimeLogs((prev) => [event, ...prev.slice(0, 99)]);
  }, []);

  return {
    realtimeLogs,
    securityAlerts,
    isConnected,
    clearRealtimeLogs,
    appendIncomingEvent,
  };
}
