import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AlarmStateStore {
    /** IDs of alarms we've already sent notifications for (max 200) */
    lastSeenAlarmIds: string[];
    /** Timestamp of last successful poll */
    lastPollTime: number;
    /** Number of unread alarms (badge count) */
    unreadCount: number;
    /** Master toggle for push notifications */
    notificationsEnabled: boolean;
    /** Notification sound enabled */
    soundEnabled: boolean;

    // Actions
    addSeenAlarmIds: (ids: string[]) => void;
    incrementUnread: (count?: number) => void;
    clearUnread: () => void;
    setLastPollTime: (time: number) => void;
    setNotificationsEnabled: (enabled: boolean) => void;
    setSoundEnabled: (enabled: boolean) => void;
    reset: () => void;
}

const MAX_SEEN_IDS = 200;

export const useAlarmStateStore = create<AlarmStateStore>()(
    persist(
        (set) => ({
            lastSeenAlarmIds: [],
            lastPollTime: 0,
            unreadCount: 0,
            notificationsEnabled: true,
            soundEnabled: true,

            addSeenAlarmIds: (ids) =>
                set((state) => {
                    const combined = [...new Set([...ids, ...state.lastSeenAlarmIds])];
                    return { lastSeenAlarmIds: combined.slice(0, MAX_SEEN_IDS) };
                }),

            incrementUnread: (count = 1) =>
                set((state) => ({ unreadCount: state.unreadCount + count })),

            clearUnread: () => set({ unreadCount: 0 }),

            setLastPollTime: (time) => set({ lastPollTime: time }),

            setNotificationsEnabled: (enabled) =>
                set({ notificationsEnabled: enabled }),

            setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

            reset: () =>
                set({
                    lastSeenAlarmIds: [],
                    lastPollTime: 0,
                    unreadCount: 0,
                }),
        }),
        {
            name: 'alarm-state-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
