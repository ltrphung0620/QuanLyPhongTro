import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, EmptyState } from "@/components/Cards";
import { Screen } from "@/components/Screen";
import { API_BASE_URL } from "@/config/env";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/api";
import { colors, radius, spacing } from "@/theme";

function imageUrl(path?: string | null) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL.replace(/\/api$/, "")}/${path.replace(/^\//, "")}`;
}

function messageTime(value: string) {
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
  return new Date(normalized).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function SupportScreen() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === "SuperAdmin";
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const myConversation = useQuery({ queryKey: ["supportConversation"], queryFn: api.supportConversation, enabled: !isSuperAdmin });
  const conversations = useQuery({ queryKey: ["supportConversations"], queryFn: api.supportConversations, enabled: isSuperAdmin });
  const conversationId = isSuperAdmin
    ? selectedConversationId ?? conversations.data?.[0]?.supportConversationId
    : myConversation.data?.supportConversationId;
  const messages = useQuery({
    queryKey: ["supportMessages", conversationId],
    queryFn: () => api.supportMessages(conversationId!),
    enabled: !!conversationId
  });

  const selectedConversation = useMemo(
    () => isSuperAdmin ? conversations.data?.find((item) => item.supportConversationId === conversationId) : myConversation.data,
    [conversationId, conversations.data, isSuperAdmin, myConversation.data]
  );

  const sendMessage = useMutation({
    mutationFn: () => api.sendSupportMessage(
      conversationId!,
      draft.trim(),
      image ? { uri: image.uri, name: image.fileName || "support-image.jpg", type: image.mimeType || "image/jpeg" } : null
    ),
    onSuccess: async () => {
      setDraft("");
      setImage(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["supportMessages", conversationId] }),
        queryClient.invalidateQueries({ queryKey: ["supportConversations"] })
      ]);
    },
    onError: (error) => Alert.alert("Không thể gửi tin nhắn", error instanceof Error ? error.message : "Vui lòng thử lại.")
  });

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Cần quyền thư viện ảnh", "Hãy cho phép ứng dụng truy cập ảnh để đính kèm yêu cầu hỗ trợ.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert("Ảnh quá lớn", "Chỉ hỗ trợ ảnh có dung lượng tối đa 5 MB.");
      return;
    }
    setImage(asset);
  };

  const canSend = !!conversationId && (!!draft.trim() || !!image) && !sendMessage.isPending;

  return (
    <Screen title="Hỗ trợ" subtitle="Trao đổi trực tiếp với bộ phận hỗ trợ" loading={myConversation.isLoading || conversations.isLoading} refreshing={messages.isFetching} onRefresh={messages.refetch}>
      {isSuperAdmin && (conversations.data?.length ?? 0) > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.threadList}>
          {conversations.data?.map((conversation) => (
            <Pressable key={conversation.supportConversationId} style={[styles.thread, conversation.supportConversationId === conversationId && styles.threadActive]} onPress={() => setSelectedConversationId(conversation.supportConversationId)}>
              <Text style={[styles.threadText, conversation.supportConversationId === conversationId && styles.threadTextActive]} numberOfLines={1}>{conversation.adminName}</Text>
              {conversation.unreadCount > 0 && <View style={styles.unread}><Text style={styles.unreadText}>{conversation.unreadCount}</Text></View>}
            </Pressable>
          ))}
        </ScrollView>
      )}

      {!conversationId ? (
        <EmptyState text={isSuperAdmin ? "Chưa có yêu cầu hỗ trợ nào." : "Không thể mở hội thoại hỗ trợ."} />
      ) : (
        <Card>
          <View style={styles.chatHeading}>
            <View style={styles.headingIcon}><Ionicons name="headset-outline" size={20} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headingTitle}>{isSuperAdmin ? selectedConversation?.adminName || "Hội thoại hỗ trợ" : "Bộ phận hỗ trợ"}</Text>
              <Text style={styles.headingSubtitle}>{isSuperAdmin ? selectedConversation?.organizationNames?.join(" • ") || selectedConversation?.adminEmail : "Gửi câu hỏi, mô tả sự cố hoặc ảnh minh họa."}</Text>
            </View>
          </View>

          <View style={styles.messages}>
            {messages.isLoading ? <ActivityIndicator color={colors.primary} /> : messages.data?.items.length ? messages.data.items.map((message) => (
              <View key={message.supportMessageId} style={[styles.messageRow, message.isMine ? styles.messageMineRow : styles.messageOtherRow]}>
                <View style={[styles.message, message.isMine ? styles.messageMine : styles.messageOther]}>
                  {!message.isMine && <Text style={styles.sender}>{message.senderName}</Text>}
                  {!!message.content && <Text style={[styles.messageText, message.isMine && styles.messageMineText]}>{message.content}</Text>}
                  {message.imagePath && <Image source={{ uri: imageUrl(message.imagePath) }} style={styles.messageImage} resizeMode="cover" />}
                  <Text style={[styles.messageTime, message.isMine && styles.messageMineTime]}>{messageTime(message.sentAt)}</Text>
                </View>
              </View>
            )) : <EmptyState text="Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện." />}
          </View>

          {image && (
            <View style={styles.imageDraft}>
              <Image source={{ uri: image.uri }} style={styles.imagePreview} />
              <Text style={styles.imageName} numberOfLines={1}>{image.fileName || "Ảnh đính kèm"}</Text>
              <Pressable onPress={() => setImage(null)}><Ionicons name="close-circle" size={21} color={colors.textMuted} /></Pressable>
            </View>
          )}
          <View style={styles.composer}>
            <Pressable style={styles.attachButton} onPress={pickImage} disabled={sendMessage.isPending}><Ionicons name="image-outline" size={21} color={colors.primary} /></Pressable>
            <TextInput value={draft} onChangeText={(value) => setDraft(value.slice(0, 2000))} placeholder="Nhập nội dung cần hỗ trợ..." placeholderTextColor={colors.textMuted} multiline style={styles.input} editable={!sendMessage.isPending} />
            <Pressable style={[styles.sendButton, !canSend && styles.sendButtonDisabled]} onPress={() => sendMessage.mutate()} disabled={!canSend}>
              {sendMessage.isPending ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="send" size={18} color={colors.white} />}
            </Pressable>
          </View>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  threadList: { gap: spacing.xs, paddingRight: spacing.md },
  thread: { maxWidth: 150, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surface },
  threadActive: { borderColor: colors.primaryDark, backgroundColor: colors.primaryDark },
  threadText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  threadTextActive: { color: colors.white },
  unread: { minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: colors.danger },
  unreadText: { color: colors.white, fontSize: 10, fontWeight: "900" },
  chatHeading: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headingIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  headingTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
  headingSubtitle: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  messages: { gap: spacing.sm, marginTop: spacing.md },
  messageRow: { flexDirection: "row" },
  messageMineRow: { justifyContent: "flex-end" },
  messageOtherRow: { justifyContent: "flex-start" },
  message: { maxWidth: "84%", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
  messageMine: { backgroundColor: colors.primaryDark },
  messageOther: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  sender: { color: colors.primary, fontSize: 10, fontWeight: "900", marginBottom: 2 },
  messageText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  messageMineText: { color: colors.white },
  messageTime: { color: colors.textMuted, fontSize: 9, marginTop: 4, textAlign: "right" },
  messageMineTime: { color: "#e8ded9" },
  messageImage: { width: 210, height: 170, marginTop: 5, borderRadius: 8 },
  imageDraft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, padding: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  imagePreview: { width: 42, height: 42, borderRadius: 6 },
  imageName: { flex: 1, color: colors.text, fontSize: 12, fontWeight: "700" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.xs, marginTop: spacing.md, padding: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  attachButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, minHeight: 38, maxHeight: 105, paddingVertical: 8, color: colors.text, fontSize: 13, textAlignVertical: "top" },
  sendButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: colors.primaryDark },
  sendButtonDisabled: { opacity: 0.45 }
});
