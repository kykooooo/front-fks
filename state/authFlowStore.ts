import { create } from "zustand";

type AuthFlowStore = {
  completedProfileUid: string | null;
  markProfileCompleted: (uid: string) => void;
  clearProfileCompleted: (uid?: string | null) => void;
};

export const useAuthFlowStore = create<AuthFlowStore>((set, get) => ({
  completedProfileUid: null,
  markProfileCompleted: (uid) => {
    set({ completedProfileUid: uid });
  },
  clearProfileCompleted: (uid) => {
    const current = get().completedProfileUid;
    if (uid == null || current === uid) {
      set({ completedProfileUid: null });
    }
  },
}));
