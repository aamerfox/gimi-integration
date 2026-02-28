import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Group {
    id: string;
    name: string;
}

interface GroupState {
    groups: Group[];
    deviceGroupMap: Record<string, string>; // Maps IMEI to group ID

    // Actions
    addGroup: (name: string) => void;
    removeGroup: (id: string) => void;
    assignDeviceToGroup: (imei: string, groupId: string | null) => void;
    renameGroup: (id: string, newName: string) => void;
}

export const useGroupStore = create<GroupState>()(
    persist(
        (set) => ({
            groups: [],
            deviceGroupMap: {},

            addGroup: (name: string) => set((state) => {
                const newGroup: Group = {
                    id: Math.random().toString(36).substring(2, 9),
                    name
                };
                return { groups: [...state.groups, newGroup] };
            }),

            removeGroup: (id: string) => set((state) => {
                const newMap = { ...state.deviceGroupMap };
                // Remove all device assignments for this group
                Object.keys(newMap).forEach(imei => {
                    if (newMap[imei] === id) {
                        delete newMap[imei];
                    }
                });
                return {
                    groups: state.groups.filter(g => g.id !== id),
                    deviceGroupMap: newMap
                };
            }),

            assignDeviceToGroup: (imei: string, groupId: string | null) => set((state) => {
                const newMap = { ...state.deviceGroupMap };
                if (groupId === null) {
                    delete newMap[imei];
                } else {
                    newMap[imei] = groupId;
                }
                return { deviceGroupMap: newMap };
            }),

            renameGroup: (id: string, newName: string) => set((state) => ({
                groups: state.groups.map(g => g.id === id ? { ...g, name: newName } : g)
            }))
        }),
        {
            name: 'gimi-groups-storage', // key in localStorage
        }
    )
);
