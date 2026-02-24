import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AlertRuleType = 'geofence' | 'overspeed' | 'offline' | 'lowBattery';

export interface AlertRule {
    id: string;
    name: string;
    type: AlertRuleType;
    enabled: boolean;
    imei: string;          // '' = all devices
    deviceName?: string;
    // Type-specific settings
    speedLimit?: number;   // km/h, for overspeed
    fenceId?: string;      // for geofence rules
    fenceName?: string;
    createdAt: string;
}

interface AlertRuleState {
    rules: AlertRule[];
    addRule: (r: Omit<AlertRule, 'id' | 'createdAt'>) => void;
    removeRule: (id: string) => void;
    toggleRule: (id: string) => void;
}

export const useAlertRuleStore = create<AlertRuleState>()(
    persist(
        (set) => ({
            rules: [],
            addRule: (r) =>
                set((s) => ({
                    rules: [
                        ...s.rules,
                        {
                            ...r,
                            id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                            createdAt: new Date().toISOString(),
                        },
                    ],
                })),
            removeRule: (id) =>
                set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),
            toggleRule: (id) =>
                set((s) => ({
                    rules: s.rules.map((r) =>
                        r.id === id ? { ...r, enabled: !r.enabled } : r
                    ),
                })),
        }),
        { name: 'saudiex-alert-rules' }
    )
);
