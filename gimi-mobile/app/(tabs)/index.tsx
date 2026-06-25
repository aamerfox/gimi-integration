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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatGimiTime, isRecent } from '@/utils/time';
import { Feather } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

// Types for API responses
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
  const insets = useSafeAreaInsets();
  const tabBarBottom = insets.bottom > 0 ? insets.bottom + 12 : (Platform.OS === 'android' ? 36 : 16);
  const panelBottom = tabBarBottom + 64 + 8; // tab bar is 64px high + 8px gap
  const safeDevices = Array.isArray(devices) ? devices : [];
  const C = COLORS[theme || 'dark'] || COLORS.dark;

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

  // Reanimated values for Bottom Sheet
  const translateY = useSharedValue(0);

  useEffect(() => {
    // When panel is visible, offset is 0; when hidden, it slides down leaving 52px visible
    // Panel height is 270, so 270 - 52 = 218 slides it down to show only the handle
    translateY.value = withSpring(panelVisible ? 0 : 218, {
      damping: 18,
      stiffness: 100,
    });
  }, [panelVisible]);

  const animatedPanelStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

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
      Alert.alert(t('map.ringTag'), t('map.ringSuccess', { name: device.deviceName || device.imei }));
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.includes('243')) {
        Alert.alert(t('map.ringTag'), t('errors.unsupportedCommand'));
      } else {
        Alert.alert(t('common.error'), errMsg || t('map.ringFail'));
      }
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
  const filtered = safeDevices.filter((d) =>
    (d.deviceName || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.imei || '').includes(search)
  );

  // Build sections for SectionList
  const sectionsMap: Record<string, Device[]> = { default: [] };
  const safeGroups = Array.isArray(groups) ? groups : [];
  safeGroups.forEach(g => { sectionsMap[g.id] = []; });

  const safeDeviceGroupMap = deviceGroupMap || {};
  filtered.forEach(d => {
    const groupId = safeDeviceGroupMap[d.imei];
    if (groupId && sectionsMap[groupId]) {
      sectionsMap[groupId].push(d);
    } else {
      sectionsMap.default.push(d);
    }
  });

  const sections = [
    { id: 'default', title: 'Default group', data: sectionsMap.default },
    ...safeGroups.map(g => ({ id: g.id, title: g.name, data: sectionsMap[g.id] }))
  ].filter(s => s.data.length > 0 || s.id !== 'default'); // Keep custom empty groups but hide empty default

  const onlineCount = safeDevices.filter((d) => d.status === '1' || d.posType === 'GPS' || isRecent(d.gpsTime || d.sysTime)).length;

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

  const s = styles(C, theme);

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
        devices={safeDevices}
        selectedImei={selectedDevice?.imei ?? null}
        onMarkerTap={(imei) => {
          const dev = safeDevices.find((d) => d.imei === imei);
          selectDevice(dev ?? null);
        }}
        theme={theme || 'dark'}
        style={s.map}
      />

      {/* ── Top status bar overlay ── */}
      <View style={s.topBar} pointerEvents="box-none">
        <View style={s.statsRow}>
          <View style={s.statChip}>
            <View style={[s.dotSmall, { backgroundColor: C.online }]} />
            <Text style={s.statText}>{onlineCount} {t('dashboard.online') || 'Online'}</Text>
          </View>
          <View style={s.statChip}>
            <View style={[s.dotSmall, { backgroundColor: C.offline }]} />
            <Text style={s.statText}>{devices.length - onlineCount} {t('dashboard.offline') || 'Offline'}</Text>
          </View>
          {loading && <ActivityIndicator size="small" color={C.accent} style={{ marginStart: 8 }} />}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Language toggle */}
          <TouchableOpacity style={s.themeBtn} onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}>
            <Text style={[s.themeBtnText, { fontSize: 12, fontWeight: '700', color: C.textPrimary }]}>{language === 'en' ? 'عربي' : 'EN'}</Text>
          </TouchableOpacity>

          {/* Theme toggle */}
          <TouchableOpacity style={s.themeBtn} onPress={toggleTheme}>
            <Feather name={theme === 'dark' ? 'sun' : 'moon'} size={18} color={C.textPrimary} />
          </TouchableOpacity>

          {/* Logout button */}
          <TouchableOpacity style={s.themeBtn} onPress={handleLogout}>
            <Feather name="log-out" size={18} color={C.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Device panel (spring bottom sheet style) ── */}
      <Animated.View style={[s.panel, animatedPanelStyle, { bottom: panelBottom }]}>
        {/* Drag / Pull Handle Area */}
        <Pressable style={s.panelHandle} onPress={() => setPanelVisible((v) => !v)}>
          <View style={s.handleBar} />
          <Text style={s.panelToggleText}>
            {panelVisible ? '▼ ' + t('map.hideDevices', 'Hide Device List') : '▲ ' + t('map.showDevices', 'Show Device List')}
          </Text>
        </Pressable>

        {/* Search */}
        <View style={s.searchRow}>
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t('common.search') || 'Search devices...'}
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
                {selectedDevice.lat && (
                  <Text style={s.selectedMeta}>
                    <Feather name="map-pin" size={12} color={C.textSecondary} /> {selectedDevice.lat?.toFixed(5)}, {selectedDevice.lng?.toFixed(5)}
                  </Text>
                )}
                {selectedDevice.batteryPowerVal && (
                  <Text style={s.selectedMeta}><Feather name="battery" size={12} color={C.textSecondary} /> {selectedDevice.batteryPowerVal === 'N/A' ? 'N/A' : `${selectedDevice.batteryPowerVal}%`}</Text>
                )}
                <Text style={s.selectedMeta}><Feather name="clock" size={12} color={C.textSecondary} /> {formatGimiTime(selectedDevice.sysTime || selectedDevice.gpsTime)}</Text>
                
                <TouchableOpacity
                  style={{
                    backgroundColor: ringingImei === selectedDevice.imei ? `${C.accent}10` : `${C.accent}20`,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    marginStart: 8,
                    borderWidth: 1,
                    borderColor: `${C.accent}40`
                  }}
                  onPress={() => handleRingTag(selectedDevice)}
                  disabled={ringingImei === selectedDevice.imei}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  {ringingImei === selectedDevice.imei ? (
                    <ActivityIndicator size="small" color={C.accent} />
                  ) : (
                    <Feather name="bell" size={13} color={C.accent} />
                  )}
                  <Text style={{ color: C.accent, fontSize: 13, fontWeight: '700' }}>
                    {t('map.ringTag')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[s.clearBtn, { width: 32, height: 32, borderRadius: 16, marginStart: 8 }]} 
                  onPress={() => selectDevice(null)}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  <Text style={s.clearBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}

        {/* Device list with bottom padding container to clear the floating tabs */}
        <SectionList
          sections={sections}
          keyExtractor={(d) => d.imei}
          renderItem={({ item, section }) => {
            if (expandedGroups[section.id] === false) return null;
            return renderDevice({ item });
          }}
          renderSectionHeader={renderSectionHeader}
          style={s.list}
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={[s.emptyText, { color: C.textMuted }]}>
              {loading ? 'Loading devices...' : 'No devices found'}
            </Text>
          }
        />
      </Animated.View>

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
const styles = (C: any, theme: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgPrimary },
  map: { flex: 1 },

  topBar: {
    position: 'absolute', top: Platform.OS === 'ios' ? 44 : 16, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    zIndex: 100,
  },
  statsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.bgCard,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', 
    shadowOpacity: theme === 'dark' ? 0.3 : 0.1, 
    shadowRadius: 10, 
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dotSmall: { width: 8, height: 8, borderRadius: 4 },
  statText: { fontSize: 11, fontWeight: '700', color: C.textPrimary },
  themeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', 
    shadowOpacity: theme === 'dark' ? 0.3 : 0.1, 
    shadowRadius: 10, 
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  themeBtnText: { fontSize: 18 },

  panel: {
    position: 'absolute', bottom: 88, left: 0, right: 0,
    backgroundColor: C.bgCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    borderTopWidth: 1, borderColor: C.border,
    height: 270,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: theme === 'dark' ? 0.35 : 0.12,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 90,
  },
  panelHandle: {
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    width: '100%',
  },
  handleBar: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.textMuted,
    opacity: 0.5,
    marginBottom: 4,
  },
  panelToggleText: { fontSize: 11, fontWeight: '700', color: C.accent, letterSpacing: 0.5 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10,
  },
  searchInput: {
    flex: 1, backgroundColor: C.bgElevated,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 13, color: C.textPrimary, borderWidth: 1, borderColor: C.border,
  },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center',
  },
  refreshBtnText: { fontSize: 16, color: C.accent, fontWeight: '600' },
  errorText: { fontSize: 12, color: C.danger, paddingHorizontal: 16, marginBottom: 4 },
  list: { flex: 1 },

  deviceItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderColor: C.border, gap: 12,
  },
  deviceItemSelected: { backgroundColor: C.accentDim },
  statusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 13, fontWeight: '700', color: C.textPrimary },
  deviceImei: { fontSize: 10, color: C.textMuted, marginTop: 1 },
  deviceMeta: { fontSize: 11, color: C.textSecondary, marginTop: 3 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  selectedCard: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: C.bgElevated, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  selectedCardInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 14,
  },
  selectedName: { fontSize: 13, fontWeight: '800', color: C.textPrimary },
  selectedMeta: { fontSize: 12, color: C.textSecondary },
  clearBtn: {
    marginStart: 8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  clearBtnText: { color: C.danger, fontSize: 13, fontWeight: '700' },
  emptyText: { textAlign: 'center', marginTop: 24, fontSize: 13 },

  // Grouping Styles
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.bgSecondary, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderColor: C.border,
  },
  sectionHeaderText: { fontSize: 13, fontWeight: '700', color: C.textPrimary },
  deleteGroupText: { fontSize: 14, color: C.textMuted, paddingHorizontal: 8 },
  optionsBtn: { padding: 8, marginEnd: 4, alignItems: 'center', justifyContent: 'center' },
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
  modalTitle: { fontSize: 15, fontWeight: '700', color: C.textPrimary, marginBottom: 16 },
  modalInput: {
    backgroundColor: C.bgElevated, borderRadius: 12, padding: 12,
    fontSize: 14, color: C.textPrimary, borderWidth: 1, borderColor: C.border, marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtnCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  modalBtnSubmit: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
  modalBtnTextCancel: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  modalBtnTextSubmit: { fontSize: 14, fontWeight: '700', color: '#fff' },
  optionItem: { paddingVertical: 16, borderBottomWidth: 1, borderColor: C.border },
  optionText: { fontSize: 14, color: C.textPrimary },
});
