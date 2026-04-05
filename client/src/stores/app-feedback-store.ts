import { create } from "zustand";

interface AppFeedbackDialog {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm?: (() => void) | null;
}

interface AppFeedbackState {
  dialog: AppFeedbackDialog | null;
  openDialog: (dialog: AppFeedbackDialog) => void;
  clearDialog: () => void;
}

export const useAppFeedbackStore = create<AppFeedbackState>((set) => ({
  dialog: null,
  openDialog: (dialog) => set({ dialog }),
  clearDialog: () => set({ dialog: null })
}));
