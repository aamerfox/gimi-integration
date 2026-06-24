import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export interface AuditLog {
    id: string;
    accountName: string;
    action: string;
    details?: string;
    timestamp: string;
    status: 'Success' | 'Failed';
}

interface SimulationState {
    isSimulatedOperator: boolean;
    simulatedChildAccounts: ChildAccount[];
    simulatedLogs: AuditLog[];
    setIsSimulatedOperator: (val: boolean) => void;
    addChildAccount: (account: ChildAccount) => void;
    deleteChildAccount: (accountId: string) => void;
    updateChildAccount: (account: ChildAccount) => void;
    addLog: (action: string, accountName: string, status: 'Success' | 'Failed', details?: string) => void;
    clearLogs: () => void;
}

export const useSimulationStore = create<SimulationState>()(
    persist(
        (set) => ({
            isSimulatedOperator: false,
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
                },
                {
                    accountId: 'saudiex_operator1',
                    nickName: 'Operator One',
                    email: 'operator1@saudiex.com',
                    telephone: '+966501234567',
                    roleName: 'Sub-Account Operator (Read-Only)',
                    passwordMd5: '36423984ea892556bb20109a909404be', // saudiex123
                },
                {
                    accountId: 'saudiex_operator2',
                    nickName: 'Operator Two',
                    email: 'operator2@saudiex.com',
                    telephone: '+966507654321',
                    roleName: 'Sub-Account Operator (Read-Only)',
                    passwordMd5: '36423984ea892556bb20109a909404be', // saudiex123
                }
            ],
            simulatedLogs: [
                {
                    id: '1',
                    accountName: 'admin_saudiex',
                    action: 'User Login',
                    timestamp: '2026-06-06 12:00:15',
                    status: 'Success',
                },
                {
                    id: '2',
                    accountName: 'admin_saudiex',
                    action: 'Create Sub-Account',
                    details: 'Created saudiex_operator1',
                    timestamp: '2026-06-06 12:05:30',
                    status: 'Success',
                },
                {
                    id: '3',
                    accountName: 'admin_saudiex',
                    action: 'Rename Device',
                    details: 'Updated IMEI 8603... Device Name to "SaudiEx-01"',
                    timestamp: '2026-06-06 12:10:45',
                    status: 'Success',
                }
            ],

            setIsSimulatedOperator: (val) => set({ isSimulatedOperator: val }),

            addChildAccount: (account) => set((state) => ({
                simulatedChildAccounts: [account, ...state.simulatedChildAccounts]
            })),

            deleteChildAccount: (accountId) => set((state) => ({
                simulatedChildAccounts: state.simulatedChildAccounts.filter(acc => acc.accountId !== accountId)
            })),

            updateChildAccount: (account) => set((state) => ({
                simulatedChildAccounts: state.simulatedChildAccounts.map(acc => acc.accountId === account.accountId ? account : acc)
            })),

            addLog: (action, accountName, status, details) => set((state) => {
                const pad = (n: number) => n < 10 ? `0${n}` : n;
                const now = new Date();
                const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
                const newLog: AuditLog = {
                    id: String(Date.now()),
                    accountName,
                    action,
                    details,
                    timestamp,
                    status,
                };
                return {
                    simulatedLogs: [newLog, ...state.simulatedLogs]
                };
            }),

            clearLogs: () => set({ simulatedLogs: [] }),
        }),
        {
            name: 'gimi-simulation-storage',
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
                const mergedLogs = [...(persistedState.simulatedLogs || [])];
                if (currentState.simulatedLogs) {
                    for (const defaultLog of currentState.simulatedLogs) {
                        if (!mergedLogs.some((log: any) => log.id === defaultLog.id)) {
                            mergedLogs.push(defaultLog);
                        }
                    }
                }
                return {
                    ...currentState,
                    ...persistedState,
                    simulatedChildAccounts: mergedChildAccounts,
                    simulatedLogs: mergedLogs,
                };
            }
        }
    )
);
