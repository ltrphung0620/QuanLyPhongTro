import { QueryClient } from "@tanstack/react-query";
import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/services/api";
import { clearSessionStorage, getActiveOrganizationId, getToken, setActiveOrganizationId, setToken } from "@/services/storage";
import { UserOrganization, UserProfile } from "@/types/api";

type AuthState = {
  token: string | null;
  profile: UserProfile | null;
  activeOrganizationId: number | null;
  isBootstrapping: boolean;
  isSigningIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  selectOrganization: (organization: UserOrganization) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children, queryClient }: PropsWithChildren<{ queryClient: QueryClient }>) {
  const [token, setTokenState] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeOrganizationId, setActiveOrgState] = useState<number | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const loadProfile = async () => {
    const me = await api.me();
    const savedOrgId = await getActiveOrganizationId();
    const fallbackOrg = me.activeOrganization?.id || me.organizationId || me.organizations?.[0]?.id || null;
    const nextOrgId = savedOrgId || fallbackOrg;

    if (nextOrgId) {
      await setActiveOrganizationId(nextOrgId);
    }

    setActiveOrgState(nextOrgId);
    setProfile(me);
  };

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const savedToken = await getToken();
        if (!mounted) return;

        if (savedToken) {
          setTokenState(savedToken);
          await loadProfile();
        }
      } catch {
        await clearSessionStorage();
        setTokenState(null);
        setProfile(null);
      } finally {
        if (mounted) setIsBootstrapping(false);
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      token,
      profile,
      activeOrganizationId,
      isBootstrapping,
      isSigningIn,
      signIn: async (email, password) => {
        setIsSigningIn(true);
        try {
          const response = await api.login(email, password);
          await setToken(response.token);
          setTokenState(response.token);
          await loadProfile();
        } catch (error) {
          if (error instanceof ApiError) throw error;
          throw new Error("Không thể đăng nhập. Vui lòng kiểm tra kết nối.");
        } finally {
          setIsSigningIn(false);
        }
      },
      signOut: async () => {
        await clearSessionStorage();
        queryClient.clear();
        setTokenState(null);
        setProfile(null);
        setActiveOrgState(null);
      },
      refreshProfile: loadProfile,
      selectOrganization: async (organization) => {
        await setActiveOrganizationId(organization.id);
        setActiveOrgState(organization.id);
        queryClient.invalidateQueries();
        await loadProfile();
      }
    }),
    [activeOrganizationId, isBootstrapping, isSigningIn, profile, queryClient, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
