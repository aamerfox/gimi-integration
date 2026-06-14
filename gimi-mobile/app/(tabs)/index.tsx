import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Pressable, ScrollView, Platform,
  SectionList, Modal, Alert,
} from 'react-native';
import { useAuthStore } from '@/store/auth';
import { router } from 'expo-router';
import { useDeviceStore, Device } from '@/store/devices';
import { useGroupStore } from '@/store/groups';
import { useThemeStore } from '@/store/theme';
import { useLanguageStore } from '@/store/language';
import { gimiService } from '@/services/gimi';
import COLORS from '@/constants/Colors';
import DeviceMap from '@/components/DeviceMap';
import { useTranslation } from 'react-i18next';
import { formatGimiTime, isRecent } from '@/utils/time';
import { Feather } from '@expo/vector-icons';

// Types for API responses
// The TrackSolid API returns `result` as a flat Device array (not { deviceList: [] })
interface ApiDeviceListResult {
  result?: Device[];
}
interface ApiLocationItem {
  imei: string; lat?: number; lng?: number;
  speed?: number; gpsTime?: string; status?: string;
  direction?: number; posType?: string; batteryPowerVal?: string;
}
interface ApiLocationResult {
  result?: ApiLocationItem[];
}

const POLL_INTERVAL = 15000; // 15 seconds

export default function LiveMapScreen() {
  const { accessToken, userId, logout } = useAuthStore();
  const { 
    devices, 
    selectedDevice, 
    selectDevice, 
    updateDeviceLocations, 
    isLoading: loading, 
    error,
    setError
  } = useDeviceStore();
  const { theme, toggleTheme } = useThemeStore();
  const { language, setLanguage } = useLanguageStore();
  const { t, i18n } = useTranslation();
  const C = COLORS[theme];

  const handleLogout = () => {
    Alert.alert(
      t('auth.logout'),
      t('auth.confirmLogout'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.logout'),
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const [search, setSearch] = useState('');
  const [panelVisible, setPanelVisible] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(0); // Forcing re-render on lang change

  // Grouping state
  const { groups, deviceGroupMap, addGroup, removeGroup, assignDeviceToGroup } = useGroupStore();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ default: true });
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [optionsDevice, setOptionsDevice] = useState<Device | null>(null);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const [ringingImei, setRingingImei] = useState<string | null>(null);

  const handleRingTag = async (device: Device) => {
    if (!accessToken) return;
    setRingingImei(device.imei);
    try {
      await gimiService.sendDeviceCommand(accessToken, device.imei, 'FIND,3000#');
      Alert.alert('Success', `Sent ring command to ${device.deviceName || device.imei}`);
    } catch (err: any) {
      Alert.alert('Failed to send command', err?.message || 'API error');
    } finally {
      setRingingImei(null);
    }
  };

  // ── Fetch live locations (manual refresh)
  const fetchLocations = useCallback(async () => {
    if (!accessToken || !userId) return;
    try {
      const res = await gimiService.getDevicesLocation(accessToken, userId) as ApiLocationResult;
      if (Array.isArray(res?.result)) updateDeviceLocations(res.result as Partial<Device>[]);
    } catch (err: any) {
      setError(err?.message || 'Failed to refresh device locations');
    }
  }, [accessToken, userId, updateDeviceLocations, setError]);

  // ── Language change listener
  useEffect(() => {
    const onLangChange = () => setForceUpdate((v) => v + 1);
    i18n.on('languageChanged', onLangChange);

    return () => {
      i18n.off('languageChanged', onLangChange);
    };
  }, [i18n]);

  // ── Filter devices
  const filtered = devices.filter((d) =>
    d.deviceName.toLowerCase().includes(search.toLowerCase()) ||
    d.imei.includes(search)
  );

  // Build sections for SectionList
  const sectionsMap: Record<string, Device[]> = { default: [] };
  groups.forEach(g => { sectionsMap[g.id] = []; });

  filtered.forEach(d => {
    const groupId = deviceGroupMap[d.imei];
    if (groupId && sectionsMap[groupId]) {
      sectionsMap[groupId].push(d);
    } else {
      sectionsMap.default.push(d);
    }
  });

  const sections = [
    { id: 'default', title: 'Default group', data: sectionsMap.default },
    ...groups.map(g => ({ id: g.id, title: g.name, data: sectionsMap[g.id] }))
  ].filter(s => s.data.length > 0 || s.id !== 'default'); // Keep custom empty groups but hide empty default

  const onlineCount = devices.filter((d) => d.status === '1' || d.posType === 'GPS' || isRecent(d.gpsTime || d.sysTime)).length;

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    addGroup(newGroupName.trim());
    setNewGroupName('');
    setShowAddGroupModal(false);
  };

  const handleAssignOption = (groupId: string | null) => {
    if (optionsDevice) {
      assignDeviceToGroup(optionsDevice.imei, groupId);
      setOptionsDevice(null);
    }
  };

  const s = styles(C);

  // ── Device panel item
  const renderDevice = ({ item }: { item: Device }) => {
    const isOnline = item.status === '1' || item.posType === 'GPS' || isRecent(item.gpsTime || item.sysTime);
    const isSelected = selectedDevice?.imei === item.imei;
    return (
      <TouchableOpacity
        style={[s.deviceItem, isSelected && s.deviceItemSelected]}
        onPress={() => selectDevice(isSelected ? null : item)}
        activeOpacity={0.85}
      >
        <View style={[s.statusDot, { backgroundColor: isOnline ? C.online : C.offline }]} />
        <View style={s.deviceInfo}>
          <Text style={s.deviceName} numberOfLines={1}>{item.deviceName}</Text>
          <Text style={s.deviceImei}>{item.imei}</Text>
          {item.speed !== undefined && (
            <Text style={s.deviceMeta}>
              {isOnline ? <><Feather name="navigation" size={11} color={C.textSecondary} /> {item.speed} km/h</> : <><Feather name="pause-circle" size={11} color={C.textSecondary} /> {t('dashboard.static')}</>}
              {item.gpsTime ? <>   <Feather name="clock" size={11} color={C.textSecondary} /> {formatGimiTime(item.gpsTime).split(' ')[1].slice(0, 5)}</> : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={s.optionsBtn}
          onPress={() => setOptionsDevice(item)}
        >
          <Text style={s.optionsBtnText}>⋮</Text>
        </TouchableOpacity>
        <View style={[s.badge, { backgroundColor: isOnline ? `${C.online}20` : `${C.offline}20` }]}>
          <Text style={[s.badgeText, { color: isOnline ? C.online : C.offline }]}>
            {isOnline ? t('dashboard.online') : t('dashboard.offline')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: any }) => {
    const isExpanded = expandedGroups[section.id] !== false; // default to true
    return (
      <TouchableOpacity style={s.sectionHeader} onPress={() => toggleGroup(section.id)}>
        <Text style={s.sectionHeaderText}>
          {isExpanded ? '▼' : '▶'} {section.title} ({section.data.length})
        </Text>
        {section.id !== 'default' && (
          <TouchableOpacity onPress={() => Alert.alert('Delete Group', `Delete ${section.title}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => removeGroup(section.id) }
          ])}
          >
            <Text style={s.deleteGroupText}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      {/* ── Map ── */}
      <DeviceMap
        devices={devices}
        selectedImei={selectedDevice?.imei ?? null}
        onMarkerTap={(imei) => {
          const dev = devices.find((d) => d.imei === imei);
          selectDevice(dev ?? null);
        }}
        theme={theme}
        style={s.map}
      />

      {/* ── Top status bar overlay ── */}
      <View style={s.topBar} pointerEvents="box-none">
        <View style={s.statsRow}>
          <View style={s.statChip}>
            <View style={[s.dotSmall, { backgroundColor: C.online }]} />
            <Text style={s.statText}>{onlineCount} Online</Text>
          </View>
          <View style={s.statChip}>
            <View style={[s.dotSmall, { backgroundColor: C.offline }]} />
            <Text style={s.statText}>{devices.length - onlineCount} Offline</Text>
          </View>
          {loading && <ActivityIndicator size="small" color={C.accent} style={{ marginLeft: 8 }} />}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Language toggle */}
          <TouchableOpacity style={s.themeBtn} onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
            <Text style={[s.themeBtnText, { fontSize: 13, fontWeight: '700' }]}>{language === 'en' ? 'عربي' : 'EN'}</Text>
          </TouchableOpacity>

          {/* Theme toggle */}
          <TouchableOpacity style={s.themeBtn} onPress={toggleTheme}>
            <Feather name={theme === 'dark' ? 'sun' : 'moon'} size={20} color={C.textPrimary} />
          </TouchableOpacity>

          {/* Logout button */}
          <TouchableOpacity style={s.themeBtn} onPress={handleLogout}>
            <Feather name="log-out" size={20} color={C.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Device panel toggle ── */}
      <TouchableOpacity
        style={[s.panelToggle, { bottom: panelVisible ? 320 : 0 }]}
        onPress={() => setPanelVisible((v) => !v)}
      >
        <Text style={s.panelToggleText}>{panelVisible ? '▼ Devices' : '▲ Devices'}</Text>
      </TouchableOpacity>

      {/* ── Device panel (bottom sheet style) ── */}
      {panelVisible && (
        <View style={s.panel}>
          {/* Search */}
          <View style={s.searchRow}>
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search devices..."
              placeholderTextColor={C.textMuted}
            />
            <TouchableOpacity onPress={() => setShowAddGroupModal(true)} style={s.refreshBtn}>
              <Text style={s.refreshBtnText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={fetchLocations} style={s.refreshBtn}>
              <Text style={s.refreshBtnText}>⟳</Text>
            </TouchableOpacity>
          </View>

          {error && (
            <Text style={s.errorText}>{error}</Text>
          )}

          {/* Selected device detail */}
          {selectedDevice && (
            <View style={s.selectedCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.selectedCardInner}>
                  <Text style={s.selectedName}>{selectedDevice.deviceName}</Text>
                  <Text style={s.selectedMeta}><Feather name="radio" size={12} color={C.textSecondary} /> {selectedDevice.imei}</Text>
                  <Text style={s.selectedMeta}><Feather name="navigation" size={12} color={C.textSecondary} /> {selectedDevice.speed ?? 0} km/h</Text>
                  {selectedDevice.lat && (
                    <Text style={s.selectedMeta}>
                      <Feather name="map-pin" size={12} color={C.textSecondary} /> {selectedDevice.lat?.toFixed(5)}, {selectedDevice.lng?.toFixed(5)}
                    </Text>
                  )}
                  {selectedDevice.batteryPowerVal && (
                    <Text style={s.selectedMeta}><Feather name="battery" size={12} color={C.textSecondary} /> {selectedDevice.batteryPowerVal}%</Text>
                  )}
                  <Text style={s.selectedMeta}><Feather name="clock" size={12} color={C.textSecondary} /> {formatGimiTime(selectedDevice.sysTime || selectedDevice.gpsTime)}</Text>
                  
                  <TouchableOpacity
                    style={{
                      backgroundColor: `${C.accent}20`,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      marginLeft: 4
                    }}
                    onPress={() => handleRingTag(selectedDevice)}
                    disabled={ringingImei === selectedDevice.imei}
                  >
                    {ringingImei === selectedDevice.imei ? (
                      <ActivityIndicator size="small" color={C.accent} style={{ transform: [{ scale: 0.8 }] }} />
                    ) : (
                      <Feather name="bell" size={12} color={C.accent} />
                    )}
                    <Text style={{ color: C.accent, fontSize: 12, fontWeight: '700' }}>
                      Ring Tag
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={s.clearBtn} onPress={() => selectDevice(null)}>
                    <Text style={s.clearBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          )}

          {/* Device list */}
          <SectionList
            sections={sections}
            keyExtractor={(d) => d.imei}
            renderItem={({ item, section }) => {
              if (expandedGroups[section.id] === false) return null;
              return renderDevice({ item });
            }}
            renderSectionHeader={renderSectionHeader}
            style={s.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={[s.emptyText, { color: C.textMuted }]}>
                {loading ? 'Loading devices...' : 'No devices found'}
              </Text>
            }
          />
        </View>
      )}

      {/* Add Group Modal */}
      <Modal visible={showAddGroupModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Create New Group</Text>
            <TextInput
              style={s.modalInput}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Group Name"
              placeholderTextColor={C.textMuted}
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setShowAddGroupModal(false)}>
                <Text style={s.modalBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnSubmit} onPress={handleCreateGroup}>
                <Text style={s.modalBtnTextSubmit}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Device Modal */}
      <Modal visible={!!optionsDevice} transparent animationType="slide">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setOptionsDevice(null)}>
          <View style={[s.modalContent, s.optionsModal]}>
            <Text style={s.modalTitle}>Assign "{optionsDevice?.deviceName}" to Group</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity style={s.optionItem} onPress={() => handleAssignOption(null)}>
                <Text style={s.optionText}>Default group (Unassign)</Text>
              </TouchableOpacity>
              {groups.map(g => (
                <TouchableOpacity key={g.id} style={s.optionItem} onPress={() => handleAssignOption(g.id)}>
                  <Text style={s.optionText}>{g.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const styles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPrimary },
  map: { flex: 1 },

  topBar: {
    position: 'absolute', top: 12, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  statsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.bgCard,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dotSmall: { width: 8, height: 8, borderRadius: 4 },
  statText: { fontSize: 12, fontWeight: '600', color: C.textSecondary },
  themeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  themeBtnText: { fontSize: 20 },

  panelToggle: {
    position: 'absolute',
    left: 0, right: 0,
    backgroundColor: C.bgSecondary,
    paddingVertical: 8, alignItems: 'center',
    borderTopWidth: 1, borderColor: C.border,
  },
  panelToggleText: { fontSize: 12, fontWeight: '700', color: C.accent },

  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.bgSecondary,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderTopWidth: 1, borderColor: C.border,
    height: 320,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, gap: 8,
  },
  searchInput: {
    flex: 1, backgroundColor: C.bgElevated,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 13, color: C.textPrimary, borderWidth: 1, borderColor: C.border,
  },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center',
  },
  refreshBtnText: { fontSize: 18, color: C.accent },
  errorText: { fontSize: 12, color: C.danger, paddingHorizontal: 12, marginBottom: 4 },
  list: { flex: 1 },

  deviceItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderColor: C.border, gap: 10,
  },
  deviceItemSelected: { backgroundColor: C.accentDim },
  statusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 13, fontWeight: '700', color: C.textPrimary },
  deviceImei: { fontSize: 10, color: C.textMuted, marginTop: 1 },
  deviceMeta: { fontSize: 11, color: C.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  selectedCard: {
    marginHorizontal: 12, marginBottom: 6,
    backgroundColor: C.bgElevated, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  selectedCardInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, gap: 12,
  },
  selectedName: { fontSize: 13, fontWeight: '800', color: C.textPrimary },
  selectedMeta: { fontSize: 12, color: C.textSecondary },
  clearBtn: {
    marginLeft: 8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  clearBtnText: { color: C.danger, fontSize: 13, fontWeight: '700' },
  emptyText: { textAlign: 'center', marginTop: 24, fontSize: 13 },

  // Grouping Styles
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.bgCard, paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderColor: C.border,
  },
  sectionHeaderText: { fontSize: 14, fontWeight: '700', color: C.textPrimary },
  deleteGroupText: { fontSize: 14, color: C.textMuted, paddingHorizontal: 8 },
  optionsBtn: { padding: 8, marginRight: 4, alignItems: 'center', justifyContent: 'center' },
  optionsBtnText: { fontSize: 18, fontWeight: '600', color: C.textMuted },

  // Modal Styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalContent: {
    backgroundColor: C.bgPrimary, width: '100%', borderRadius: 16,
    padding: 24, borderWidth: 1, borderColor: C.border,
  },
  optionsModal: { justifyContent: 'flex-end', marginTop: 'auto', marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary, marginBottom: 16 },
  modalInput: {
    backgroundColor: C.bgElevated, borderRadius: 10, padding: 12,
    fontSize: 14, color: C.textPrimary, borderWidth: 1, borderColor: C.border, marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtnCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  modalBtnSubmit: { backgroundColor: C.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  modalBtnTextCancel: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  modalBtnTextSubmit: { fontSize: 14, fontWeight: '700', color: '#fff' },
  optionItem: { paddingVertical: 16, borderBottomWidth: 1, borderColor: C.border },
  optionText: { fontSize: 15, color: C.textPrimary },
});
