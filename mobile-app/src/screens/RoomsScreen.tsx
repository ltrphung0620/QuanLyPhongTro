import React, { useMemo, useState } from "react";
import { Alert, Modal, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, EmptyState, ListRow } from "@/components/Cards";
import { AppInput, PillButton, PrimaryButton } from "@/components/FormControls";
import { Screen } from "@/components/Screen";
import { api } from "@/services/api";
import { colors, formatMoney, spacing } from "@/theme";
import { Room } from "@/types/api";

function roomSortKey(roomCode: string) {
  const match = roomCode.match(/^([AB])(\d+)$/i);
  if (!match) return `Z-${roomCode}`;
  return `${match[1].toUpperCase()}-${String(Number(match[2])).padStart(2, "0")}`;
}

export function RoomsScreen() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [editing, setEditing] = useState<Room | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [listedPrice, setListedPrice] = useState("");
  const [roomStatus, setRoomStatus] = useState("vacant");
  const rooms = useQuery({ queryKey: ["rooms", status], queryFn: () => api.rooms(status) });
  const updateRoom = useMutation({
    mutationFn: (room: Room) =>
      api.updateRoom(room.roomId, {
        roomCode,
        listedPrice: Number(listedPrice || 0),
        status: roomStatus
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setEditing(null);
    },
    onError: (error) => Alert.alert("Không lưu được phòng", error instanceof Error ? error.message : "Vui lòng thử lại.")
  });
  const data = useMemo(() => [...(rooms.data ?? [])].sort((a, b) => roomSortKey(a.roomCode).localeCompare(roomSortKey(b.roomCode))), [rooms.data]);

  const openEdit = (room: Room) => {
    setEditing(room);
    setRoomCode(room.roomCode);
    setListedPrice(String(Math.round(room.listedPrice)));
    setRoomStatus(room.status);
  };

  return (
    <Screen title="Phòng trọ" subtitle="Danh sách phòng theo thứ tự A/B" loading={rooms.isLoading} refreshing={rooms.isFetching} onRefresh={rooms.refetch}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <PillButton title="Tất cả" active={!status} onPress={() => setStatus(null)} />
        <PillButton title="Đang thuê" active={status === "occupied"} onPress={() => setStatus("occupied")} />
        <PillButton title="Trống" active={status === "vacant"} onPress={() => setStatus("vacant")} />
      </View>
      <Card>
        {data.length === 0 ? (
          <EmptyState text="Chưa có phòng." />
        ) : (
          data.map((room) => (
            <ListRow
              key={room.roomId}
              title={room.roomCode}
              subtitle={room.status === "occupied" ? "Đang thuê" : "Trống"}
              right={formatMoney(room.listedPrice)}
              onPress={() => openEdit(room)}
            />
          ))
        )}
      </Card>
      <Modal visible={!!editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(null)}>
        <Screen title="Sửa phòng" subtitle={editing?.roomCode}>
          <AppInput label="Mã phòng" value={roomCode} onChangeText={setRoomCode} autoCapitalize="characters" />
          <AppInput label="Giá niêm yết" value={listedPrice} onChangeText={setListedPrice} keyboardType="numeric" />
          <Text style={{ color: colors.text, fontWeight: "900" }}>Trạng thái</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <PillButton title="Đang thuê" active={roomStatus === "occupied"} onPress={() => setRoomStatus("occupied")} />
            <PillButton title="Trống" active={roomStatus === "vacant"} onPress={() => setRoomStatus("vacant")} />
          </View>
          <PrimaryButton title={updateRoom.isPending ? "Đang lưu..." : "Lưu thay đổi"} disabled={updateRoom.isPending || !editing} onPress={() => editing && updateRoom.mutate(editing)} />
          <PrimaryButton title="Đóng" variant="secondary" onPress={() => setEditing(null)} />
        </Screen>
      </Modal>
    </Screen>
  );
}
