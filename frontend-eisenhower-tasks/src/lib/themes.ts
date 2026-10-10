export type ThemeName =
  | 'default'
  | 'nord'
  | 'catppuccin'
  | 'tokyonight'
  | 'gruvbox'
  | 'dracula'
  | 'everforest';

export interface Theme {
  name: ThemeName;
  label: string;
  colors: Record<string, string>;
}

export const THEMES: Record<ThemeName, Theme> = {
  default: {
    name: 'default',
    label: 'Default Purple',
    colors: {
      accent: '#a855f7',
      accentLight: '#c084fc',
      accentDark: '#7e22ce',
      bg: '#111827',
      bgSecondary: '#1f2937',
      bgTertiary: '#374151',
      border: '#4b5563',
      text: '#fafafa',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  },
  nord: {
    name: 'nord',
    label: 'Nord',
    colors: {
      accent: '#88c0d0',
      accentLight: '#93d5e3',
      accentDark: '#81a1c1',
      bg: '#2e3440',
      bgSecondary: '#3b4252',
      bgTertiary: '#434c5e',
      border: '#4c566a',
      text: '#d8dee9',
      textSecondary: '#e5e9f0',
      textMuted: '#d8dee9',
      success: '#a3be8c',
      warning: '#ebcb8b',
      error: '#bf616a',
    },
  },
  catppuccin: {
    name: 'catppuccin',
    label: 'Catppuccin',
    colors: {
      accent: '#cba6f7',
      accentLight: '#f2cdcd',
      accentDark: '#c6a0f6',
      bg: '#1e1e2e',
      bgSecondary: '#181825',
      bgTertiary: '#313244',
      border: '#45475a',
      text: '#cdd6f4',
      textSecondary: '#b4befe',
      textMuted: '#a6adc8',
      success: '#a6e3a1',
      warning: '#f9e2af',
      error: '#f38ba8',
    },
  },
  tokyonight: {
    name: 'tokyonight',
    label: 'Tokyo Night',
    colors: {
      accent: '#7aa2f7',
      accentLight: '#89b4fa',
      accentDark: '#449dab',
      bg: '#1a1b26',
      bgSecondary: '#24283b',
      bgTertiary: '#414868',
      border: '#565f89',
      text: '#c0caf5',
      textSecondary: '#a9b1d6',
      textMuted: '#9aa5ce',
      success: '#9ece6a',
      warning: '#e0af68',
      error: '#f7768e',
    },
  },
  gruvbox: {
    name: 'gruvbox',
    label: 'Gruvbox',
    colors: {
      accent: '#83a598',
      accentLight: '#8ec07c',
      accentDark: '#689d6a',
      bg: '#282828',
      bgSecondary: '#32302f',
      bgTertiary: '#504945',
      border: '#665c54',
      text: '#ebdbb2',
      textSecondary: '#d5c4a1',
      textMuted: '#bdae93',
      success: '#b8bb26',
      warning: '#d79921',
      error: '#fb4934',
    },
  },
  dracula: {
    name: 'dracula',
    label: 'Dracula',
    colors: {
      accent: '#bd93f9',
      accentLight: '#ffb86c',
      accentDark: '#8be9fd',
      bg: '#1e1f29',
      bgSecondary: '#282a37',
      bgTertiary: '#44475a',
      border: '#6272a4',
      text: '#f8f8f2',
      textSecondary: '#e9e9f4',
      textMuted: '#bfbfbf',
      success: '#50fa7b',
      warning: '#f1fa8c',
      error: '#ff5555',
    },
  },
  everforest: {
    name: 'everforest',
    label: 'Everforest',
    colors: {
      accent: '#7fbbb6',
      accentLight: '#83c092',
      accentDark: '#d3c6aa',
      bg: '#2d353b',
      bgSecondary: '#343f44',
      bgTertiary: '#4a5558',
      border: '#5a6a6e',
      text: '#d3c6aa',
      textSecondary: '#e0ccc7',
      textMuted: '#a6b0a0',
      success: '#a3be8c',
      warning: '#e69875',
      error: '#e67e80',
    },
  },
};