import { useEffect, useRef } from 'react';
import { useDeviceStore } from '../store/devices';
import type { Device } from '../store/devices';
import { useGeofenceStore } from '../store/geofences';
import type { LocalGeofence } from '../store/geofences';
import { useGeofenceEventStore } from '../store/geofenceEvents';

/**
 * Haversine formula — returns distance in metres between two lat/lng points.
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6_371_000; // Earth radius in metres
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Ask for browser Notification permission once, silently.
 */
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function sendNotification(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
    }
}

/**
 * useGeofenceDetection
 *
 * Mount this hook ONCE in a global layout component.
 * It subscribes to devices (updated every 15 s) and compares each device's
 * position against every local geofence using the Haversine formula.
 * When a device crosses a boundary, a GeofenceEvent is recorded and a
 * browser notification is fired.
 */
export function useGeofenceDetection() {
    const { devices } = useDeviceStore();
    const { geofences } = useGeofenceStore();
    const { addEvent } = useGeofenceEventStore();

    // Map<imei, Set<fenceId>> — tracks which fences each device is currently inside
    const insideRef = useRef<Map<string, Set<string>>>(new Map());

    // Request browser notification permission on first mount
    useEffect(() => {
        requestNotificationPermission();
    }, []);

    // Run detection whenever the devices list is updated
    useEffect(() => {
        if (!geofences.length || !devices.length) return;

        devices.forEach((device: Device) => {
            if (!device.lat || !device.lng || !device.imei) return;

            // Ensure this device has a tracking set
            if (!insideRef.current.has(device.imei)) {
                insideRef.current.set(device.imei, new Set());
            }
            const currentlyInside = insideRef.current.get(device.imei)!;

            geofences.forEach((fence: LocalGeofence) => {
                if (!fence.lat || !fence.lng) return;
                // Skip disabled fences
                if (!fence.enabled) return;
                // Skip if fence targets a specific device that is not this device
                if (fence.imei && fence.imei !== device.imei) return;

                const distance = haversineDistance(device.lat!, device.lng!, fence.lat, fence.lng);
                const isInside = distance <= fence.radius;
                const wasInside = currentlyInside.has(fence.id);

                if (isInside && !wasInside) {
                    // Device just ENTERED the fence
                    currentlyInside.add(fence.id);

                    // Only fire if alarm type allows "enter"
                    if (fence.alarmType === 'in' || fence.alarmType === 'in,out') {
                        const eventData = {
                            fenceId: fence.id,
                            fenceName: fence.fenceName,
                            deviceName: fence.deviceName || device.deviceName || device.imei,
                            imei: device.imei,
                            eventType: 'entered' as const,
                            lat: device.lat!,
                            lng: device.lng!,
                            timestamp: new Date().toISOString(),
                        };
                        addEvent(eventData);
                        sendNotification(
                            `📍 Geofence Entered: ${fence.fenceName}`,
                            `${eventData.deviceName} entered the geofence zone.`
                        );
                    }
                } else if (!isInside && wasInside) {
                    // Device just EXITED the fence
                    currentlyInside.delete(fence.id);

                    // Only fire if alarm type allows "exit"
                    if (fence.alarmType === 'out' || fence.alarmType === 'in,out') {
                        const eventData = {
                            fenceId: fence.id,
                            fenceName: fence.fenceName,
                            deviceName: fence.deviceName || device.deviceName || device.imei,
                            imei: device.imei,
                            eventType: 'exited' as const,
                            lat: device.lat!,
                            lng: device.lng!,
                            timestamp: new Date().toISOString(),
                        };
                        addEvent(eventData);
                        sendNotification(
                            `🚧 Geofence Exited: ${fence.fenceName}`,
                            `${eventData.deviceName} left the geofence zone.`
                        );
                    }
                }
            });
        });
    }, [devices, geofences, addEvent]);
}
