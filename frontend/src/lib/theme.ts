export const theme = {
  colors: {
    bg: "#050505",
    surface: "#121212",
    surfaceElevated: "#1E1E1E",
    textPrimary: "#FFFFFF",
    textSecondary: "#A1A1AA",
    textMuted: "#52525B",
    border: "#27272A",
    borderStrong: "#3F3F46",
    accent: "#FFFFFF",
    danger: "#EF4444",
    success: "#10B981",
    categories: {
      Health: "#10B981",
      Learning: "#3B82F6",
      Career: "#F59E0B",
      "Personal Growth": "#8B5CF6",
      Money: "#EAB308",
    } as Record<string, string>,
    heatmap: ["#161616", "#0A2E25", "#0F5B45", "#10B981", "#34D399"],
  },
  radius: { sm: 8, md: 16, lg: 24, full: 9999 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
};

export const categoryColor = (cat: string): string =>
  theme.colors.categories[cat] ?? theme.colors.textSecondary;
