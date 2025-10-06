import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import images from '../../assets/assets';
import './HomePage.css';

const heroImages = [images.modernHouse, images.modernHouse1, images.modernHouse2];

const HomePage = () => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [autoSlide, setAutoSlide] = useState(true);

  useEffect(() => {
    if (!autoSlide) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % heroImages.length);
    }, 5000); // Slower transition for modern feel

    return () => clearInterval(interval);
  }, [autoSlide]);

  const goToPrevious = () => {
    setAutoSlide(false);
    setCurrentImageIndex((prevIndex) =>
      prevIndex === 0 ? heroImages.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setAutoSlide(false);
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % heroImages.length);
  };

  return (
    <div className="home-page">
      {/* Hero */}
      <section className="hero-section">
        <div className="hero-bg-glow" />
        <div className="hero-left">
          <h1 className="hero-title">
            <span className="gradient-text">Find Your Home</span><br />
            in San Jose Del Monte, Bulacan
          </h1>
          <p className="subtitle">
            Discover verified residential rentals with powerful search, transparent owners, and a seamless experience tailored for local renters.
          </p>
          <div className="hero-cta-row">
            <button className="browse-btn primary" onClick={() => navigate('/properties')}>
              Browse Listings <span className="btn-arrow">→</span>
            </button>
            <button className="browse-btn ghost" onClick={() => navigate('/register')}>
              Get Started
            </button>
          </div>
          <div className="hero-mini-stats">
            <div><strong>500+</strong><span>Listings</span></div>
            <div><strong>1K+</strong><span>Users</span></div>
            <div><strong>24/7</strong><span>Access</span></div>
          </div>
        </div>
        <div className="hero-right">
          <div className="hero-image-container">
            {heroImages.map((image, index) => (
              <div
                key={index}
                className={`hero-image-wrapper ${index === currentImageIndex ? 'active' : ''}`}
                style={{ backgroundImage: `url(${image})` }}
              />
            ))}
            <button className="prev-btn" onClick={goToPrevious} aria-label="Previous image">
              <svg viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z" /></svg>
            </button>
            <button className="next-btn" onClick={goToNext} aria-label="Next image">
              <svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" /></svg>
            </button>
          </div>
          <div className="dots-container">
            {heroImages.map((_, index) => (
              <button
                key={index}
                className={`dot ${index === currentImageIndex ? 'active' : ''}`}
                onClick={() => { setAutoSlide(false); setCurrentImageIndex(index); }}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="feature-grid-section">
        <h2 className="section-heading">Why Rent With Us</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Smart Search</h3>
            <p>Filter by location, budget, and essentials to find the right match fast.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">✅</div>
            <h3>Verified Listings</h3>
            <p>Reduce scams with owner-verified IDs and consistent property data.</p>
          </div>
            <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3>Direct Messaging</h3>
            <p>Connect with landlords instantly—no middlemen or hidden fees.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📈</div>
            <h3>Growing Network</h3>
            <p>Daily onboarding of new rentals expands choices for every renter.</p>
          </div>
        </div>
      </section>

      {/* Call To Action */}
      <section className="cta-section">
        <div className="cta-inner">
          <h2>Ready to Find Your Next Home?</h2>
          <p>Join a growing rental platform built for transparency and ease.</p>
          <div className="cta-actions">
            <button className="browse-btn primary" onClick={() => navigate('/register')}>Create Account</button>
            <button className="browse-btn ghost" onClick={() => navigate('/properties')}>Explore Listings</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;