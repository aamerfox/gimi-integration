import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from './auth';

export interface ChildAccount {
    accountId: string;
    nickName: string;
    email: string;
    telephone?: string;
    roleName: string;
    passwordMd5?: string; // MD5 of password — enables local login bypass
    deviceImei?: string;  // Mapped OCI device IMEI(s), comma-separated
    activationTime?: string; // Mapped OCI device activation date(s), comma-separated
}

// Built-in OCI accounts that are ALWAYS available — no backend required.
// Add any additional hardcoded accounts here.
const BUILTIN_ACCOUNTS: ChildAccount[] = [
    {
        accountId: 'hertz',
        nickName: 'Hertz OCI Sub-Account',
        email: 'hertz@saudiex.com',
        telephone: '0500000000',
        roleName: 'End User (Read-Only)',
        passwordMd5: '80fc588ba13f3af3d64be60ddfd386d8', // md5('hertz08642')
        deviceImei: '781950640051748',
        activationTime: '2026-06-18 12:00:00',
    }
];

interface SimulationState {
    simulatedChildAccounts: ChildAccount[];
    setSimulatedChildAccounts: (accounts: ChildAccount[]) => void;
}

export const useSimulationStore = create<SimulationState>()(
    persist(
        (set) => ({
            simulatedChildAccounts: [...BUILTIN_ACCOUNTS],
            setSimulatedChildAccounts: (accounts) => set({ simulatedChildAccounts: accounts }),
        }),
        {
            name: 'gimi-simulation-storage',
            storage: createJSONStorage(() => secureStorage),
            merge: (persistedState: any, currentState: SimulationState) => {
                if (!persistedState) return currentState;

                const mergedMap = new Map<string, ChildAccount>();

                // 1. Start with built-in accounts (guaranteed always present)
                for (const acc of BUILTIN_ACCOUNTS) {
                    mergedMap.set(acc.accountId.toLowerCase(), acc);
                }

                // 2. Layer persisted accounts on top (backend-synced accounts)
                for (const acc of (persistedState.simulatedChildAccounts || [])) {
                    // Don't let a corrupted persist overwrite built-ins with incomplete data
                    if (acc.accountId && acc.nickName) {
                        mergedMap.set(acc.accountId.toLowerCase(), acc);
                    }
                }

                return {
                    ...currentState,
                    ...persistedState,
                    simulatedChildAccounts: Array.from(mergedMap.values()),
                };
            }
        }
    )
);
