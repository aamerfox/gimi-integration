import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChildAccount {
    accountId: string;
    nickName: string;
    email: string;
    telephone?: string;
    roleName: string;
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
    addLog: (action: string, accountName: string, status: 'Success' | 'Failed', details?: string) => void;
    clearLogs: () => void;
}

export const useSimulationStore = create<SimulationState>()(
    persist(
        (set) => ({
            isSimulatedOperator: false,
            simulatedChildAccounts: [
                {
                    accountId: 'saudiex_operator1',
                    nickName: 'Operator One',
                    email: 'operator1@saudiex.com',
                    telephone: '+966501234567',
                    roleName: 'Sub-Account Operator (Read-Only)',
                },
                {
                    accountId: 'saudiex_operator2',
                    nickName: 'Operator Two',
                    email: 'operator2@saudiex.com',
                    telephone: '+966507654321',
                    roleName: 'Sub-Account Operator (Read-Only)',
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
        }
    )
);
