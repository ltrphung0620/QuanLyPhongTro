using System.Text.RegularExpressions;

namespace NhaTro.Utils
{
    public static class RoomCodeSort
    {
        private static readonly Regex StandardRoomCodePattern = new(
            @"^([AB])\s*0?([1-8])$",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        public static int GetGroup(string? roomCode)
        {
            var match = MatchStandardRoomCode(roomCode);
            if (!match.Success)
            {
                return 99;
            }

            return string.Equals(match.Groups[1].Value, "A", StringComparison.OrdinalIgnoreCase) ? 0 : 1;
        }

        public static int GetNumber(string? roomCode)
        {
            var match = MatchStandardRoomCode(roomCode);
            if (!match.Success)
            {
                return int.MaxValue;
            }

            return int.Parse(match.Groups[2].Value);
        }

        private static Match MatchStandardRoomCode(string? roomCode)
        {
            return StandardRoomCodePattern.Match(roomCode?.Trim() ?? string.Empty);
        }
    }
}
