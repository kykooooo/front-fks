import { DeviceEventEmitter } from "react-native";

export type ToastType = "success" | "error" | "info" | "warn";

export type ToastPayload = {
  type?: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
};

const TOAST_EVENT = "fks_toast_event";

export const showToast = (payload: ToastPayload) => {
  DeviceEventEmitter.emit(TOAST_EVENT, payload);
};

export const onToast = (listener: (payload: ToastPayload) => void) => {
  const sub = DeviceEventEmitter.addListener(TOAST_EVENT, listener);
  return () => sub.remove();
};
