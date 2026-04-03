import { create } from "zustand";

interface PermissionErrorState {
  message: string | null;
  setError: (message: string) => void;
  clear: () => void;
}

export const usePermissionErrorStore = create<PermissionErrorState>((set) => ({
  message: null,
  setError: (message) => set({ message }),
  clear: () => set({ message: null })
}));
