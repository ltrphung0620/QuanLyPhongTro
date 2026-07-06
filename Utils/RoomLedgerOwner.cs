namespace NhaTro.Utils
{
    public static class RoomLedgerOwner
    {
        public const string KimLoanKey = "kim-loan";
        public const string PhamSaiKey = "pham-sai";
        public const string KimLoanName = "Trinh Thi Kim Loan";
        public const string PhamSaiName = "Phạm Thị Sại";

        private static readonly HashSet<string> KimLoanRoomCodes = new(StringComparer.OrdinalIgnoreCase)
        {
            "A1",
            "A2",
            "A3",
            "Kios 110/2A",
            "B4",
            "B5",
            "B6",
            "B7",
            "B8"
        };

        public static string ResolveOwnerKey(string? roomCode)
        {
            var normalizedRoomCode = roomCode?.Trim();
            return !string.IsNullOrWhiteSpace(normalizedRoomCode) && KimLoanRoomCodes.Contains(normalizedRoomCode)
                ? KimLoanKey
                : PhamSaiKey;
        }

        public static string ResolveOwnerName(string? roomCode)
        {
            return ResolveOwnerKey(roomCode) == KimLoanKey ? KimLoanName : PhamSaiName;
        }

        public static bool MatchesOwner(string? roomCode, string? ownerKey)
        {
            var normalizedOwnerKey = NormalizeOwnerKey(ownerKey);
            return string.IsNullOrWhiteSpace(normalizedOwnerKey)
                || ResolveOwnerKey(roomCode) == normalizedOwnerKey;
        }

        public static string? NormalizeOwnerKey(string? ownerKey)
        {
            if (string.IsNullOrWhiteSpace(ownerKey))
            {
                return null;
            }

            var normalized = ownerKey.Trim().ToLowerInvariant();
            return normalized switch
            {
                KimLoanKey or "trinh-thi-kim-loan" or "kimloan" or "loan" => KimLoanKey,
                PhamSaiKey or "pham-thi-sai" or "phamsai" or "sai" => PhamSaiKey,
                _ => normalized
            };
        }

        public static string? ResolveOwnerNameByKey(string? ownerKey)
        {
            return NormalizeOwnerKey(ownerKey) switch
            {
                KimLoanKey => KimLoanName,
                PhamSaiKey => PhamSaiName,
                _ => null
            };
        }
    }
}
