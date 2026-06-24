import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from './auth';

export interface ChildAccount {
    accountId: string;
    nickName: string;
    email: string;
    telephone?: string;
    roleName: string;
    passwordMd5?: string; // Persisted MD5 of password to allow login bypass
    deviceImei?: string;  // Mapped OCI device IMEI
    activationTime?: string; // Mapped OCI device activation date(s)
}

interface SimulationState {
    simulatedChildAccounts: ChildAccount[];
    setSimulatedChildAccounts: (accounts: ChildAccount[]) => void;
}

export const useSimulationStore = create<SimulationState>()(
    persist(
        (set) => ({
            simulatedChildAccounts: [
                {
                    accountId: 'hertz',
                    nickName: 'Hertz OCI Sub-Account',
                    email: 'hertz@saudiex.com',
                    telephone: '0500000000',
                    roleName: 'End User (Read-Only)',
                    passwordMd5: '80fc588ba13f3af3d64be60ddfd386d8', // hertz08642
                    deviceImei: '781950640051748',
                    activationTime: '2026-06-18 12:00:00',
                }
            ],
            setSimulatedChildAccounts: (accounts) => set({ simulatedChildAccounts: accounts }),
        }),
        {
            name: 'gimi-simulation-storage',
            storage: createJSONStorage(() => secureStorage),
            merge: (persistedState: any, currentState: SimulationState) => {
                if (!persistedState) return currentState;
                const mergedChildAccounts = [...(persistedState.simulatedChildAccounts || [])];
                if (currentState.simulatedChildAccounts) {
                    for (const defaultAcc of currentState.simulatedChildAccounts) {
                        if (!mergedChildAccounts.some((acc: any) => acc.accountId === defaultAcc.accountId)) {
                            mergedChildAccounts.push(defaultAcc);
                        }
                    }
                }
                return {
                    ...currentState,
                    ...persistedState,
                    simulatedChildAccounts: mergedChildAccounts,
                };
            }
        }
    )
);
