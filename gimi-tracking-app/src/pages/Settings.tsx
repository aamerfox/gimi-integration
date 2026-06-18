import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun, Bell, Shield, Palette, ChevronRight, ArrowLeft, UserPlus, FileText, Trash2, User, CheckCircle2, AlertCircle, Edit } from 'lucide-react';
import { useThemeStore } from '@/store/theme';
import { useLanguageStore } from '@/store/languageStore';
import { useSimulationStore } from '@/store/simulation';
import type { ChildAccount } from '@/store/simulation';
import { useAuthStore } from '@/store/auth';
import { gimiService } from '@/services/gimi';
import MD5 from 'crypto-js/md5';

const Settings = () => {
    const { t } = useTranslation();
    const { theme, toggleTheme } = useThemeStore();
    const { language, toggleLanguage } = useLanguageStore();

    // Permissions sub-view state
    const [showPermissions, setShowPermissions] = useState(false);

    // Simulation store hooks
    const { 
        isSimulatedOperator, 
        simulatedChildAccounts, 
        simulatedLogs, 
        setIsSimulatedOperator, 
        addChildAccount, 
        deleteChildAccount,
        updateChildAccount,
        addLog, 
        clearLogs 
    } = useSimulationStore();
    
    const { accessToken, userId } = useAuthStore();

    // Form state for creating/editing sub-accounts
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
    const [accountId, setAccountId] = useState('');
    const [nickName, setNickName] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [telephone, setTelephone] = useState('');
    const [deviceImei, setDeviceImei] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [childAccounts, setChildAccounts] = useState<ChildAccount[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(false);

    const fetchChildAccounts = async () => {
        if (!accessToken || !userId) {
            setChildAccounts(simulatedChildAccounts);
            return;
        }

        setLoadingAccounts(true);
        try {
            const res = await gimiService.getChildAccounts(accessToken, userId) as any;
            if (res && res.code === 0 && Array.isArray(res.result)) {
                const mapped: ChildAccount[] = res.result.map((item: any) => ({
                    accountId: item.account || item.userId || '',
                    nickName: item.name || item.account || '',
                    email: item.email || '',
                    telephone: item.phone || undefined,
                    roleName: item.type === 9 ? 'End User (Read-Only)' : `User (Type ${item.type})`,
                }));
                // Merge local custom accounts that are not in Jimi
                const localOnly = simulatedChildAccounts.filter(
                    local => !mapped.some(apiAcc => apiAcc.accountId.toLowerCase() === local.accountId.toLowerCase())
                );
                setChildAccounts([...localOnly, ...mapped]);
            } else {
                console.warn('Jimi API getChildAccounts returned code != 0 or invalid format:', res);
                setChildAccounts(simulatedChildAccounts);
            }
        } catch (err) {
            console.error('Failed to fetch child accounts from Jimi API:', err);
            setChildAccounts(simulatedChildAccounts);
        } finally {
            setLoadingAccounts(false);
        }
    };

    useEffect(() => {
        if (showPermissions) {
            fetchChildAccounts();
        }
    }, [showPermissions, accessToken, userId, simulatedChildAccounts]);

    useEffect(() => {
        // Self-heal: ensure the default hertz account is present in local storage
        const hasHertz = simulatedChildAccounts.some(acc => acc.accountId.toLowerCase() === 'hertz');
        if (!hasHertz) {
            addChildAccount({
                accountId: 'hertz',
                nickName: 'Hertz OCI Sub-Account',
                email: 'hertz@saudiex.com',
                telephone: '0500000000',
                roleName: 'End User (Read-Only)',
                passwordMd5: '80fc588ba13f3af3d64be60ddfd386d8', // hertz08642
                deviceImei: '781950640051748',
            });
        }
    }, [simulatedChildAccounts, addChildAccount]);

    const handleCreateSubAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        if (!accountId || !nickName || !email) {
            setErrorMsg('Please fill in all required fields.');
            return;
        }

        if (!editingAccountId && !password) {
            setErrorMsg('Password is required for new accounts.');
            return;
        }

        if (isSimulatedOperator) {
            setErrorMsg('Permission Denied: Sub-accounts cannot modify other child accounts.');
            return;
        }

        const currentUserId = userId || 'admin';
        try {
            if (editingAccountId) {
                // Editing existing custom account (local)
                const existing = simulatedChildAccounts.find(acc => acc.accountId === editingAccountId);
                const updatedAccount: ChildAccount = {
                    accountId: editingAccountId,
                    nickName,
                    email,
                    telephone: telephone || undefined,
                    roleName: 'End User (Read-Only)',
                    passwordMd5: password ? MD5(password).toString() : existing?.passwordMd5,
                    deviceImei: deviceImei || undefined,
                };
                updateChildAccount(updatedAccount);
                addLog('Edit Sub-Account', currentUserId, 'Success', `Updated details for: ${editingAccountId}`);
                setSuccessMsg(`Successfully updated child account "${editingAccountId}"!`);
            } else {
                // Creating new account
                if (accessToken && !deviceImei) {
                    // Call the TrackSolid Pro Open API
                    const passwordMd5 = MD5(password).toString();
                    const res = await gimiService.createChildAccount(
                        accessToken,
                        accountId,
                        nickName,
                        2, // End User role type is 2
                        passwordMd5, // Hash password as required by API
                        email,
                        telephone || undefined
                    ) as any;

                    if (res && res.code !== 0) {
                        throw new Error(res.message || `Error code ${res.code}`);
                    }
                }
                
                // Add account locally for interactive simulation
                const newAccount: ChildAccount = {
                    accountId,
                    nickName,
                    email,
                    telephone: telephone || undefined,
                    roleName: 'End User (Read-Only)',
                    passwordMd5: MD5(password).toString(),
                    deviceImei: deviceImei || undefined,
                };
                addChildAccount(newAccount);
                addLog('Create Sub-Account', currentUserId, 'Success', `Created sub-account: ${accountId}`);
                setSuccessMsg(`Successfully created child account "${accountId}"!`);
            }
            
            // Reset form
            setAccountId('');
            setNickName('');
            setPassword('');
            setEmail('');
            setTelephone('');
            setDeviceImei('');
            setShowAddForm(false);
            setEditingAccountId(null);

            // Refresh the sub-accounts list
            await fetchChildAccounts();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'API Error';
            const actionLabel = editingAccountId ? 'Edit Sub-Account' : 'Create Sub-Account';
            addLog(actionLabel, currentUserId, 'Failed', `Failed to process: ${accountId} (API Status: ${msg})`);
            setErrorMsg(language === 'ar' 
                ? `فشل حفظ الحساب الفرعي: ${msg}.`
                : `Failed to save sub-account: ${msg}.`);
        }
    };

    const handleDeleteSubAccount = (accId: string) => {
        if (isSimulatedOperator) {
            alert(language === 'ar' ? 'خطأ: لا يملك هذا الحساب صلاحية حذف الحسابات الفرعية.' : 'Error: Sub-accounts cannot delete child accounts.');
            return;
        }
        const confirmMsg = language === 'ar' 
            ? `هل أنت متأكد أنك تريد حذف الحساب الفرعي "${accId}"؟`
            : `Are you sure you want to delete sub-account "${accId}"?`;
        if (window.confirm(confirmMsg)) {
            deleteChildAccount(accId);
            addLog('Delete Sub-Account', userId || 'admin', 'Success', `Deleted custom account: ${accId}`);
            setSuccessMsg(language === 'ar' ? `تم حذف الحساب "${accId}" بنجاح!` : `Successfully deleted account "${accId}"!`);
            fetchChildAccounts();
        }
    };

    const handleStartEdit = (account: ChildAccount) => {
        if (isSimulatedOperator) {
            alert(language === 'ar' ? 'خطأ: لا يملك هذا الحساب صلاحية تعديل الحسابات الفرعية.' : 'Error: Sub-accounts cannot modify child accounts.');
            return;
        }
        setEditingAccountId(account.accountId);
        setAccountId(account.accountId);
        setNickName(account.nickName);
        setPassword('');
        setEmail(account.email);
        setTelephone(account.telephone || '');
        setDeviceImei(account.deviceImei || '');
        setShowAddForm(true);
    };

    // Render Sub-View if active
    if (showPermissions) {
        return (
            <div style={{ padding: '24px', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                        onClick={() => setShowPermissions(false)}
                        className="sx-btn-icon"
                        style={{ 
                            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer'
                        }}
                    >
                        <ArrowLeft size={18} style={{ color: 'var(--text-secondary)' }} className="rtl-flip" />
                    </button>
                    <div style={{ textAlign: 'start' }}>
                        <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {language === 'ar' ? 'المستخدمون والصلاحيات' : 'Users & Permissions'}
                        </h1>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {language === 'ar' ? 'إدارة أدوار الحسابات وسجلات الأنشطة' : 'Manage account roles and activity logs'}
                        </p>
                    </div>
                </div>

                {/* Simulated Role Status Card */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ textAlign: 'start' }}>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Shield size={18} style={{ color: isSimulatedOperator ? 'var(--warning)' : 'var(--accent)' }} />
                            {language === 'ar' ? 'محاكاة دور المستخدم' : 'User Role Simulation'}
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {language === 'ar' 
                                ? 'تبديل دورك بين مدير الحساب والمدير الفرعي (مشغل) لاختبار قيود الصلاحيات.' 
                                : 'Toggle your role to test permission constraints in real-time.'}
                        </p>
                    </div>

                    <div style={{
                        padding: '14px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        <div style={{ textAlign: 'start' }}>
                            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                {language === 'ar' ? 'الدور النشط حالياً: ' : 'Active Role: '}
                                <span style={{
                                    fontWeight: 700, fontSize: '11px', padding: '2px 8px', borderRadius: '100px',
                                    background: isSimulatedOperator ? 'rgba(245, 158, 11, 0.12)' : 'var(--accent-dim)',
                                    color: isSimulatedOperator ? 'var(--warning)' : 'var(--accent)',
                                    border: '1px solid', borderColor: isSimulatedOperator ? 'rgba(245, 158, 11, 0.2)' : 'var(--border-accent)',
                                    marginInlineStart: '6px'
                                }}>
                                    {isSimulatedOperator 
                                        ? (language === 'ar' ? 'مشغل فرعي (قراءة فقط)' : 'Sub-Account Operator (Read-Only)') 
                                        : (language === 'ar' ? 'مدير الحساب الرئيسي' : 'Main Admin Account')
                                    }
                                </span>
                            </p>
                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                                {isSimulatedOperator 
                                    ? (language === 'ar' ? '✖ يُمنع تغيير أسماء الأجهزة أو إضافة حسابات فرعية' : '✖ Restricted: Device renaming and sub-account creation are blocked.')
                                    : (language === 'ar' ? '✔ متاح له جميع الصلاحيات' : '✔ All actions and modifications allowed.')
                                }
                            </p>
                        </div>
                        
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only" 
                                checked={isSimulatedOperator} 
                                onChange={(e) => {
                                    setIsSimulatedOperator(e.target.checked);
                                    addLog(
                                        'Role Change', 
                                        userId || 'admin', 
                                        'Success', 
                                        `Switched perspective to ${e.target.checked ? 'Sub-Account Operator' : 'Main Admin'}`
                                    );
                                }} 
                            />
                            <div 
                                style={{
                                    width: '38px',
                                    height: '20px',
                                    borderRadius: '10px',
                                    background: isSimulatedOperator ? 'var(--warning)' : 'var(--border)',
                                    position: 'relative',
                                    transition: 'background 0.2s',
                                    flexShrink: 0
                                }}
                            >
                                <span style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: isSimulatedOperator ? '20px' : '2px',
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    background: '#fff',
                                    transition: 'left 0.2s'
                                }} />
                            </div>
                        </label>
                    </div>
                </div>

                {/* Sub-Accounts Management */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ textAlign: 'start' }}>
                            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {language === 'ar' ? 'الحسابات الفرعية' : 'Sub-Accounts'}
                            </h2>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {language === 'ar' ? 'الحسابات الفرعية المنشأة تحت حسابك على TrackSolid Pro' : 'Child accounts created under this main account in TrackSolid Pro'}
                            </p>
                        </div>
                        <button 
                            onClick={() => {
                                if (isSimulatedOperator) {
                                    alert(language === 'ar' ? 'خطأ: لا يملك هذا الحساب صلاحية إضافة مستخدمين فرعيين.' : 'Error: Sub-accounts cannot create child accounts.');
                                    return;
                                }
                                setEditingAccountId(null);
                                setAccountId('');
                                setNickName('');
                                setPassword('');
                                setEmail('');
                                setTelephone('');
                                setDeviceImei('');
                                setShowAddForm(!showAddForm);
                            }}
                            className="sx-btn sx-btn-ghost sx-btn-sm"
                            style={{ color: 'var(--accent)', borderColor: 'var(--border-accent)', gap: '6px' }}
                        >
                            <UserPlus size={14} />
                            {language === 'ar' ? 'إضافة حساب' : 'Add Account'}
                        </button>
                    </div>

                    {/* Create/Edit Child Form */}
                    {showAddForm && (
                        <form onSubmit={handleCreateSubAccount} style={{
                            padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '12px'
                        }}>
                            <h3 style={{ fontSize: '11px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, textAlign: 'start' }}>
                                {editingAccountId 
                                    ? (language === 'ar' ? `تعديل الحساب الفرعي: ${editingAccountId}` : `Edit Sub-Account: ${editingAccountId}`)
                                    : (language === 'ar' ? 'بيانات الحساب الفرعي الجديد' : 'New Sub-Account Details')
                                }
                            </h3>
                            
                            {errorMsg && (
                                <div style={{
                                    padding: '10px 12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)',
                                    fontSize: '12px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '8px'
                                }}>
                                    <AlertCircle size={14} /> <span>{errorMsg}</span>
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', textAlign: 'start' }}>
                                <div>
                                    <label htmlFor="accountId" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Account Username *</label>
                                    <input 
                                        id="accountId"
                                        type="text" 
                                        value={accountId} 
                                        onChange={(e) => setAccountId(e.target.value)}
                                        placeholder="e.g. saudiex_viewer"
                                        className="sx-input"
                                        disabled={!!editingAccountId}
                                        required 
                                    />
                                </div>
                                <div>
                                    <label htmlFor="nickName" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Display Name *</label>
                                    <input 
                                        id="nickName"
                                        type="text" 
                                        value={nickName} 
                                        onChange={(e) => setNickName(e.target.value)}
                                        placeholder="e.g. Jeddah Fleet Driver"
                                        className="sx-input"
                                        required 
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', textAlign: 'start' }}>
                                <div>
                                    <label htmlFor="password" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                                        {editingAccountId ? 'New Password (Optional)' : 'Password *'}
                                    </label>
                                    <input 
                                        id="password"
                                        type="password" 
                                        value={password} 
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder={editingAccountId ? 'Leave empty to keep current' : '••••••••'}
                                        className="sx-input"
                                        required={!editingAccountId} 
                                    />
                                </div>
                                <div>
                                    <label htmlFor="email" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Email Address *</label>
                                    <input 
                                        id="email"
                                        type="email" 
                                        value={email} 
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="viewer@saudiex.com"
                                        className="sx-input"
                                        required 
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', textAlign: 'start' }}>
                                <div>
                                    <label htmlFor="telephone" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px', display: 'block' }}>Telephone (Optional)</label>
                                    <input 
                                        id="telephone"
                                        type="text" 
                                        value={telephone} 
                                        onChange={(e) => setTelephone(e.target.value)}
                                        placeholder="+966 50..."
                                        className="sx-input"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="deviceImei" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                                        {language === 'ar' ? 'أرقام IMEIs لأجهزة OCI المربوطة (اختياري، مفصولة بفواصل)' : 'Mapped OCI Device IMEIs (Optional, comma-separated)'}
                                    </label>
                                    <input 
                                        id="deviceImei"
                                        type="text" 
                                        value={deviceImei} 
                                        onChange={(e) => setDeviceImei(e.target.value)}
                                        placeholder={language === 'ar' ? 'مثال: 781950640051748, 781950640053643' : 'e.g. 781950640051748, 781950640053643'}
                                        className="sx-input"
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setShowAddForm(false);
                                        setEditingAccountId(null);
                                    }}
                                    className="sx-btn sx-btn-ghost sx-btn-sm"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="sx-btn sx-btn-primary sx-btn-sm"
                                >
                                    {editingAccountId ? 'Update Account' : 'Save Account'}
                                </button>
                            </div>
                        </form>
                    )}

                    {successMsg && (
                        <div style={{
                            padding: '10px 12px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--online)',
                            fontSize: '12px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '8px'
                        }}>
                            <CheckCircle2 size={14} /> <span>{successMsg}</span>
                        </div>
                    )}

                    {/* Subaccounts List */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {loadingAccounts ? (
                            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                <span style={{ display: 'inline-block', marginInlineEnd: '8px' }}>⏳</span>
                                {language === 'ar' ? 'جاري تحميل الحسابات الفرعية...' : 'Loading sub-accounts...'}
                            </div>
                        ) : childAccounts.length > 0 ? (
                            childAccounts.map((account) => {
                                const isCustom = simulatedChildAccounts.some(acc => acc.accountId === account.accountId);
                                return (
                                    <div key={account.accountId} style={{
                                        padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        borderBottom: '1px solid var(--border)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                                borderRadius: 'var(--radius-sm)', color: isCustom ? 'var(--accent)' : 'var(--text-secondary)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <User size={18} />
                                            </div>
                                            <div style={{ textAlign: 'start' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{account.nickName}</p>
                                                    {isCustom && (
                                                        <span style={{
                                                            fontSize: '9px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px',
                                                            background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)'
                                                        }}>
                                                            OCI Integration
                                                        </span>
                                                    )}
                                                </div>
                                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                    ID: {account.accountId} • {account.email}
                                                    {account.deviceImei && (
                                                        <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
                                                            {' • '}OCI IMEI: {account.deviceImei}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{
                                                background: 'var(--accent-dim)', color: 'var(--accent)',
                                                fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                                                borderRadius: '100px', border: '1px solid var(--border-accent)'
                                            }}>
                                                {account.roleName}
                                            </span>
                                            
                                            {isCustom && !isSimulatedOperator && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleStartEdit(account)}
                                                        style={{
                                                            background: 'transparent', border: '1px solid var(--border)',
                                                            color: 'var(--text-secondary)', borderRadius: '4px', padding: '4px',
                                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}
                                                        title="Edit Account"
                                                    >
                                                        <Edit size={12} />
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleDeleteSubAccount(account.accountId)}
                                                        style={{
                                                            background: 'transparent', border: '1px solid var(--border)',
                                                            color: 'var(--danger)', borderRadius: '4px', padding: '4px',
                                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}
                                                        title="Delete Account"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ padding: '24px 0', color: 'var(--text-muted)', textAlign: 'center' }}>
                                {language === 'ar' ? 'لا توجد حسابات فرعية.' : 'No sub-accounts found.'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Audit Logs Card */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ textAlign: 'start' }}>
                            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={18} style={{ color: 'var(--accent)' }} />
                                {language === 'ar' ? 'سجل النشاطات والأمان' : 'Activity & Audit Log'}
                            </h2>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {language === 'ar' ? 'تتبع محاولات تسجيل الدخول وتعديل الأسماء الصادرة من الحسابات' : 'Track login attempts and name modifications made by sub-accounts'}
                            </p>
                        </div>
                        <button 
                            onClick={() => {
                                if (window.confirm('Clear logs?')) clearLogs();
                            }}
                            className="sx-btn-icon"
                            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28 }}
                            title="Clear logs"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'start' }}>User</th>
                                    <th style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'start' }}>Action</th>
                                    <th style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'start' }}>Timestamp</th>
                                    <th style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'end' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {simulatedLogs.map((log) => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500, textAlign: 'start' }}>{log.accountName}</td>
                                        <td style={{ padding: '10px 12px', color: 'var(--text-primary)', textAlign: 'start' }}>
                                            <p style={{ fontWeight: 600 }}>{log.action}</p>
                                            {log.details && <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{log.details}</p>}
                                        </td>
                                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', textAlign: 'start' }}>{log.timestamp}</td>
                                        <td style={{ padding: '10px 12px', textAlign: 'end' }}>
                                            <span className={`badge ${log.status === 'Success' ? 'badge-online' : 'badge-danger'}`} style={{ textTransform: 'none' }}>
                                                {log.status === 'Success' ? (language === 'ar' ? 'نجاح' : 'Success') : (language === 'ar' ? 'فشل' : 'Failed')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {simulatedLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ padding: '24px 0', color: 'var(--text-muted)', textAlign: 'center' }}>
                                            No activity logs found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'start', marginBottom: '8px' }}>
                {t('settings.title', 'الإعدادات')}
            </h1>

            {/* General Settings Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, textAlign: 'start' }}>
                    {language === 'ar' ? 'الإعدادات العامة' : 'General Settings'}
                </h2>
                
                <div className="glass-panel" style={{ overflow: 'hidden' }}>
                    {/* Notifications Toggle */}
                    <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', color: 'var(--accent)', display: 'flex' }}>
                                <Bell size={18} />
                            </div>
                            <div style={{ textAlign: 'start' }}>
                                <p style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>
                                    {language === 'ar' ? 'تفعيل الإشعارات' : 'Enable Notifications'}
                                </p>
                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '280px' }}>
                                    {language === 'ar' ? 'استقبل التنبيهات عند فقد الإشارة أو انخفاض البطارية' : 'Receive alerts on low battery or signal loss'}
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only" defaultChecked />
                            <div 
                                style={{
                                    width: '38px',
                                    height: '20px',
                                    borderRadius: '10px',
                                    background: 'var(--accent)',
                                    position: 'relative',
                                    transition: 'background 0.2s',
                                    flexShrink: 0
                                }}
                            >
                                <span style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: '20px',
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    background: '#fff',
                                    transition: 'left 0.2s'
                                }} />
                            </div>
                        </label>
                    </div>

                    {/* Dark Mode Toggle */}
                    <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', color: 'var(--accent)', display: 'flex' }}>
                                {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                            </div>
                            <div style={{ textAlign: 'start' }}>
                                <p style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>
                                    {language === 'ar' ? 'الوضع الداكن' : 'Dark Mode'}
                                </p>
                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    {language === 'ar' ? 'تفعيل الوضع الداكن في جميع الشاشات' : 'Enable dark theme across all views'}
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only" checked={theme === 'dark'} onChange={toggleTheme} />
                            <div 
                                style={{
                                    width: '38px',
                                    height: '20px',
                                    borderRadius: '10px',
                                    background: theme === 'dark' ? 'var(--accent)' : 'var(--border)',
                                    position: 'relative',
                                    transition: 'background 0.2s',
                                    flexShrink: 0
                                }}
                            >
                                <span style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: theme === 'dark' ? '20px' : '2px',
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    background: '#fff',
                                    transition: 'left 0.2s'
                                }} />
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Language Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, textAlign: 'start' }}>
                    {language === 'ar' ? 'اللغة' : 'Language'}
                </h2>
                <div className="glass-panel" style={{ padding: '8px', display: 'flex', gap: '8px' }}>
                    <button 
                        onClick={() => language !== 'ar' && toggleLanguage()}
                        className={`sx-btn ${language === 'ar' ? 'sx-btn-primary' : 'sx-btn-ghost'}`}
                        style={{ flex: 1, padding: '10px 0', fontSize: '13px' }}
                    >
                        <span>العربية</span>
                        <span style={{ marginInlineStart: '6px' }}>🇸🇦</span>
                    </button>
                    <button 
                        onClick={() => language !== 'en' && toggleLanguage()}
                        className={`sx-btn ${language === 'en' ? 'sx-btn-primary' : 'sx-btn-ghost'}`}
                        style={{ flex: 1, padding: '10px 0', fontSize: '13px' }}
                    >
                        <span>English</span>
                        <span style={{ marginInlineStart: '6px' }}>🇺🇸</span>
                    </button>
                </div>
            </div>

            {/* Users & App Themes */}
            <div className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <button 
                    onClick={() => setShowPermissions(true)}
                    style={{
                        background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
                        cursor: 'pointer', width: '100%', padding: '16px', display: 'flex',
                        alignItems: 'center', justifyContent: 'space-between', color: 'inherit'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.15)', color: 'var(--accent)', display: 'flex' }}>
                            <Shield size={18} />
                        </div>
                        <div style={{ textAlign: 'start' }}>
                            <p style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>
                                {language === 'ar' ? 'المستخدمون والصلاحيات' : 'Users & Permissions'}
                            </p>
                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {language === 'ar' ? 'إدارة مستخدمي المعاينة وصلاحياتهم وسجلات النشاط' : 'Manage preview users, permissions, and activity logs'}
                            </p>
                        </div>
                    </div>
                    <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} className="rtl-flip" />
                </button>
                
                <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                        <div style={{ padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', color: 'var(--accent)', display: 'flex' }}>
                            <Palette size={18} />
                        </div>
                        <div style={{ textAlign: 'start' }}>
                            <p style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>
                                {language === 'ar' ? 'سمات التطبيق' : 'App Themes'}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <div style={{
                                width: '100%', height: '56px', borderRadius: 'var(--radius-md)',
                                background: 'linear-gradient(135deg, var(--accent), #00b894)',
                                border: '2px solid var(--accent)',
                                boxShadow: 'var(--accent-glow)',
                                transition: 'transform 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
                            ></div>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {language === 'ar' ? 'عادي' : 'Default'}
                            </span>
                        </div>
                        <div 
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer', opacity: 0.7 }}
                            onClick={() => alert(language === 'ar' ? 'سمة الغروب ستكون متوفرة في التحديث القادم!' : 'Sunset theme will be available in the next release!')}
                        >
                            <div style={{
                                width: '100%', height: '56px', borderRadius: 'var(--radius-md)',
                                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                                transition: 'transform 0.2s, opacity 0.2s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.parentElement!.style.opacity = '1'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.parentElement!.style.opacity = '0.7'; }}
                            ></div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {language === 'ar' ? 'غروب' : 'Sunset'}
                            </span>
                        </div>
                        <div 
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer', opacity: 0.7 }}
                            onClick={() => alert(language === 'ar' ? 'سمة الواحة ستكون متوفرة في التحديث القادم!' : 'Oasis theme will be available in the next release!')}
                        >
                            <div style={{
                                width: '100%', height: '56px', borderRadius: 'var(--radius-md)',
                                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                                transition: 'transform 0.2s, opacity 0.2s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.parentElement!.style.opacity = '1'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.parentElement!.style.opacity = '0.7'; }}
                            ></div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                {language === 'ar' ? 'واحة' : 'Oasis'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
