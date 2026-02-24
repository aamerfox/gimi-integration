import { useEffect, useState } from 'react';
import { useDeviceStore } from '../store/devices';
import type { Device } from '../store/devices';
import LiveMap from '../components/LiveMap';
import DevicePanel from '../components/DevicePanel';

export default function Dashboard() {
    const { devices, selectedDevice } = useDeviceStore();
    const [loading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<string>('');
    const [showPanel, setShowPanel] = useState(true);

    // Update "last updated" timestamp whenever devices change
    useEffect(() => {
        if (devices.length > 0) {
            setLastUpdate(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        }
    }, [devices]);

    const onlineCount = devices.filter((d: Device) => d.status === '1' || d.posType === 'GPS').length;
    const offlineCount = devices.length - onlineCount;

    return (
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Map - full screen */}
            <div style={{ flex: 1, position: 'relative' }}>
                <LiveMap />

                {/* Toggle panel button */}
                <button
                    onClick={() => setShowPanel(!showPanel)}
                    className="sx-btn-icon"
                    style={{
                        position: 'absolute',
                        top: 16,
                        left: showPanel ? 340 : 16,
                        zIndex: 1000,
                        width: 36,
                        height: 36,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        transition: 'left 0.3s ease',
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {showPanel ? (
                            <><polyline points="15 18 9 12 15 6" /></>
                        ) : (
                            <><polyline points="9 18 15 12 9 6" /></>
                        )}
                    </svg>
                </button>

                {/* Floating device panel */}
                {showPanel && (
                    <div
                        className="animate-slide-left"
                        style={{
                            position: 'absolute',
                            top: 16,
                            left: 16,
                            bottom: 52,
                            width: 320,
                            zIndex: 999,
                        }}
                    >
                        <DevicePanel />
                    </div>
                )}

                {/* Device detail card (right side) when selected */}
                {selectedDevice && selectedDevice.lat && (
                    <div
                        className="glass-panel animate-slide-right"
                        style={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            width: 280,
                            padding: '20px',
                            zIndex: 999,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: '10px',
                                background: 'var(--accent-dim)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                                    <circle cx="12" cy="10" r="3" /><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7 11.5 7.3 11.8a1 1 0 0 0 1.4 0C13 21.5 20 15.4 20 10a8 8 0 0 0-8-8z" />
                                </svg>
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{selectedDevice.deviceName}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedDevice.imei}</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <InfoTile label="Latitude" value={String(selectedDevice.lat?.toFixed(5) || '—')} />
                            <InfoTile label="Longitude" value={String(selectedDevice.lng?.toFixed(5) || '—')} />
                            <InfoTile label="Speed" value={`${selectedDevice.speed || 0} km/h`} />
                            <InfoTile label="Battery" value={`${selectedDevice.batteryPowerVal || '—'}%`} />
                            <InfoTile label="Position" value={selectedDevice.posType || 'N/A'} />
                            <InfoTile label="GPS Time" value={selectedDevice.gpsTime?.split(' ')[1] || '—'} />
                        </div>
                    </div>
                )}
            </div>

            {/* Status Bar */}
            <div style={{
                height: 'var(--statusbar-height)',
                background: 'var(--bg-secondary)',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: '20px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                flexShrink: 0,
            }}>
                <span>{devices.length} device{devices.length !== 1 ? 's' : ''}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="status-dot status-dot--online" style={{ width: 6, height: 6 }} />
                    {onlineCount} online
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="status-dot status-dot--offline" style={{ width: 6, height: 6 }} />
                    {offlineCount} offline
                </span>
                <span style={{ marginLeft: 'auto' }}>
                    {loading ? 'Loading...' : `Updated ${lastUpdate}`}
                </span>
            </div>
        </div>
    );
}

function InfoTile({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            padding: '10px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
        }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{value}</div>
        </div>
    );
}
