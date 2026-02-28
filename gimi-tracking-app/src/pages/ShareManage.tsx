import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { useDeviceStore } from '../store/devices';
import { useShareLinkStore } from '../store/shareLinks';
import { createShareUrl, SHARE_DURATIONS } from '../services/share';
import type { Device } from '../store/devices';
import { Copy, Trash2, Link as LinkIcon, Lock, CheckCheck } from 'lucide-react';

export default function ShareManage() {
    const { accessToken } = useAuthStore();
    const { devices } = useDeviceStore();
    const { links, addLink, removeLink, clearExpired } = useShareLinkStore();

    const [selectedImei, setSelectedImei] = useState('');
    const [selectedDuration, setSelectedDuration] = useState(0);
    const [generating, setGenerating] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fallbackCopyTextToClipboard = (text: string) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;

        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
        }

        document.body.removeChild(textArea);
    };

    const copyText = async (text: string) => {
        if (!navigator.clipboard) {
            fallbackCopyTextToClipboard(text);
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            fallbackCopyTextToClipboard(text);
        }
    };

    useEffect(() => {
        if (devices.length > 0 && !selectedImei) {
            setSelectedImei(devices[0].imei);
        }
    }, [devices, selectedImei]);

    useEffect(() => {
        clearExpired();
    }, [clearExpired]);

    const handleGenerate = async () => {
        if (!selectedImei || !accessToken) return;
        setGenerating(true);
        try {
            const device = devices.find((d: Device) => d.imei === selectedImei);
            const duration = SHARE_DURATIONS[selectedDuration];
            const exp = Math.floor(Date.now() / 1000) + duration.seconds;

            const baseUrl = window.location.origin;
            const url = createShareUrl(baseUrl, {
                imei: selectedImei,
                name: device?.deviceName ?? selectedImei,
                exp,
                tok: accessToken,
            });

            addLink({
                id: `share-${Date.now()}`,
                imei: selectedImei,
                deviceName: device?.deviceName ?? selectedImei,
                url,
                exp,
                createdAt: new Date().toISOString(),
            });

            await copyText(url);
            setCopiedId('generated');
            setTimeout(() => setCopiedId(null), 2000);
        } finally {
            setGenerating(false);
        }
    };

    const handleCopy = async (url: string, id: string) => {
        await copyText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const isExpired = (exp: number) => Date.now() / 1000 > exp;

    const activeLinks = links.filter(l => !isExpired(l.exp));
    const expiredLinks = links.filter(l => isExpired(l.exp));

    return (
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div className="glass-panel" style={{ width: 48, height: 48, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <LinkIcon size={24} color="var(--accent)" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Share Link</h1>
                        <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>Anyone with the link can view live location — no login required.</p>
                    </div>
                </div>

                <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Create Share Link</h2>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>
                            DEVICE
                        </label>
                        <select
                            value={selectedImei}
                            onChange={(e) => setSelectedImei(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-primary)',
                                outline: 'none',
                                fontSize: '14px',
                            }}
                        >
                            {devices.map((d: Device) => (
                                <option key={d.imei} value={d.imei}>{d.deviceName}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>
                            LINK EXPIRES IN
                        </label>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {SHARE_DURATIONS.map((d, i) => (
                                <button
                                    key={d.label}
                                    onClick={() => setSelectedDuration(i)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '20px',
                                        background: selectedDuration === i ? 'var(--accent-dim)' : 'var(--bg-primary)',
                                        border: `1px solid ${selectedDuration === i ? 'var(--accent)' : 'var(--border)'}`,
                                        color: selectedDuration === i ? 'var(--accent)' : 'var(--text-muted)',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={!selectedImei || generating}
                        className="sx-btn"
                        style={{
                            width: '100%',
                            padding: '14px',
                            opacity: (!selectedImei || generating) ? 0.7 : 1,
                            backgroundColor: copiedId === 'generated' ? 'var(--success)' : 'var(--accent)',
                        }}
                    >
                        {generating ? 'Generating...' : copiedId === 'generated' ? 'Copied to Clipboard!' : '✨ Generate Share Link'}
                    </button>

                    <div style={{
                        marginTop: '16px',
                        padding: '12px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(0, 212, 170, 0.06)',
                        border: '1px solid rgba(0, 212, 170, 0.2)',
                        color: 'var(--text-muted)',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <Lock size={14} color="var(--accent)" />
                        Links are cryptographically signed (HMAC-SHA256) and automatically expire.
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Active Links ({activeLinks.length})</h2>
                    {expiredLinks.length > 0 && (
                        <button
                            onClick={clearExpired}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}
                        >
                            Clear expired ({expiredLinks.length})
                        </button>
                    )}
                </div>

                {links.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        <LinkIcon size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                        <p>No share links yet.<br />Generate one above to share a device's live location.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {links.map(link => {
                            const expired = isExpired(link.exp);
                            return (
                                <div key={link.id} className="glass-panel" style={{
                                    padding: '16px',
                                    opacity: expired ? 0.6 : 1,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{
                                            width: 44, height: 44,
                                            borderRadius: '12px',
                                            background: expired ? 'var(--bg-primary)' : 'var(--accent-dim)',
                                            color: expired ? 'var(--text-muted)' : 'var(--accent)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {expired ? <Lock size={20} /> : <LinkIcon size={20} />}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '15px', color: expired ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                                {link.deviceName}
                                            </div>
                                            <div style={{
                                                fontSize: '13px',
                                                marginTop: '4px',
                                                color: expired ? 'var(--danger)' : 'var(--success)'
                                            }}>
                                                {expired ? 'Expired' : `Expires ${new Date(link.exp * 1000).toLocaleString()}`}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                Created {new Date(link.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {!expired && (
                                            <button
                                                onClick={() => handleCopy(link.url, link.id)}
                                                className="sx-btn-icon"
                                                style={{
                                                    background: copiedId === link.id ? 'var(--success)' : 'var(--bg-primary)',
                                                    border: '1px solid var(--border)',
                                                    color: copiedId === link.id ? '#fff' : 'var(--text-primary)'
                                                }}
                                                title="Copy Link"
                                            >
                                                {copiedId === link.id ? <CheckCheck size={18} /> : <Copy size={18} />}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => removeLink(link.id)}
                                            className="sx-btn-icon"
                                            style={{
                                                background: 'rgba(239,68,68,0.1)',
                                                border: '1px solid rgba(239,68,68,0.2)',
                                                color: 'var(--danger)'
                                            }}
                                            title="Delete Link"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
