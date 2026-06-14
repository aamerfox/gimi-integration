import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DeviceGroup {
    id: string;
    name: string;
}

interface GroupState {
    groups: DeviceGroup[];
    deviceGroupMap: Record<string, string>; // imei -> groupId

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

            addGroup: (name: string) =>
                set((state) => ({
                    groups: [...state.groups, { id: `group-${Date.now()}`, name }],
                })),

            removeGroup: (id: string) =>
                set((state) => {
                    const newMap = { ...state.deviceGroupMap };
                    // Unassign all devices in this group
                    Object.keys(newMap).forEach((imei) => {
                        if (newMap[imei] === id) {
                            delete newMap[imei];
                        }
                    });
                    return {
                        groups: state.groups.filter((g) => g.id !== id),
                        deviceGroupMap: newMap,
                    };
                }),

            assignDeviceToGroup: (imei: string, groupId: string | null) =>
                set((state) => {
                    const newMap = { ...state.deviceGroupMap };
                    if (groupId) {
                        newMap[imei] = groupId;
                    } else {
                        delete newMap[imei]; // Remove from group
                    }
                    return { deviceGroupMap: newMap };
                }),

            renameGroup: (id: string, newName: string) =>
                set((state) => ({
                    groups: state.groups.map((g) =>
                        g.id === id ? { ...g, name: newName } : g
                    ),
                })),
        }),
        {
            name: 'gimi-groups-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
