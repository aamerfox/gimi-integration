import React from 'react';

// Duck-typing the map reference to accept either the standard Leaflet map or the LiveMapHandle.
interface MapLike {
    zoomIn?: () => void;
    zoomOut?: () => void;
}

interface Props {
    mapRef: React.RefObject<MapLike | null>;
    style?: React.CSSProperties;
}

export default function MapZoomControls({ mapRef, style }: Props) {
    const handleZoomIn = (e: React.MouseEvent) => {
        e.stopPropagation();
        mapRef.current?.zoomIn?.();
    };

    const handleZoomOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        mapRef.current?.zoomOut?.();
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', overflow: 'hidden', width: '36px',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            ...style
        }}>
            <button
                onClick={handleZoomIn}
                title="Zoom In"
                style={{
                    width: '36px', height: '36px', background: 'transparent',
                    border: 'none', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', color: 'var(--text-primary)',
                    fontSize: '20px', lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >+</button>
            <button
                onClick={handleZoomOut}
                title="Zoom Out"
                style={{
                    width: '36px', height: '36px', background: 'transparent',
                    border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
                    fontSize: '20px', lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >−</button>
        </div>
    );
}
