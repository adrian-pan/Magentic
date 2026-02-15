import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function WelcomePage() {
    const navigate = useNavigate();

    const handleTransmit = () => {
        navigate('/app');
    };

    return (
        <div className="welcome-page">
            {/* Hero Section */}
            <div className="welcome-hero">
                <div className="welcome-logo-group">
                    <img
                        src="/Magentic Logo.png"
                        alt="Magentic Logo"
                        className="welcome-logo-img"
                    />
                    <span className="welcome-logo-title">MAGENTIC</span>
                </div>

                <p className="welcome-tagline">
                    YOUR AI-POWERED MUSIC PRODUCTION<br />
                    CO-PILOT FOR REAPER DAW.
                </p>
            </div>

            {/* CTA Section */}
            <div className="welcome-cta-section">
                <button className="welcome-transmit-btn" onClick={handleTransmit}>
                    ENTER_MAGENTIC
                </button>
            </div>

            {/* Feature Cards */}
            <div className="welcome-features">
                <div className="welcome-feature-card">
                    <span className="welcome-feature-number">[1]</span>
                    <span className="welcome-feature-label">CONNECT_TO_REAPER</span>
                </div>
                <div className="welcome-feature-card">
                    <span className="welcome-feature-number">[2]</span>
                    <span className="welcome-feature-label">TALK_TO_MAGENTIC</span>
                </div>
                <div className="welcome-feature-card">
                    <span className="welcome-feature-number">[3]</span>
                    <span className="welcome-feature-label">PRODUCE_MUSIC</span>
                </div>
            </div>
        </div>
    );
}
