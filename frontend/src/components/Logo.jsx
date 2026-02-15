export default function Logo({ size = 24, className = '' }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
            className={`${className}`}
            style={{ animation: 'spin-slow 12s linear infinite' }}
        >
            {/* Retro "Abstract Star/Cross" - Derschutze vibe */}
            <path d="M12 2V22" />
            <path d="M2 12H22" />
            <path d="M4.92893 4.92893L19.0711 19.0711" />
            <path d="M19.0711 4.92893L4.92893 19.0711" />
            <circle cx="12" cy="12" r="3" strokeWidth="1" fill="var(--bg-primary)" />
        </svg>
    );
}
