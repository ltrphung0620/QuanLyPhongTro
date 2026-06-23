import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { router } from 'expo-router';
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL, requireApiBaseUrl } from './config';
import { emitInvoiceCreated } from './events';
import { addNotificationResponseListener, registerForPushNotifications, showInvoiceToast } from './notifications';
import { changePassword as changePasswordApi, getMe, login as loginApi, setUnauthorizedHandler, unregisterTenantDevice } from './api';
import { clearSavedPushToken, clearToken, getSavedPushToken, getToken, saveToken } from './storage';
import type { RealtimeEvent, UserProfile } from './types';

type AuthContextValue = {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  loginTenant: (email: string, password: string) => Promise<UserProfile>;
  refreshUser: () => Promise<UserProfile | null>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const connectionRef = useRef<HubConnection | null>(null);

  const logout = useCallback(async () => {
    const savedPushToken = await getSavedPushToken();
    if (savedPushToken) {
      try {
        await unregisterTenantDevice(savedPushToken);
      } catch {
        // The local logout must still happen when the network is unavailable.
      }
    }

    await clearSavedPushToken();
    await clearToken();
    setTokenState(null);
    setUser(null);
    router.replace('/login');
  }, []);

  const loadProfile = useCallback(async () => {
    const profile = await getMe();
    if (profile.role !== 'Tenant') {
      await clearToken();
      setTokenState(null);
      setUser(null);
      throw new Error('Ứng dụng này chỉ dành cho khách thuê');
    }

    setUser(profile);
    return profile;
  }, []);

  const refreshUser = useCallback(async () => {
    const savedToken = await getToken();
    if (!savedToken) {
      setTokenState(null);
      setUser(null);
      return null;
    }

    setTokenState(savedToken);
    return loadProfile();
  }, [loadProfile]);

  const loginTenant = useCallback(async (email: string, password: string) => {
    const response = await loginApi(email, password);
    await saveToken(response.token);
    setTokenState(response.token);
    const profile = await loadProfile();

    if (profile.mustChangePassword) {
      router.replace('/change-password');
    } else {
      router.replace('/(tabs)');
    }

    return profile;
  }, [loadProfile]);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    await changePasswordApi(oldPassword, newPassword);
    const profile = await loadProfile();
    if (!profile?.mustChangePassword) {
      router.replace('/(tabs)');
    }
  }, [loadProfile]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    let mounted = true;

    refreshUser()
      .then((profile) => {
        if (!mounted) {
          return;
        }

        if (!profile) {
          router.replace('/login');
        } else if (profile.mustChangePassword) {
          router.replace('/change-password');
        } else {
          router.replace('/(tabs)');
        }
      })
      .catch(async () => {
        await clearToken();
        if (mounted) {
          setTokenState(null);
          setUser(null);
          router.replace('/login');
        }
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [refreshUser]);

  useEffect(() => {
    if (!token || !user || user.mustChangePassword) {
      return;
    }

    registerForPushNotifications().catch(() => undefined);
  }, [token, user]);

  useEffect(() => {
    const subscription = addNotificationResponseListener();
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!token || !user || user.mustChangePassword || !API_BASE_URL) {
      return;
    }

    const connection = new HubConnectionBuilder()
      .withUrl(`${requireApiBaseUrl()}/hubs/realtime`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on('RealtimeEvent', (event: RealtimeEvent) => {
      if (event?.eventName !== 'tenant.invoice.created') {
        return;
      }

      emitInvoiceCreated(event);
      showInvoiceToast(event.data?.message);
    });

    connectionRef.current = connection;
    connection.start().catch(() => undefined);

    return () => {
      connectionRef.current = null;
      connection.stop().catch(() => undefined);
    };
  }, [token, user]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    loading,
    loginTenant,
    refreshUser,
    changePassword,
    logout,
  }), [user, token, loading, loginTenant, refreshUser, changePassword, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
