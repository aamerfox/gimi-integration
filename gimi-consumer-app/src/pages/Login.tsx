import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { gimiService } from '@/services/gimi';
import md5 from 'md5';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Minimal auth helper to bridge old store signature
function useLogin() {
  const { setAuth } = useAuthStore();
  return (accessToken: string, account: string) => {
    setAuth({ accessToken, expiresIn: 7200, refreshToken: '', userId: account, appKey: '' });
  };
}

export default function Login() {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useLogin();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogin = async () => {
    if (!account || !password) { setError('يرجى ملء جميع الحقول'); return; }
    setLoading(true); setError('');
    try {
      const res = (await gimiService.login(account, md5(password))) as unknown as { result?: { accessToken?: string } };
      if (res?.result?.accessToken) {
        login(res.result.accessToken, account);
        navigate('/');
      } else {
        setError(t('auth.loginFailed'));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100svh',
      background: 'linear-gradient(160deg, var(--theme-from) 0%, var(--theme-to) 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24, gap: 32,
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img
          src="/logo-icon.png"
          alt="trace+ icon"
          className="brand-logo-icon"
          style={{
            width: 80,
            height: 80,
            objectFit: 'contain',
            marginBottom: 12,
          }}
        />
        <img
          src="/logo-wordmark.png"
          alt="trace+ logo"
          className="brand-logo-wordmark"
          style={{
            height: 48,
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Card */}
      <div className="glass-card" style={{ width: '100%', maxWidth: 380, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h2 style={{ fontWeight: 700, fontSize: 18, textAlign: 'center' }}>{t('auth.login')}</h2>

        {/* Account */}
        <div style={{ position: 'relative' }}>
          <User size={16} style={{ position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)', color: 'var(--theme-muted)' }} />
          <input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder={t('auth.accountIdPlaceholder')}
            dir="ltr"
            style={{
              width: '100%', padding: '13px 44px 13px 16px',
              border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 14,
              fontSize: 14, fontFamily: 'inherit', outline: 'none',
              background: 'rgba(255,255,255,0.6)', color: 'var(--theme-text)',
              textAlign: 'right',
            }}
          />
        </div>

        {/* Password */}
        <div style={{ position: 'relative' }}>
          <Lock size={16} style={{ position: 'absolute', top: '50%', right: 14, transform: 'translateY(-50%)', color: 'var(--theme-muted)' }} />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            style={{ position: 'absolute', top: '50%', left: 14, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-muted)' }}
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <input
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder={t('auth.passwordPlaceholder')}
            dir="ltr"
            style={{
              width: '100%', padding: '13px 44px 13px 44px',
              border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 14,
              fontSize: 14, fontFamily: 'inherit', outline: 'none',
              background: 'rgba(255,255,255,0.6)', color: 'var(--theme-text)',
              textAlign: 'right',
            }}
          />
        </div>

        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '14px',
            background: 'linear-gradient(135deg, var(--theme-accent), var(--theme-accent2))',
            border: 'none', borderRadius: 14, color: 'white',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            opacity: loading ? 0.7 : 1,
            boxShadow: '0 4px 16px color-mix(in srgb, var(--theme-accent) 35%, transparent)',
          }}
        >
          {loading ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </div>
    </div>
  );
}
