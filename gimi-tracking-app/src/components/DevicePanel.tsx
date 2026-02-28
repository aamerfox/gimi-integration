import { useState, useRef, useEffect } from 'react';
import { useDeviceStore } from '../store/devices';
import { useGroupStore } from '../store/groups';
import type { Device } from '../store/devices';
import { ChevronRight, ChevronDown, MoreVertical, Plus, Trash2, Edit2, FolderInput } from 'lucide-react';

interface DevicePanelProps {
    onDeviceSelect?: () => void;
}

export default function DevicePanel({ onDeviceSelect }: DevicePanelProps = {}) {
    const { devices, selectedDevice, selectDevice } = useDeviceStore();
    const { groups, deviceGroupMap, addGroup, removeGroup, assignDeviceToGroup, renameGroup } = useGroupStore();
    const [search, setSearch] = useState('');

    // Group UI states
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ default: true });
    const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null); // imei of device
    const [groupMenuOpenFor, setGroupMenuOpenFor] = useState<string | null>(null); // id of group

    // Close menus on outside click
    const menuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpenFor(null);
                setGroupMenuOpenFor(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredDevices = devices.filter((d: Device) =>
        d.deviceName.toLowerCase().includes(search.toLowerCase()) ||
        d.imei.includes(search)
    );

    const onlineCount = devices.filter((d: Device) => d.status === '1' || d.posType === 'GPS').length;

    // Grouping logic
    const groupedDevices: Record<string, Device[]> = {
        default: [],
    };
    groups.forEach(g => { groupedDevices[g.id] = []; });

    filteredDevices.forEach(d => {
        const gid = deviceGroupMap[d.imei];
        if (gid && groupedDevices[gid]) {
            groupedDevices[gid].push(d);
        } else {
            groupedDevices.default.push(d);
        }
    });

    const toggleGroup = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedGroups((prev: Record<string, boolean>) => ({ ...prev, [id]: prev[id] === undefined ? false : !prev[id] }));
    };

    const handleAddGroup = () => {
        const name = prompt('Enter new group name:');
        if (name && name.trim()) {
            addGroup(name.trim());
        }
    };

    const handleRenameGroup = (id: string) => {
        const currentName = groups.find(g => g.id === id)?.name || '';
        const name = prompt('Enter new name for group:', currentName);
        if (name && name.trim()) {
            renameGroup(id, name.trim());
        }
        setGroupMenuOpenFor(null);
    };

    const handleDeleteGroup = (id: string) => {
        if (window.confirm('Are you sure you want to delete this group? Devices will be moved to Default group.')) {
            removeGroup(id);
        }
        setGroupMenuOpenFor(null);
    };

    return (
        <div
            className="glass-panel"
            style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
                background: 'var(--bg-secondary)', // Theme matching with Sidebar
            }}
        >
            {/* Header */}
            <div style={{
                padding: '16px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
            }}>
                {/* Search */}
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                        saudiex(Stock{devices.length}/Total{devices.length})
                    </div>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="sx-input"
                            placeholder="Please enter the device name or IMEI"
                            style={{
                                fontSize: '13px',
                                padding: '8px 12px',
                                width: '100%',
                                border: '1px solid var(--border)',
                                borderRadius: '4px',
                                outline: 'none',
                                background: 'transparent',
                                color: 'var(--text-primary)'
                            }}
                        />
                        <span style={{ position: 'absolute', right: '10px', top: '9px', color: 'var(--text-muted)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </span>
                    </div>
                </div>

                {/* Add Group Button */}
                <div style={{ marginBottom: '16px' }}>
                    <button
                        onClick={handleAddGroup}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'var(--accent)',
                            border: '1px solid var(--accent)',
                            background: 'transparent',
                            padding: '6px 16px',
                            borderRadius: '4px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            fontWeight: 500,
                        }}
                    >
                        <Plus size={16} /> Add group
                    </button>
                </div>

                {/* Status Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px' }}>All {devices.length}</span>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '13px', fontWeight: 500 }}>
                        <span style={{ color: 'var(--online)', display: 'flex', alignItems: 'center', gap: '4px' }}>▲ {onlineCount}</span>
                        <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>♥ {devices.length - onlineCount}</span>
                        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" /><polyline points="14 2 14 8 20 8" /><path d="M2 15h10" /><path d="M5 12l-3 3 3 3" /></svg>
                            2
                        </span>
                    </div>
                </div>
            </div>

            {/* Device List by Groups */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 16px',
            }}>
                {/* Render Custom Groups */}
                {groups.map(g => (
                    <GroupSection
                        key={g.id}
                        id={g.id}
                        name={g.name}
                        devices={groupedDevices[g.id]}
                        isExpanded={expandedGroups[g.id] ?? false}
                        onToggle={(e) => toggleGroup(g.id, e)}
                        groups={groups}
                        selectedDevice={selectedDevice}
                        selectDevice={selectDevice}
                        onDeviceSelect={onDeviceSelect}
                        assignDeviceToGroup={assignDeviceToGroup}
                        menuOpenFor={menuOpenFor}
                        setMenuOpenFor={setMenuOpenFor}
                        groupMenuOpenFor={groupMenuOpenFor}
                        setGroupMenuOpenFor={setGroupMenuOpenFor}
                        handleRenameGroup={handleRenameGroup}
                        handleDeleteGroup={handleDeleteGroup}
                        menuRef={menuRef}
                    />
                ))}

                {/* Render Default Group */}
                <GroupSection
                    id="default"
                    name="Default group"
                    devices={groupedDevices.default}
                    isExpanded={expandedGroups.default ?? true}
                    onToggle={(e) => toggleGroup('default', e)}
                    groups={groups}
                    selectedDevice={selectedDevice}
                    selectDevice={selectDevice}
                    onDeviceSelect={onDeviceSelect}
                    assignDeviceToGroup={assignDeviceToGroup}
                    menuOpenFor={menuOpenFor}
                    setMenuOpenFor={setMenuOpenFor}
                    groupMenuOpenFor={groupMenuOpenFor}
                    setGroupMenuOpenFor={setGroupMenuOpenFor}
                    handleRenameGroup={() => { }}
                    handleDeleteGroup={() => { }}
                    menuRef={menuRef}
                />
            </div>
        </div>
    );
}

// -------------------------------------------------------------------
// Subcomponents
// -------------------------------------------------------------------

interface GroupSectionProps {
    id: string;
    name: string;
    devices: Device[];
    isExpanded: boolean;
    onToggle: (e: React.MouseEvent) => void;
    groups: { id: string, name: string }[];
    selectedDevice: Device | null;
    selectDevice: (d: Device | null) => void;
    onDeviceSelect?: () => void;
    assignDeviceToGroup: (imei: string, gid: string | null) => void;
    menuOpenFor: string | null;
    setMenuOpenFor: (imei: string | null) => void;
    groupMenuOpenFor: string | null;
    setGroupMenuOpenFor: (id: string | null) => void;
    handleRenameGroup: (id: string) => void;
    handleDeleteGroup: (id: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    menuRef: any;
}

function GroupSection({
    id, name, devices, isExpanded, onToggle, groups, selectedDevice, selectDevice, onDeviceSelect, assignDeviceToGroup, menuOpenFor, setMenuOpenFor, groupMenuOpenFor, setGroupMenuOpenFor, handleRenameGroup, handleDeleteGroup, menuRef
}: GroupSectionProps) {
    const isDefault = id === 'default';

    return (
        <div style={{ marginBottom: '12px' }}>
            {/* Group Header */}
            <div
                onClick={onToggle}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--bg-primary)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    position: 'relative',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>
                        {name}({devices.length})
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {!isDefault && (
                        <div
                            style={{ position: 'relative' }}
                            onClick={(e) => { e.stopPropagation(); setGroupMenuOpenFor(groupMenuOpenFor === id ? null : id); }}
                        >
                            <MoreVertical size={16} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
                            {groupMenuOpenFor === id && (
                                <div ref={menuRef} style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '100%',
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    padding: '4px',
                                    zIndex: 50,
                                    minWidth: '120px',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                }}>
                                    <div
                                        className="group-menu-item"
                                        onClick={(e) => { e.stopPropagation(); handleRenameGroup(id); }}
                                    >
                                        <Edit2 size={14} /> Rename
                                    </div>
                                    <div
                                        className="group-menu-item danger"
                                        onClick={(e) => { e.stopPropagation(); handleDeleteGroup(id); }}
                                    >
                                        <Trash2 size={14} /> Delete
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Device List */}
            {isExpanded && (
                <div style={{ marginTop: '8px' }}>
                    {devices.map(device => (
                        <DeviceItem
                            key={device.imei}
                            device={device}
                            isSelected={selectedDevice?.imei === device.imei}
                            onSelect={() => {
                                selectDevice(selectedDevice?.imei === device.imei ? null : device);
                                if (selectedDevice?.imei !== device.imei) onDeviceSelect?.();
                            }}
                            menuOpen={menuOpenFor === device.imei}
                            onMenuToggle={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                setMenuOpenFor(menuOpenFor === device.imei ? null : device.imei);
                            }}
                            groups={groups}
                            currentGroupId={id}
                            onAssign={(gid: string | null) => {
                                assignDeviceToGroup(device.imei, gid);
                                setMenuOpenFor(null);
                            }}
                            menuRef={menuRef}
                        />
                    ))}
                    {devices.length === 0 && (
                        <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            Empty group
                        </div>
                    )}
                </div>
            )}

            <style>{`
            .group-menu-item {
                padding: 8px;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                border-radius: 4px;
                color: var(--text-primary);
            }
            .group-menu-item:hover {
                background: var(--bg-primary);
            }
            .group-menu-item.danger:hover {
                background: rgba(239, 68, 68, 0.1);
                color: var(--danger);
            }
            `}</style>
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DeviceItem({ device, isSelected, onSelect, menuOpen, onMenuToggle, groups, currentGroupId, onAssign, menuRef }: any) {
    const isOnline = device.status === '1' || device.posType === 'GPS';
    const batteryVal = parseFloat(String(device.batteryPowerVal || device.battery || '0'));

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={onSelect}
                style={{
                    display: 'block',
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
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
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-primary)';
                }}
                onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Vehicle Icon */}
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                            <circle cx="7" cy="17" r="2" />
                            <path d="M9 17h6" />
                            <circle cx="17" cy="17" r="2" />
                        </svg>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {device.deviceName}
                            </span>
                            <div onClick={onMenuToggle} style={{ padding: '4px', cursor: 'pointer' }}>
                                <MoreVertical size={16} color="var(--text-muted)" />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <span style={{ fontSize: '11px', background: isOnline ? 'var(--online)' : 'var(--offline)', color: '#fff', padding: '2px 6px', borderRadius: '12px' }}>
                                {batteryVal}%
                            </span>
                            <span style={{ color: 'var(--offline)', fontSize: '12px' }}>♥</span>
                        </div>
                    </div>
                </div>
            </button>

            {/* Assign Device Menu */}
            {menuOpen && (
                <div ref={menuRef} style={{
                    position: 'absolute',
                    right: '10px',
                    top: '40px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '4px',
                    zIndex: 50,
                    minWidth: '160px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                    <div style={{ fontSize: '11px', padding: '6px 8px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                        Move to group...
                    </div>
                    {currentGroupId !== 'default' && (
                        <div className="group-menu-item" onClick={(e) => { e.stopPropagation(); onAssign(null); }}>
                            <FolderInput size={14} /> Default group
                        </div>
                    )}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {groups.map((g: any) => (
                        g.id !== currentGroupId && (
                            <div key={g.id} className="group-menu-item" onClick={(e) => { e.stopPropagation(); onAssign(g.id); }}>
                                <FolderInput size={14} /> {g.name}
                            </div>
                        )
                    ))}
                    {groups.length === 0 && currentGroupId === 'default' && (
                        <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            No other groups exist.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
