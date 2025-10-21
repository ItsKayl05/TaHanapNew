import React from 'react';
import './AboutUs.css';

const AboutUs = () => {
    return (
    <div className="aboutus-container">

            {/* Hero Section */}
            <section className="aboutus-hero-section">
                <div className="aboutus-hero-glow" />
                <div className="aboutus-hero-content">
                    <h1>
                        <span className="gradient-text">Redefining Rentals</span> in the Philippines
                    </h1>
                    <p className="aboutus-hero-subtitle">
                        We're bridging the gap between property seekers and property owners through technology, transparency, and trust.
                    </p>
                    <div className="aboutus-hero-cta-row">
                        <a href="/register" className="aboutus-btn primary">Get Started</a>
                        <a href="/properties" className="aboutus-btn ghost">Browse Listings</a>
                    </div>
                </div>
            </section>

            {/* Metrics Section */}
            <section className="aboutus-metrics-section">
                <div className="aboutus-metrics-grid">
                    <div className="metric-card">
                        <h3>500+ <span>Listings</span></h3>
                        <p>Verified residential units onboarded.</p>
                    </div>
                    <div className="metric-card">
                        <h3>1K+ <span>Users</span></h3>
                        <p>Property seekers & property owners building trust.</p>
                    </div>
                    <div className="metric-card">
                        <h3>95% <span>Match</span></h3>
                        <p>Search satisfaction on recent sessions.</p>
                    </div>
                    <div className="metric-card">
                        <h3>24/7 <span>Access</span></h3>
                        <p>Cloud powered platform uptime.</p>
                    </div>
                </div>
            </section>

            {/* Mission Section */}
            <section className="aboutus-mission-section">
                <div className="aboutus-mission-content">
                    <div className="aboutus-mission-text">
                        <h2>Our Mission</h2>
                        <p>
                            In a market dominated by high-end listings and fragmented platforms, we saw an opportunity
                            to create something different — a platform dedicated to affordable, long-term residential
                            rentals that meets the needs of everyday Filipinos.
                        </p>
                        <p>
                            Our mission is to simplify the rental process for both tenants and property owners,
                            making it easier to find and list homes without unnecessary complexity or cost.
                        </p>
                    </div>
                    <div className="aboutus-mission-image">
                        <img
                            src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1173&q=80"
                            alt="Modern apartment building"
                            loading="lazy"
                        />
                    </div>
                </div>
            </section>

            {/* Problem Section */}
            <section className="aboutus-problem-section">
                <h2>The Problem We're Solving</h2>
                <div className="aboutus-problem-cards">
                    <div className="aboutus-problem-card">
                        <div className="aboutus-card-icon">🏠</div>
                        <h3>Fragmented Market</h3>
                        <p>
                            Current platforms either focus on luxury properties or lack proper verification,
                            leaving affordable housing seekers with limited, unreliable options.
                        </p>
                    </div>
                    <div className="aboutus-problem-card">
                        <div className="aboutus-card-icon">🔍</div>
                        <h3>Inefficient Search</h3>
                        <p>
                            Tenants waste hours scrolling through social media and classified ads, often encountering
                            outdated or misleading listings.
                        </p>
                    </div>
                    <div className="aboutus-problem-card">
                        <div className="aboutus-card-icon">📢</div>
                        <h3>Limited Visibility</h3>
                        <p>
                            Small property owners struggle to reach the right tenants, relying on word-of-mouth
                            or expensive brokers.
                        </p>
                    </div>
                </div>
            </section>

            {/* Solution Section */}
            <section className="aboutus-solution-section">
                <div className="aboutus-solution-content">
                    <div className="aboutus-solution-image">
                        <img
                            src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80"
                            alt="Modern office workspace"
                            loading="lazy"
                        />
                    </div>
                    <div className="aboutus-solution-text">
                        <h2>Our Solution</h2>
                        <p>
                            We've created a dedicated platform that focuses exclusively on residential rentals —
                            no commercial properties, no short-term stays, just real homes for real people.
                        </p>
                        <ul className="aboutus-solution-features">
                            <li>
                                <strong>Verified Listings:</strong> Every property goes through basic verification
                                to ensure accuracy and reduce scams.
                            </li>
                            <li>
                                <strong>Smart Search:</strong> Powerful filters help tenants find exactly what
                                they need based on budget, location, and amenities.
                            </li>
                            <li>
                                <strong>Direct Communication:</strong> Built-in messaging connects tenants and
                                landlords without middlemen.
                            </li>
                            <li>
                                <strong>Community Focus:</strong> Neighborhood insights help renters make
                                informed decisions about their next home.
                            </li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* Team Section */}
            <section className="aboutus-team-section">
                <h2>Who We Are</h2>
                <div className="aboutus-team-content">
                    <div className="aboutus-team-image">
                        <img
                            src="https://images.unsplash.com/photo-1571260899304-425eee4c7efc?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80"
                            alt="Diverse team collaborating"
                            loading="lazy"
                        />
                    </div>
                    <div className="aboutus-team-text">
                        <p>
                            We're a team of real estate professionals, technologists, and most importantly —
                            renters and landlords ourselves. We've experienced the frustrations of the current
                            system firsthand, which drives our passion to build something better.
                        </p>
                        <p>
                            Based in the Philippines, we understand the unique challenges of the local rental
                            market and are committed to creating solutions that actually work for our community.
                        </p>
                    </div>
                </div>
            </section>

            {/* Values Section */}
            <section className="aboutus-values-section">
                <h2>Our Core Values</h2>
                <div className="aboutus-values-grid">
                    <div className="aboutus-value-card">
                        <h3>Transparency</h3>
                        <p>Clear pricing, honest listings, and open communication form the foundation of our platform.</p>
                    </div>
                    <div className="aboutus-value-card">
                        <h3>Accessibility</h3>
                        <p>We believe everyone deserves access to quality housing information, regardless of budget.</p>
                    </div>
                    <div className="aboutus-value-card">
                        <h3>Community</h3>
                        <p>We're building more than a platform — we're fostering connections between neighbors.</p>
                    </div>
                    <div className="aboutus-value-card">
                        <h3>Innovation</h3>
                        <p>We continuously improve our technology to better serve both tenants and property owners.</p>
                    </div>
                </div>
            </section>

        </div>
    );
};

export default AboutUs;