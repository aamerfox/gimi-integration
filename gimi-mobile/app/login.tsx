import { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, ScrollView, Alert, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import CryptoJS from 'crypto-js';
import { gimiService } from '@/services/gimi';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import { useTranslation } from 'react-i18next';
import COLORS from '@/constants/Colors';
import { Feather } from '@expo/vector-icons';
import { APP_KEY } from '@/config/constants';

interface LoginResult {
    accessToken?: string;
    access_token?: string;
    refreshToken?: string;
    refresh_token?: string;
    expiresIn?: number;
    expires_in?: number;
}
interface LoginApiResponse { result?: LoginResult; }

export default function LoginScreen() {
    const router = useRouter();
    const { setAuth } = useAuthStore();
    const { theme } = useThemeStore();
    const { t } = useTranslation();
    const C = COLORS[theme];

    const [account, setAccount] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async () => {
        if (!account.trim() || !password.trim()) {
            setError(t('auth.loginError'));
            return;
        }
        setLoading(true);
        setError('');
        try {
            const isMd5 = /^[a-f0-9]{32}$/i.test(password);
            const passwordMd5 = isMd5 ? password.toLowerCase() : CryptoJS.MD5(password).toString();
            const res = await gimiService.login(account.trim(), passwordMd5) as LoginApiResponse;
            if (res?.result) {
                const result = res.result;
                const token = result.accessToken || result.access_token;
                const refresh = result.refreshToken || result.refresh_token;
                const expires = result.expiresIn || result.expires_in || 7200;

                if (token) {
                    setAuth({
                        accessToken: token,
                        refreshToken: refresh || '',
                        expiresIn: Number(expires),
                        userId: account.trim(),
                        appKey: APP_KEY,
                    });
                    router.replace('/(tabs)');
                } else {
                    setError(t('auth.loginError'));
                }
            } else {
                setError(t('auth.loginError'));
            }
        } catch (err: unknown) {
            // Map raw JIMI/TrackSolid error codes to user-friendly messages
            let msg = t('auth.loginError');
            if (err instanceof Error) {
                const raw = err.message;
                if (
                    raw.includes('1001') ||
                    raw.toLowerCase().includes('appkey') ||
                    raw.includes('缺少') // Chinese: "missing parameter"
                ) {
                    msg = t('auth.invalidCredentials') || 'Invalid account or password. Please try again.';
                } else if (
                    raw.includes('1002') ||
                    raw.includes('非法') // Chinese: "illegal user"
                ) {
                    msg = t('auth.accountNotAuthorized') || 'Account not authorized. Contact your administrator.';
                } else if (
                    raw.toLowerCase().includes('network') ||
                    raw.toLowerCase().includes('timeout') ||
                    raw.toLowerCase().includes('connect')
                ) {
                    msg = t('auth.networkError') || 'Cannot connect to server. Check your internet connection.';
                } else if (raw.length > 0) {
                    msg = raw; // Use the error message directly (e.g., our custom "Invalid account or password")
                }
            }
            setError(msg);
            if (Platform.OS !== 'web') Alert.alert(t('common.error'), msg);
        } finally {
            setLoading(false);
        }
    };

    const s = styles(C);

    return (
        <KeyboardAvoidingView
            style={s.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
                {/* Branding */}
                <View style={s.brand}>
                    <Image
                        source={require('../assets/images/icon.png')}
                        style={[{ width: 80, height: 80, marginBottom: 12 }, theme === 'dark' && { tintColor: '#ffffff' }]}
                        resizeMode="contain"
                    />
                    <Image
                        source={require('../assets/images/logo-wordmark.png')}
                        style={[{ width: 180, height: 48 }, theme === 'dark' && { tintColor: '#ffffff' }]}
                        resizeMode="contain"
                    />
                </View>

                {/* Card */}
                <View style={s.card}>
                    <Text style={s.cardTitle}>{t('auth.login')}</Text>
                    <Text style={s.cardSubtitle}>{t('auth.subtitle')}</Text>

                    {error ? (
                        <View style={s.errorBox}>
                            <Text style={s.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <View style={s.field}>
                        <Text style={s.label}>{t('auth.accountId').toUpperCase()}</Text>
                        <TextInput
                            style={s.input}
                            value={account}
                            onChangeText={setAccount}
                            placeholder={t('auth.accountIdPlaceholder')}
                            placeholderTextColor={C.textMuted}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={s.field}>
                        <Text style={s.label}>{t('auth.password').toUpperCase()}</Text>
                        <TextInput
                            style={s.input}
                            value={password}
                            onChangeText={setPassword}
                            placeholder={t('auth.password')}
                            placeholderTextColor={C.textMuted}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <TouchableOpacity
                        style={[s.button, loading && s.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={s.buttonText}>{t('auth.signIn')} →</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <Text style={s.footer}>
                    Powered by trace+
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const styles = (C: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bgPrimary },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    brand: { alignItems: 'center', marginBottom: 36 },
    logoBox: {
        width: 72, height: 72, borderRadius: 20,
        backgroundColor: C.accent,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
        shadowColor: C.accent, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    logoText: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1 },
    title: { fontSize: 26, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
    subtitle: { fontSize: 13, color: C.textMuted, marginTop: 4 },
    card: {
        backgroundColor: C.bgCard,
        borderRadius: 20, padding: 24,
        borderWidth: 1, borderColor: C.border,
        shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
        elevation: 6,
    },
    cardTitle: { fontSize: 20, fontWeight: '700', color: C.textPrimary, marginBottom: 4 },
    cardSubtitle: { fontSize: 13, color: C.textMuted, marginBottom: 20 },
    errorBox: {
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderRadius: 10, padding: 12, marginBottom: 16,
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    },
    errorText: { color: C.danger, fontSize: 13 },
    field: { marginBottom: 16 },
    label: { fontSize: 10, fontWeight: '700', color: C.textMuted, letterSpacing: 1, marginBottom: 6 },
    input: {
        backgroundColor: C.bgElevated,
        borderWidth: 1, borderColor: C.border,
        borderRadius: 12, padding: 14,
        fontSize: 15, color: C.textPrimary,
    },
    button: {
        backgroundColor: C.accent,
        borderRadius: 12, padding: 16,
        alignItems: 'center', marginTop: 8,
        shadowColor: C.accent, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    footer: { textAlign: 'center', color: C.textMuted, fontSize: 11, marginTop: 24 },
});
