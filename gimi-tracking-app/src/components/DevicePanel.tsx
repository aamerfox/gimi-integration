import { useState } from 'react';
import { useDeviceStore } from '../store/devices';
import type { Device } from '../store/devices';

export default function DevicePanel() {
    const { devices, selectedDevice, selectDevice } = useDeviceStore();
    const [search, setSearch] = useState('');

    const filteredDevices = devices.filter((d: Device) =>
        d.deviceName.toLowerCase().includes(search.toLowerCase()) ||
        d.imei.includes(search)
    );

    const onlineCount = devices.filter((d: Device) => d.status === '1' || d.posType === 'GPS').length;

    return (
        <div
            className="glass-panel"
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <div style={{
                padding: '16px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Devices</h2>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <span className="badge badge-online">{onlineCount}</span>
                        <span className="badge badge-offline">{devices.length - onlineCount}</span>
                    </div>
                </div>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="sx-input"
                    placeholder="Search devices..."
                    style={{ fontSize: '13px', padding: '8px 12px' }}
                />
            </div>

            {/* Device List */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px',
            }}>
                {filteredDevices.length === 0 ? (
                    <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '13px',
                    }}>
                        No devices found
                    </div>
                ) : (
                    filteredDevices.map((device: Device) => {
                        const isOnline = device.status === '1' || device.posType === 'GPS';
                        const isSelected = selectedDevice?.imei === device.imei;
                        const batteryVal = parseFloat(device.batteryPowerVal || device.battery || '0');
                        const batteryClass = batteryVal > 50 ? '--battery' : batteryVal > 20 ? '--battery-mid' : '--battery-low';

                        return (
                            <button
                                key={device.imei}
                                onClick={() => selectDevice(isSelected ? null : device)}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: 'var(--radius-md)',
                                    border: isSelected ? '1px solid var(--border-accent)' : '1px solid transparent',
                                    background: isSelected ? 'var(--accent-dim)' : 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    color: 'inherit',
                                    transition: 'all 0.15s ease',
                                    marginBottom: '4px',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                }}
                                onMouseLeave={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {/* Status indicator */}
                                    <div style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: '10px',
                                        background: isOnline ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isOnline ? 'var(--online)' : 'var(--offline)'} strokeWidth="2">
                                            <circle cx="12" cy="10" r="3" /><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7 11.5 7.3 11.8a1 1 0 0 0 1.4 0C13 21.5 20 15.4 20 10a8 8 0 0 0-8-8z" />
                                        </svg>
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {device.deviceName}
                                            </span>
                                            <span className={`status-dot ${isOnline ? 'status-dot--online' : 'status-dot--offline'}`} />
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {device.imei}
                                        </div>
                                    </div>
                                </div>

                                {/* Battery & Speed row */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    marginTop: '8px',
                                    marginLeft: '46px',
                                }}>
                                    {/* Battery */}
                                    {batteryVal > 0 && (
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Battery</span>
                                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{batteryVal}%</span>
                                            </div>
                                            <div className="progress-bar">
                                                <div className={`progress-bar__fill progress-bar__fill${batteryClass}`} style={{ width: `${batteryVal}%` }} />
                                            </div>
                                        </div>
                                    )}
                                    {/* Speed */}
                                    {device.speed != null && (
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {device.speed} km/h
                                        </span>
                                    )}
                                </div>

                                {/* GPS time */}
                                {device.gpsTime && (
                                    <div style={{ marginTop: '4px', marginLeft: '46px', fontSize: '10px', color: 'var(--text-muted)' }}>
                                        Last: {device.gpsTime}
                                    </div>
                                )}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
