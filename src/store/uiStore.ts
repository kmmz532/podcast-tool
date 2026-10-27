import { create } from 'zustand';

interface UiState {
  settingsOpen: boolean;
  settingsCategory?: string;
  addOpen: boolean;
  fullPlayerOpen: boolean;
  refreshing: boolean;
}

export const useUiStore = create<UiState>(() => ({ settingsOpen: false, addOpen: false, fullPlayerOpen: false, refreshing: false }));

export const openSettings = (category?: string) => useUiStore.setState({ settingsOpen: true, settingsCategory: category });
