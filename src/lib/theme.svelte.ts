export class ThemeManager {
  current = $state<'light' | 'dark'>('light');

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('laya_theme') as 'light' | 'dark' | null;
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.current = stored || (prefersDark ? 'dark' : 'light');
      this.apply();
    }
  }

  toggle() {
    this.current = this.current === 'dark' ? 'light' : 'dark';
    if (typeof window !== 'undefined') {
      localStorage.setItem('laya_theme', this.current);
      this.apply();
    }
  }

  setTheme(theme: 'light' | 'dark') {
    this.current = theme;
    if (typeof window !== 'undefined') {
      localStorage.setItem('laya_theme', this.current);
      this.apply();
    }
  }

  private apply() {
    if (typeof document !== 'undefined') {
      if (this.current === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }
}

export const themeManager = new ThemeManager();
