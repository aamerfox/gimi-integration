import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import MD5 from 'crypto-js/md5';
import { gimiService } from '../services/gimi';
import { useAuthStore } from '../store/auth';

interface LoginResult {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

interface LoginApiResponse {
    result?: LoginResult;
}

const APP_KEY = '8FB345B8693CCD00335F2C82D35E0CC0339A22A4105B6558';

export default function Login() {
    const [account, setAccount] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const setAuth = useAuthStore((s) => s.setAuth);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // If input is already a 32-char lowercase hex MD5, use it directly; otherwise hash it
            const isMd5 = /^[a-f0-9]{32}$/i.test(password);
            const passwordMd5 = isMd5 ? password.toLowerCase() : MD5(password).toString();
            const res = await gimiService.login(account, passwordMd5) as LoginApiResponse;
            if (res?.result) {
                setAuth({
                    accessToken: res.result.accessToken,
                    refreshToken: res.result.refreshToken,
                    expiresIn: res.result.expiresIn,
                    userId: account,
                    appKey: APP_KEY,
                });
                navigate('/');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Animated background blobs */}
            <div style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                pointerEvents: 'none',
            }}>
                <div style={{
                    position: 'absolute',
                    width: '500px',
                    height: '500px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,212,170,0.08) 0%, transparent 70%)',
                    top: '-100px',
                    right: '-100px',
                    animation: 'float-blob 20s ease-in-out infinite',
                }} />
                <div style={{
                    position: 'absolute',
                    width: '400px',
                    height: '400px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,184,148,0.06) 0%, transparent 70%)',
                    bottom: '-80px',
                    left: '-80px',
                    animation: 'float-blob 25s ease-in-out infinite reverse',
                }} />
                <div style={{
                    position: 'absolute',
                    width: '300px',
                    height: '300px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,212,170,0.04) 0%, transparent 70%)',
                    top: '40%',
                    left: '50%',
                    animation: 'float-blob 18s ease-in-out infinite',
                }} />
            </div>

            {/* Login Card */}
            <form
                onSubmit={handleSubmit}
                className="glass-panel animate-slide-up"
                style={{
                    width: '100%',
                    maxWidth: '420px',
                    padding: '40px 36px',
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: 56,
                        height: 56,
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, var(--accent), #00b894)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '16px',
                        boxShadow: 'var(--accent-glow)',
                    }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="#0a0e1a" stroke="none">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                        </svg>
                    </div>
                    <h1 style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        letterSpacing: '-0.03em',
                        marginBottom: '4px',
                    }}>
                        Saudi<span style={{ color: 'var(--accent)' }}>Ex</span>
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        Fleet Tracking Platform
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        color: 'var(--danger)',
                        fontSize: '13px',
                        marginBottom: '20px',
                    }}>
                        {error}
                    </div>
                )}

                {/* Inputs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Account ID
                        </label>
                        <input
                            type="text"
                            value={account}
                            onChange={(e) => setAccount(e.target.value)}
                            className="sx-input"
                            placeholder="Enter your account ID"
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="sx-input"
                            placeholder="Enter your password"
                            required
                        />
                    </div>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={loading}
                    className="sx-btn sx-btn-primary"
                    style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                >
                    {loading ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4" strokeLinecap="round" />
                            </svg>
                            Signing in...
                        </span>
                    ) : 'Sign In'}
                </button>

                {/* Footer */}
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', marginTop: '24px' }}>
                    Powered by TrackSolid Pro
                </p>
            </form>
        </div>
    );
}
