import { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, Alert, ScrollView, Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuthStore } from '@/store/auth';
import { useDeviceStore, Device } from '@/store/devices';
import { useThemeStore } from '@/store/theme';
import { useShareLinkStore, ShareLink } from '@/store/shareLinks';
import { createShareUrl, SHARE_DURATIONS } from '@/services/share';
import { useTranslation } from 'react-i18next';
import COLORS from '@/constants/Colors';
import { Feather } from '@expo/vector-icons';

function getBaseUrl(): string {
    // Provide the live production server URL
    const PRODUCTION_URL = 'http://84.8.118.119';

    if (typeof window !== 'undefined' && window.location?.origin) {
        // Only use the window origin if it's not localhost/local IP
        const origin = window.location.origin;
        if (!origin.includes('localhost') && !origin.includes('127.0.0.1') && !origin.includes('192.168.')) {
            return origin;
        }
    }

    // Fallback to the live production server (e.g., when generating from the Native Android app or local dev)
    return PRODUCTION_URL;
}

function formatExpiry(exp: number): string {
    const d = new Date(exp * 1000);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isExpired(exp: number): boolean {
    return Date.now() / 1000 > exp;
}

export default function ShareScreen() {
    const { accessToken } = useAuthStore();
    const { devices } = useDeviceStore();
    const { theme } = useThemeStore();
    const { links, addLink, removeLink, clearExpired } = useShareLinkStore();
    const { t } = useTranslation();
    const C = COLORS[theme];

    const [selectedImei, setSelectedImei] = useState('');
    const [selectedDuration, setSelectedDuration] = useState(0); // index into SHARE_DURATIONS
    const [generating, setGenerating] = useState(false);
    const [justCopied, setJustCopied] = useState<string | null>(null);

    // Auto-select first device
    useEffect(() => {
        if (devices.length > 0 && !selectedImei) setSelectedImei(devices[0].imei);
    }, [devices]);

    // Clean expired links on mount
    useEffect(() => { clearExpired(); }, []);

    const handleGenerate = async () => {
        if (!selectedImei || !accessToken) return;
        setGenerating(true);
        try {
            const device = devices.find((d: Device) => d.imei === selectedImei);
            const duration = SHARE_DURATIONS[selectedDuration];
            const exp = Math.floor(Date.now() / 1000) + duration.seconds;
            const url = createShareUrl(getBaseUrl(), {
                imei: selectedImei,
                name: device?.deviceName ?? selectedImei,
                exp,
                tok: accessToken,
            });
            const link: ShareLink = {
                id: `share-${Date.now()}`,
                imei: selectedImei,
                deviceName: device?.deviceName ?? selectedImei,
                url,
                exp,
                createdAt: new Date().toISOString(),
            };
            addLink(link);

            // Native share sheet / clipboard
            if (Platform.OS === 'web') {
                await navigator.clipboard.writeText(url).catch(() => { });
                Alert.alert('Link Created', 'Share link copied to clipboard!\n\n' + url);
            } else {
                await Share.share({ message: url, title: `Track ${device?.deviceName}` });
            }
        } finally {
            setGenerating(false);
        }
    };

    const handleCopy = async (url: string, id: string) => {
        if (Platform.OS === 'web') {
            await navigator.clipboard.writeText(url).catch(() => { });
        } else {
            await Clipboard.setStringAsync(url);
        }
        setJustCopied(id);
        setTimeout(() => setJustCopied(null), 2000);
    };

    const handleShare = async (link: ShareLink) => {
        if (Platform.OS === 'web') {
            await navigator.clipboard.writeText(link.url).catch(() => { });
            Alert.alert('Copied', 'Link copied to clipboard');
        } else {
            await Share.share({ message: link.url, title: `Track ${link.deviceName}` });
        }
    };

    const s = styles(C);

    const renderLink = ({ item }: { item: ShareLink }) => {
        const expired = isExpired(item.exp);
        return (
            <View style={[s.linkItem, expired && s.linkItemExpired]}>
                <View style={s.linkHeader}>
                    <View style={[s.linkIcon, { backgroundColor: expired ? 'rgba(107,114,128,0.15)' : `${C.accent}15` }]}>
                        <Feather name={expired ? 'lock' : 'link'} size={22} color={expired ? C.textMuted : C.accent} />
                    </View>
                    <View style={s.linkInfo}>
                        <Text style={[s.linkDevice, { color: expired ? C.textMuted : C.textPrimary }]}>
                            {item.deviceName}
                        </Text>
                        <Text style={[s.linkExpiry, { color: expired ? C.danger : C.online }]}>
                            {expired ? 'Expired' : `Expires ${formatExpiry(item.exp)}`}
                        </Text>
                        <Text style={s.linkCreated}>
                            Created {new Date(item.createdAt).toLocaleDateString()}
                        </Text>
                    </View>
                    <TouchableOpacity style={s.deleteBtn} onPress={() => removeLink(item.id)}>
                        <Text style={s.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                </View>

                {!expired && (
                    <View style={s.linkActions}>
                        <TouchableOpacity
                            style={[s.actionBtn, justCopied === item.id && s.actionBtnSuccess]}
                            onPress={() => handleCopy(item.url, item.id)}
                        >
                            <Text style={[s.actionBtnText, { color: C.accent }]}>
                                {justCopied === item.id ? <><Feather name="check" size={12} color={C.accent} /> {t('share.copied')}</> : <><Feather name="copy" size={12} color={C.accent} /> Copy Link</>}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={s.actionBtnShare}
                            onPress={() => handleShare(item)}
                        >
                            <Text style={[s.actionBtnText, { color: C.accent }]}><Feather name="share-2" size={12} color={C.accent} /> Share</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={s.container}>
            {/* ── Generate form */}
            <View style={s.generateCard}>
                <Text style={s.cardTitle}><Feather name="link" size={16} /> {t('share.createLink')}</Text>
                <Text style={s.cardSub}>Anyone with the link can view live location — no login required</Text>

                <Text style={s.label}>{t('share.device').toUpperCase()}</Text>
                <View style={s.pickerWrap}>
                    {Platform.OS === 'web' ? (
                        // Native HTML select — Expo Picker doesn't render on web
                        <select
                            value={selectedImei}
                            onChange={(e) => setSelectedImei(e.target.value)}
                            style={{
                                width: '100%', height: 44, background: C.bgElevated,
                                color: C.textPrimary, border: 'none', outline: 'none',
                                borderRadius: 10, paddingLeft: 12, fontSize: 14,
                                cursor: 'pointer',
                            } as React.CSSProperties}
                        >
                            {devices.map((d: Device) => (
                                <option key={d.imei} value={d.imei}>{d.deviceName}</option>
                            ))}
                        </select>
                    ) : (
                        <Picker
                            selectedValue={selectedImei}
                            onValueChange={(v) => setSelectedImei(v)}
                            style={s.picker}
                            dropdownIconColor={C.textMuted}
                        >
                            {devices.map((d: Device) => (
                                <Picker.Item key={d.imei} label={d.deviceName} value={d.imei} color={C.textPrimary} />
                            ))}
                        </Picker>
                    )}
                </View>

                <Text style={s.label}>{t('share.expiresIn').toUpperCase()}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.durationRow}>
                    {SHARE_DURATIONS.map((d, i) => (
                        <TouchableOpacity
                            key={d.label}
                            style={[s.durationBtn, selectedDuration === i && s.durationBtnActive]}
                            onPress={() => setSelectedDuration(i)}
                        >
                            <Text style={[s.durationText, selectedDuration === i && { color: C.accent }]}>
                                {d.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <TouchableOpacity
                    style={[s.generateBtn, (!selectedImei || generating) && s.generateBtnDisabled]}
                    onPress={handleGenerate}
                    disabled={!selectedImei || generating}
                >
                    {generating
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={s.generateBtnText}><Feather name="zap" size={14} color="#fff" /> {t('share.generate')}</Text>
                    }
                </TouchableOpacity>

                <View style={s.securityNote}>
                    <Text style={s.securityNoteText}>
                        <Feather name="shield" size={12} /> Links are cryptographically signed (HMAC-SHA256) and automatically expire.
                    </Text>
                </View>
            </View>

            {/* ── Active links */}
            <View style={s.linksSection}>
                <View style={s.linksSectionHeader}>
                    <Text style={s.linksSectionTitle}>
                        {t('share.activeLinks')} ({links.filter(l => !isExpired(l.exp)).length})
                    </Text>
                    <TouchableOpacity onPress={clearExpired}>
                        <Text style={[s.clearExpired, { color: C.textMuted }]}>{t('share.clearExpired')}</Text>
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={links}
                    keyExtractor={l => l.id}
                    renderItem={renderLink}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 90 }}
                    ListEmptyComponent={
                        <View style={s.emptyState}>
                            <Feather name="link" size={48} color={C.textMuted} style={{ marginBottom: 12 }} />
                            <Text style={[s.emptyText, { color: C.textMuted }]}>
                                {t('share.noLinks')}
                            </Text>
                        </View>
                    }
                />
            </View>
        </View>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const styles = (C: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bgPrimary },

    generateCard: {
        backgroundColor: C.bgSecondary,
        borderBottomWidth: 1, borderColor: C.border,
        padding: 16,
    },
    cardTitle: { fontSize: 18, fontWeight: '800', color: C.textPrimary, marginBottom: 4 },
    cardSub: { fontSize: 12, color: C.textMuted, marginBottom: 16, lineHeight: 18 },

    label: { fontSize: 10, fontWeight: '700', color: C.textMuted, letterSpacing: 1, marginBottom: 6, marginTop: 12 },

    pickerWrap: {
        backgroundColor: C.bgElevated, borderRadius: 10,
        borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 2,
        height: 52, justifyContent: 'center',
    },
    picker: {
        color: C.textPrimary,
        height: Platform.OS === 'android' ? 52 : 44,
        backgroundColor: 'transparent',
        borderWidth: 0,
    },

    durationRow: { flexDirection: 'row', marginBottom: 2 },
    durationBtn: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginEnd: 8,
        backgroundColor: C.bgElevated, borderWidth: 1, borderColor: C.border,
    },
    durationBtnActive: { backgroundColor: `${C.accent}15`, borderColor: C.accent },
    durationText: { fontSize: 13, fontWeight: '600', color: C.textMuted },

    generateBtn: {
        backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14,
        alignItems: 'center', marginTop: 16,
    },
    generateBtnDisabled: { opacity: 0.5 },
    generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

    securityNote: {
        marginTop: 12, padding: 10, borderRadius: 8,
        backgroundColor: 'rgba(0,212,170,0.06)',
        borderWidth: 1, borderColor: 'rgba(0,212,170,0.2)',
    },
    securityNoteText: { fontSize: 11, color: C.textMuted, lineHeight: 16 },

    linksSection: { flex: 1, padding: 12 },
    linksSectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
    },
    linksSectionTitle: { fontSize: 14, fontWeight: '700', color: C.textPrimary },
    clearExpired: { fontSize: 12 },

    linkItem: {
        backgroundColor: C.bgSecondary, borderRadius: 14, marginBottom: 10,
        borderWidth: 1, borderColor: C.border, overflow: 'hidden',
    },
    linkItemExpired: { opacity: 0.6 },
    linkHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
    linkIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    linkInfo: { flex: 1 },
    linkDevice: { fontSize: 14, fontWeight: '700' },
    linkExpiry: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    linkCreated: { fontSize: 11, color: '#64748b', marginTop: 1 },

    deleteBtn: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center',
    },
    deleteBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },

    linkActions: {
        flexDirection: 'row', borderTopWidth: 1, borderColor: C.border,
    },
    actionBtn: {
        flex: 1, paddingVertical: 10, alignItems: 'center',
        borderRightWidth: 1, borderColor: C.border,
    },
    actionBtnSuccess: { backgroundColor: 'rgba(0,212,170,0.08)' },
    actionBtnShare: { flex: 1, paddingVertical: 10, alignItems: 'center' },
    actionBtnText: { fontSize: 13, fontWeight: '600' },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
    emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
