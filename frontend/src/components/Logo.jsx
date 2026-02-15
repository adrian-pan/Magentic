export default function Logo({ size = 24, className = '' }) {
    return (
        <img
            src="/Magentic Logo.png"
            alt="Magentic Logo"
            width={size}
            height={size}
            className={className}
            style={{
                objectFit: 'contain',
                display: 'block',
            }}
        />
    );
}
