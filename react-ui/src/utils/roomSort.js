const STANDARD_ROOM_CODE_PATTERN = /^([AB])\s*0?([1-8])$/i

export function getRoomSortRank(roomCode) {
  const label = String(roomCode || '').trim()
  const match = label.match(STANDARD_ROOM_CODE_PATTERN)

  if (!match) {
    return {
      group: 99,
      number: Number.MAX_SAFE_INTEGER,
      label: label.toLocaleUpperCase('vi-VN')
    }
  }

  return {
    group: match[1].toUpperCase() === 'A' ? 0 : 1,
    number: Number(match[2]),
    label: label.toLocaleUpperCase('vi-VN')
  }
}

export function compareRoomCodes(left, right) {
  const a = getRoomSortRank(left)
  const b = getRoomSortRank(right)

  if (a.group !== b.group) return a.group - b.group
  if (a.number !== b.number) return a.number - b.number

  return a.label.localeCompare(b.label, 'vi-VN', {
    numeric: true,
    sensitivity: 'base'
  })
}

export function sortByRoomCode(items, selector = item => item?.roomCode) {
  return [...(items || [])].sort((a, b) => compareRoomCodes(selector(a), selector(b)))
}
