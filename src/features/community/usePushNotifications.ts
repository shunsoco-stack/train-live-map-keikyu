"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deletePushSubscription,
  fetchPushConfig,
  savePushSubscription,
} from "@/lib/apiClient";
import {
  isIOSDevice,
  isStandaloneMode,
  safeReadStorage,
  safeWriteStorage,
} from "@/lib/browserGuidance";
import { COMMUNITY_PUSH_LINES_STORAGE_KEY } from "@/lib/communityNamespace";
import type { WebPushSubscriptionData } from "@/types/push";

export type PushNotificationStatus =
  | "checking"
  | "available"
  | "unsupported"
  | "ios-install-required"
  | "denied"
  | "disabled"
  | "error";

interface PushNotificationState {
  status: PushNotificationStatus;
  publicKey: string | null;
  registration: ServiceWorkerRegistration | null;
  subscribedLineIds: string[];
  busy: boolean;
  error: string | null;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

function readStoredLineIds(): string[] {
  const stored = safeReadStorage(
    typeof window === "undefined" ? null : window.localStorage,
    COMMUNITY_PUSH_LINES_STORAGE_KEY,
  );
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter(
              (lineId): lineId is string =>
                typeof lineId === "string",
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

function storeLineIds(lineIds: readonly string[]): void {
  safeWriteStorage(
    window.localStorage,
    COMMUNITY_PUSH_LINES_STORAGE_KEY,
    JSON.stringify(lineIds),
  );
}

function applicationServerKey(publicKey: string): ArrayBuffer {
  const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
  const base64 = (publicKey + padding)
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const raw = window.atob(base64);
  const bytes = Uint8Array.from(raw, (character) =>
    character.charCodeAt(0),
  );
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function subscriptionData(
  subscription: PushSubscription,
): WebPushSubscriptionData {
  const value = subscription.toJSON();
  if (!value.endpoint || !value.keys?.p256dh || !value.keys.auth) {
    throw new Error("端末のPush購読情報を取得できませんでした。");
  }
  return {
    endpoint: value.endpoint,
    expirationTime: value.expirationTime ?? null,
    keys: {
      p256dh: value.keys.p256dh,
      auth: value.keys.auth,
    },
  };
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    status: "checking",
    publicKey: null,
    registration: null,
    subscribedLineIds: [],
    busy: false,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function initialize() {
      try {
        /*
         * PWAのService WorkerはPush設定とは独立して登録する。
         * VAPID未設定でもインストール可能性を失わせない。
         */
        if (!("serviceWorker" in navigator)) {
          setState((previous) => ({
            ...previous,
            status: "unsupported",
          }));
          return;
        }
        const registration = await navigator.serviceWorker.register(
          "/sw.js",
          { scope: "/" },
        );
        if (controller.signal.aborted) return;

        const config = await fetchPushConfig(controller.signal);
        if (controller.signal.aborted) return;
        const subscribedLineIds = readStoredLineIds();

        if (!config.enabled || !config.publicKey) {
          setState((previous) => ({
            ...previous,
            status: "disabled",
            registration,
            subscribedLineIds,
            error: null,
          }));
          return;
        }

        const navigatorWithStandalone =
          navigator as NavigatorWithStandalone;
        const standalone = isStandaloneMode({
          navigatorStandalone: navigatorWithStandalone.standalone,
          displayModeStandalone: window.matchMedia(
            "(display-mode: standalone)",
          ).matches,
        });
        if (
          isIOSDevice(navigator.userAgent, navigator.maxTouchPoints) &&
          !standalone
        ) {
          setState((previous) => ({
            ...previous,
            status: "ios-install-required",
            publicKey: config.publicKey,
            registration,
            subscribedLineIds,
          }));
          return;
        }

        if (
          !("PushManager" in window) ||
          !("Notification" in window)
        ) {
          setState((previous) => ({
            ...previous,
            status: "unsupported",
            publicKey: config.publicKey,
            registration,
            subscribedLineIds,
          }));
          return;
        }
        if (Notification.permission === "denied") {
          setState((previous) => ({
            ...previous,
            status: "denied",
            publicKey: config.publicKey,
            registration,
            subscribedLineIds,
          }));
          return;
        }

        const ready = await navigator.serviceWorker.ready;
        const subscription = await ready.pushManager.getSubscription();

        if (subscription && subscribedLineIds.length > 0) {
          await savePushSubscription({
            subscription: subscriptionData(subscription),
            lineIds: subscribedLineIds,
          });
        } else if (subscription) {
          await deletePushSubscription({
            endpoint: subscription.endpoint,
          });
          await subscription.unsubscribe();
        }

        if (!controller.signal.aborted) {
          setState({
            status: "available",
            publicKey: config.publicKey,
            registration: ready,
            subscribedLineIds,
            busy: false,
            error: null,
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((previous) => ({
          ...previous,
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Push通知を準備できませんでした。",
        }));
      }
    }

    void initialize();
    return () => controller.abort();
  }, []);

  const toggleLine = useCallback(
    async (lineId: string) => {
      const { publicKey, registration, subscribedLineIds } = state;
      if (
        !publicKey ||
        !registration ||
        state.status !== "available" ||
        state.busy
      ) {
        return false;
      }

      setState((previous) => ({
        ...previous,
        busy: true,
        error: null,
      }));

      try {
        const currentlySubscribed =
          subscribedLineIds.includes(lineId);
        const nextLineIds = currentlySubscribed
          ? subscribedLineIds.filter((id) => id !== lineId)
          : [...new Set([...subscribedLineIds, lineId])];

        // iOSでは通知許可を直接のユーザー操作内で求める必要がある。
        if (
          !currentlySubscribed &&
          Notification.permission !== "granted"
        ) {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            setState((previous) => ({
              ...previous,
              status: "denied",
              busy: false,
              error:
                "Push通知が許可されていません。ブラウザーの設定を確認してください。",
            }));
            return false;
          }
        }

        let subscription =
          await registration.pushManager.getSubscription();
        if (nextLineIds.length === 0) {
          if (subscription) {
            await deletePushSubscription({
              endpoint: subscription.endpoint,
            });
            await subscription.unsubscribe();
          }
        } else {
          if (!subscription) {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: applicationServerKey(publicKey),
            });
          }
          await savePushSubscription({
            subscription: subscriptionData(subscription),
            lineIds: nextLineIds,
          });
        }

        storeLineIds(nextLineIds);
        setState((previous) => ({
          ...previous,
          subscribedLineIds: nextLineIds,
          busy: false,
          error: null,
        }));
        return true;
      } catch (error) {
        setState((previous) => ({
          ...previous,
          busy: false,
          error:
            error instanceof Error
              ? error.message
              : "Push通知の設定を更新できませんでした。",
        }));
        return false;
      }
    },
    [state],
  );

  return {
    status: state.status,
    busy: state.busy,
    error: state.error,
    subscribedLineIds: state.subscribedLineIds,
    isSubscribed: (lineId: string) =>
      state.subscribedLineIds.includes(lineId),
    toggleLine,
  };
}
