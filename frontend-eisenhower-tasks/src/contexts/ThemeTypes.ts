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
   colors: {
     // Accent colors
     accent: string;
     accentLight: string;
     accentDark: string;
     // Surface colors
     bg: string;
     bgSecondary: string;
     bgTertiary: string;
     border: string;
     // Text colors
     text: string;
     textSecondary: string;
     textMuted: string;
     // Status colors
     success: string;
     warning: string;
     error: string;
   };
}

export interface ThemeContextType {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
}