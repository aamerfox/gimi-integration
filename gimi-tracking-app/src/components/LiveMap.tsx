import { useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useDeviceStore } from '../store/devices';
import type { Device } from '../store/devices';
import { formatGimiTime, isRecent } from '../utils/time';

export interface LiveMapHandle {
    zoomIn: () => void;
    zoomOut: () => void;
}

const GOOGLE_STREET_URL = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
const GOOGLE_STREET_ATTR = 'Map data &copy; <a href="https://www.google.com/maps">Google</a>';
const GOOGLE_SATELLITE_URL = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
const GOOGLE_SATELLITE_ATTR = 'Map data &copy; <a href="https://www.google.com/maps">Google</a>';
const GOOGLE_HYBRID_URL = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
const GOOGLE_HYBRID_ATTR = 'Map data &copy; <a href="https://www.google.com/maps">Google</a>';

function createMarkerIcon(isOnline: boolean, isSelected: boolean) {
    const size = isSelected ? 40 : 32;
    const color = isOnline ? '#00d4aa' : '#00d4aa'; // Changed to green for both
    const glowColor = isOnline ? 'rgba(0,212,170,0.3)' : 'rgba(0,212,170,0.15)';
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

const LiveMap = forwardRef<LiveMapHandle>(function LiveMap(_unusedProps, ref) {
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<Map<string, L.Marker>>(new Map());

    const { devices, selectedDevice, selectDevice } = useDeviceStore();

    // Initialize map
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const streetLayer = L.tileLayer(GOOGLE_STREET_URL, { attribution: GOOGLE_STREET_ATTR, maxZoom: 18 });
        const satelliteLayer = L.tileLayer(GOOGLE_SATELLITE_URL, { attribution: GOOGLE_SATELLITE_ATTR, maxZoom: 18 });
        const hybridLayer = L.tileLayer(GOOGLE_HYBRID_URL, { attribution: GOOGLE_HYBRID_ATTR, maxZoom: 18 });

        const baseMaps = {
            "Google Streets": streetLayer,
            "Google Satellite": satelliteLayer,
            "Google Hybrid": hybridLayer
        };

        const map = L.map(containerRef.current, {
            center: [26.5, 45.1], // Between Riyadh and Damascus
            zoom: 5,
            zoomControl: false,  // We render our own zoom buttons in Dashboard
            attributionControl: true,
            layers: [streetLayer] // Default to street
        });

        L.control.layers(baseMaps, undefined, { position: 'topleft' }).addTo(map);
        mapRef.current = map;

        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
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
            const isOnline = device.status === '1' || device.posType === 'GPS' || isRecent(device.sysTime);
            const isSelected = selectedDevice?.imei === device.imei;
            const icon = createMarkerIcon(isOnline, isSelected);
            const position: L.LatLngExpression = [device.lat as number, device.lng as number];

            const displayTime = formatGimiTime(device.sysTime || device.gpsTime);

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
                        <div style="font-size:12px;color:#94a3b8">${(device.lat || 0).toFixed(5)}, ${(device.lng || 0).toFixed(5)}</div>
                        <div style="font-size:11px;color:#64748b;margin-top:4px">${displayTime}</div>
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
        if (d.lat !== undefined && d.lng !== undefined) {
            map.flyTo([d.lat, d.lng], 15, { duration: 1 });
        }
    }, [selectedDevice]);

    useImperativeHandle(ref, () => ({
        zoomIn: () => mapRef.current?.zoomIn(),
        zoomOut: () => mapRef.current?.zoomOut(),
    }));

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100%' }}
        />
    );
});

export default LiveMap;
