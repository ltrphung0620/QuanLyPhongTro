export function getMonthValue(date = new Date()) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

export function getPreviousMonthValue(date = new Date()) {
  return getMonthValue(new Date(date.getFullYear(), date.getMonth() - 1, 1))
}

export function getRelativeMonthValue(offset, date = new Date()) {
  return getMonthValue(new Date(date.getFullYear(), date.getMonth() + offset, 1))
}
