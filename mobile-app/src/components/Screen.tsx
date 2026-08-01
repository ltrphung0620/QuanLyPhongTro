import React, { PropsWithChildren, useState } from "react";
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/theme";
import { useAuth } from "@/context/AuthContext";

type ScreenProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  organizationName?: string;
  profileName?: string;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

export function Screen({ title, subtitle, organizationName, profileName, loading, refreshing, onRefresh, children }: ScreenProps) {
  const { profile, activeOrganizationId, selectOrganization, signOut } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const resolvedName = profileName || profile?.displayName || profile?.username || "QL";
  const activeOrganization = profile?.organizations?.find((item) => item.id === activeOrganizationId) || profile?.activeOrganization;
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title || "QLPT"}</Text>
          {organizationName ? (
            <View style={styles.organizationBadge}>
              <Ionicons name="business-outline" size={13} color={colors.primary} />
              <Text style={styles.organizationText} numberOfLines={1}>{organizationName}</Text>
            </View>
          ) : null}
        </View>
        <Pressable style={styles.avatar} onPress={() => setAccountOpen(true)}>
          <Text style={styles.avatarText}>{resolvedName.trim().slice(0, 2).toUpperCase()}</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
      >
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          children
        )}
      </ScrollView>
      <Modal visible={accountOpen} transparent animationType="fade" onRequestClose={() => setAccountOpen(false)}>
        <Pressable style={styles.accountBackdrop} onPress={() => setAccountOpen(false)}>
          <Pressable style={styles.accountMenu} onPress={() => undefined}>
            <View style={styles.accountHeader}>
              <View style={styles.accountAvatar}><Text style={styles.avatarText}>{resolvedName.trim().slice(0, 2).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountName}>{resolvedName}</Text>
                <Text style={styles.accountEmail}>{profile?.email}</Text>
              </View>
              <Pressable style={styles.accountClose} onPress={() => setAccountOpen(false)}><Ionicons name="close" size={21} color={colors.text} /></Pressable>
            </View>
            {profile?.organizations?.length ? (
              <View style={styles.organizationSection}>
                <Text style={styles.accountSectionLabel}>TỔ CHỨC LÀM VIỆC</Text>
                {profile.organizations.map((organization) => {
                  const active = organization.id === activeOrganizationId;
                  return (
                    <Pressable key={organization.id} style={[styles.organizationOption, active && styles.organizationOptionActive]} onPress={async () => { await selectOrganization(organization); setAccountOpen(false); }}>
                      <Ionicons name="business-outline" size={18} color={active ? colors.white : colors.primary} />
                      <View style={{ flex: 1 }}><Text style={[styles.organizationOptionName, active && { color: colors.white }]}>{organization.name}</Text><Text style={[styles.organizationOptionCode, active && { color: "#e8ded9" }]}>Mã: {organization.code}</Text></View>
                      {active ? <Ionicons name="checkmark" size={19} color={colors.white} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : activeOrganization ? <Text style={styles.accountEmail}>{activeOrganization.name}</Text> : null}
            <Pressable style={styles.logoutButton} onPress={async () => { setAccountOpen(false); await signOut(); }}>
              <Ionicons name="log-out-outline" size={19} color={colors.danger} />
              <Text style={styles.logoutText}>Đăng xuất</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  header: {
    minHeight: 64,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  headerTitleGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900"
  },
  organizationBadge: {
    maxWidth: 150,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: colors.surfaceMuted
  },
  organizationText: {
    flexShrink: 1,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6"
  },
  avatarText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 13
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.text
  },
  subtitle: {
    marginTop: -spacing.sm,
    color: colors.textMuted,
    fontSize: 15
  },
  loading: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center"
  },
  accountBackdrop: { flex: 1, paddingTop: 72, paddingHorizontal: spacing.md, alignItems: "flex-end", backgroundColor: "rgba(43,37,35,0.32)" },
  accountMenu: { width: "92%", maxWidth: 380, maxHeight: "82%", padding: spacing.md, gap: spacing.md, borderRadius: 12, backgroundColor: colors.surface },
  accountHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  accountAvatar: { width: 42, height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#3b82f6" },
  accountName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  accountEmail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  accountClose: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  organizationSection: { gap: spacing.xs },
  accountSectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "900", marginBottom: 3 },
  organizationOption: { minHeight: 58, paddingHorizontal: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  organizationOptionActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  organizationOptionName: { color: colors.text, fontWeight: "800" },
  organizationOptionCode: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  logoutButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderWidth: 1, borderColor: "#eed2ce", borderRadius: 8, backgroundColor: "#fff5f4" },
  logoutText: { color: colors.danger, fontWeight: "900" }
});
