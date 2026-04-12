import { useState, useRef, useEffect } from 'react';
import { useDeviceStore } from '../store/devices';
import { useGroupStore } from '../store/groups';
import { useAuthStore } from '../store/auth';
import { gimiService } from '../services/gimi';
import type { Device } from '../store/devices';
import { ChevronRight, ChevronDown, MoreVertical, Plus, Trash2, Edit2, FolderInput } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isRecent } from '../utils/time';

interface DevicePanelProps {
    onDeviceSelect?: () => void;
}

export default function DevicePanel({ onDeviceSelect }: DevicePanelProps = {}) {
    const { devices, selectedDevice, selectDevice } = useDeviceStore();
    const { groups, deviceGroupMap, addGroup, removeGroup, assignDeviceToGroup, renameGroup } = useGroupStore();
    const { accessToken } = useAuthStore();
    const [search, setSearch] = useState('');
    const { t } = useTranslation();

    const [renamingDevice, setRenamingDevice] = useState<Device | null>(null);
    const [newDeviceName, setNewDeviceName] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);

    const handleRenameSubmit = async () => {
        if (!renamingDevice || !newDeviceName.trim()) return;
        setIsRenaming(true);
        try {
            await gimiService.updateDeviceName(accessToken || '', renamingDevice.imei, newDeviceName.trim());
            
            const updatedDevices = devices.map(d => 
                d.imei === renamingDevice.imei ? { ...d, deviceName: newDeviceName.trim() } : d
            );
            useDeviceStore.getState().setDevices(updatedDevices);
            if (selectedDevice?.imei === renamingDevice.imei) {
                selectDevice({ ...selectedDevice, deviceName: newDeviceName.trim() });
            }
            
            setRenamingDevice(null);
        } catch (error) {
            console.error('Failed to rename device', error);
            alert('Failed to rename device');
        } finally {
            setIsRenaming(false);
        }
    };

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

    const onlineCount = devices.filter((d: Device) => d.status === '1' || d.posType === 'GPS' || isRecent(d.sysTime)).length;

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
        if (window.confirm(t('devices.deleteGroupConfirm', 'Are you sure you want to delete this group? Devices will be moved to Default group.'))) {
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
                        saudiex ({t('devices.stock')}: {devices.length} / {t('devices.total')}: {devices.length})
                    </div>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="sx-input"
                            placeholder={t('common.search')}
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
                <div style={{ marginBottom: '16px', padding: '0 4px' }}>
                    <button
                        onClick={handleAddGroup}
                        className="sx-btn sx-btn-sm sx-btn-outline"
                    >
                        <Plus size={16} /> {t('devices.addGroup')}
                    </button>
                </div>

                {/* Status Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px' }}>{t('alertsFilters.all')} {devices.length}</span>
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
                        onRenameDevice={(d: Device) => { setNewDeviceName(d.deviceName); setRenamingDevice(d); }}
                        menuRef={menuRef}
                    />
                ))}

                {/* Render Default Group */}
                <GroupSection
                    id="default"
                    name={t('devices.defaultGroup', 'Default group')}
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
                    onRenameDevice={(d: Device) => { setNewDeviceName(d.deviceName); setRenamingDevice(d); }}
                    menuRef={menuRef}
                />
            </div>

            {/* Rename Device Modal */}
            {renamingDevice && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="glass-panel" style={{
                        background: 'var(--bg-primary)',
                        padding: '24px',
                        borderRadius: '8px',
                        width: '320px',
                        border: '1px solid var(--border)',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                    }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--text-primary)' }}>
                            Rename Device
                        </h3>
                        <input
                            type="text"
                            value={newDeviceName}
                            onChange={e => setNewDeviceName(e.target.value)}
                            className="sx-input"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid var(--border)',
                                borderRadius: '4px',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                marginBottom: '16px'
                            }}
                            autoFocus
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                                className="sx-btn sx-btn-outline"
                                onClick={() => setRenamingDevice(null)}
                                disabled={isRenaming}
                            >
                                Cancel
                            </button>
                            <button
                                className="sx-btn sx-btn-primary"
                                onClick={handleRenameSubmit}
                                disabled={isRenaming || !newDeviceName.trim()}
                            >
                                {isRenaming ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
    onRenameDevice: (d: Device) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    menuRef: any;
}

function GroupSection({
    id, name, devices, isExpanded, onToggle, groups, selectedDevice, selectDevice, onDeviceSelect, assignDeviceToGroup, menuOpenFor, setMenuOpenFor, groupMenuOpenFor, setGroupMenuOpenFor, handleRenameGroup, handleDeleteGroup, onRenameDevice, menuRef
}: GroupSectionProps) {
    const isDefault = id === 'default';
    const { t } = useTranslation();

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
                            onRename={() => {
                                onRenameDevice(device);
                                setMenuOpenFor(null);
                            }}
                            menuRef={menuRef}
                        />
                    ))}
                    {devices.length === 0 && (
                        <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            {t('devices.emptyGroup')}
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
function DeviceItem({ device, isSelected, onSelect, menuOpen, onMenuToggle, groups, currentGroupId, onAssign, onRename, menuRef }: any) {
    const isOnline = device.status === '1' || device.posType === 'GPS';
    const batteryVal = parseFloat(String(device.batteryPowerVal || device.battery || '0'));
    const { t } = useTranslation();

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={onSelect}
                className={`device-item-btn ${isSelected ? 'selected' : ''}`}
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
                    <div className="group-menu-item" onClick={(e) => { e.stopPropagation(); onRename(); }}>
                        <Edit2 size={14} /> Rename Device
                    </div>
                    <div style={{ fontSize: '11px', padding: '6px 8px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                        {t('devices.moveToGroup')}
                    </div>
                    {currentGroupId !== 'default' && (
                        <div className="group-menu-item" onClick={(e) => { e.stopPropagation(); onAssign(null); }}>
                            <FolderInput size={14} /> {t('devices.defaultGroup', 'Default group')}
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
                            {t('devices.noOtherGroups', 'No other groups exist.')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
