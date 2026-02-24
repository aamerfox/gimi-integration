import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useDeviceStore } from '../store/devices';
import type { Device } from '../store/devices';

// OpenStreetMap dark tile layer
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function createMarkerIcon(isOnline: boolean, isSelected: boolean) {
    const size = isSelected ? 40 : 32;
    const color = isOnline ? '#00d4aa' : '#6b7280';
    const glowColor = isOnline ? 'rgba(0,212,170,0.3)' : 'rgba(107,114,128,0.2)';
    const pulse = isOnline ? `animation: pulse-glow 2s ease-in-out infinite;` : '';

    return L.divIcon({
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
        html: `
            <div style="
                width: ${size}px;
                height: ${size}px;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <div style="
                    width: ${size - 4}px;
                    height: ${size - 4}px;
                    border-radius: 50%;
                    background: ${glowColor};
                    border: 2px solid ${color};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    ${pulse}
                    ${isSelected ? `box-shadow: 0 0 20px ${glowColor};` : ''}
                ">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="${color}" stroke="none">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                </div>
            </div>
        `,
    });
}

export default function LiveMap() {
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<Map<string, L.Marker>>(new Map());

    const { devices, selectedDevice, selectDevice } = useDeviceStore();

    // Initialize map
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: [24.7136, 46.6753], // Riyadh
            zoom: 6,
            zoomControl: true,
            attributionControl: true,
        });

        L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 18 }).addTo(map);
        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Filter devices with position data
    const devicesWithLocation = useMemo(() =>
        devices.filter((d: Device) => d.lat && d.lng),
        [devices]);

    // Update markers
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const currentImeis = new Set(devicesWithLocation.map(d => d.imei));

        // Remove markers for devices no longer present
        markersRef.current.forEach((marker, imei) => {
            if (!currentImeis.has(imei)) {
                marker.remove();
                markersRef.current.delete(imei);
            }
        });

        // Add/update markers
        devicesWithLocation.forEach((device: Device) => {
            const isOnline = device.status === '1' || device.posType === 'GPS';
            const isSelected = selectedDevice?.imei === device.imei;
            const icon = createMarkerIcon(isOnline, isSelected);
            const position: L.LatLngExpression = [device.lat, device.lng];

            const existing = markersRef.current.get(device.imei);
            if (existing) {
                existing.setLatLng(position);
                existing.setIcon(icon);
            } else {
                const marker = L.marker(position, { icon })
                    .addTo(map)
                    .on('click', () => selectDevice(device));

                const popupContent = `
                    <div style="min-width:180px">
                        <div style="font-weight:600;font-size:14px;margin-bottom:6px;color:#f1f5f9">${device.deviceName}</div>
                        <div style="font-size:11px;color:#64748b;margin-bottom:8px">${device.imei}</div>
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                            <span style="width:6px;height:6px;border-radius:50%;background:${isOnline ? '#22c55e' : '#6b7280'}"></span>
                            <span style="font-size:12px;color:${isOnline ? '#22c55e' : '#6b7280'}">${isOnline ? 'Online' : 'Offline'}</span>
                        </div>
                        <div style="font-size:12px;color:#94a3b8">${device.lat.toFixed(5)}, ${device.lng.toFixed(5)}</div>
                        ${device.gpsTime ? `<div style="font-size:11px;color:#64748b;margin-top:4px">${device.gpsTime}</div>` : ''}
                    </div>
                `;
                marker.bindPopup(popupContent);
                markersRef.current.set(device.imei, marker);
            }
        });
    }, [devicesWithLocation, selectedDevice, selectDevice]);

    // Fly to selected device
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !selectedDevice) return;
        const d = selectedDevice as Device;
        if (d.lat && d.lng) {
            map.flyTo([d.lat, d.lng], 15, { duration: 1 });
        }
    }, [selectedDevice]);

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%' }}
        />
    );
}
