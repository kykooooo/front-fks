// config/devFlags.ts
export const DEV_FLAGS = {
  ENABLED: true,                      // mode dev ON (test illimité)
  VIRTUAL_CLOCK: false,               // horloge réelle pour laisser décayer ATL/CTL même en dev
  DISABLE_DELOAD: true,
  PHASE_LOCK_MIN: 5,
};
