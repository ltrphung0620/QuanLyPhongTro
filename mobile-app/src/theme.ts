export const colors = {
  background: "#f5efe9",
  surface: "#fffdfb",
  surfaceMuted: "#f0e7df",
  primary: "#9c7b70",
  primaryDark: "#3a2824",
  accent: "#2f755f",
  danger: "#b2574f",
  warning: "#c48348",
  text: "#2b2523",
  textMuted: "#8c7c75",
  border: "#e5d8cf",
  white: "#ffffff"
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18
};

export const shadow = {
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3
};

export function formatMoney(value?: number | null) {
  return `${Math.round(value ?? 0).toLocaleString("vi-VN")} đ`;
}

export function formatMonth(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function displayMonth(monthValue: string) {
  const [year, month] = monthValue.split("-");
  return `${month}/${year}`;
}
