import React, { useContext, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaHome, FaInfoCircle, FaBuilding, FaSignInAlt, FaUser, FaBars, FaTimes } from 'react-icons/fa';
import { AuthContext } from '../../context/AuthContext';
import images from '../../assets/assets';
import './Navbar.css';

const Navbar = () => {
  const { userRole, isBanned } = useContext(AuthContext);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const location = useLocation();

  // Handle window resize with debounce
  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        if (!mobile) {
          setIsMenuOpen(false);
        }
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Clear user data if banned
  useEffect(() => {
    if (isBanned) {
      localStorage.removeItem("user_token");
      localStorage.removeItem("user_role");
    }
  }, [isBanned]);

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMenuOpen && 
          menuRef.current && 
          !menuRef.current.contains(event.target) &&
          buttonRef.current &&
          !buttonRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    // Use capture phase for immediate response
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('touchstart', handleClickOutside, true);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [isMenuOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isMenuOpen]);

  const handleLogoClick = () => {
    window.location.href = '/';
  };

  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  const toggleMenu = (e) => {
    if (e) {
      e.stopPropagation();
    }
    setIsMenuOpen(prev => !prev);
  };

  const handleMenuTouch = (e) => {
    e.stopPropagation();
    toggleMenu(e);
  };

  // Preload hover states
  useEffect(() => {
    // Preload critical images
    if (images.logoF) {
      const img = new Image();
      img.src = images.logoF;
    }
  }, []);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-logo" onClick={handleLogoClick}>
          <img 
            src={images.logoF} 
            alt="TaHanap logo" 
            className="navbar-logo-image"
            loading="eager"
          />
          {!isMobile && (
            <div className="navbar-brand-block">
              <img 
                src={images.tahanap} 
                alt="TaHanap brand" 
                className="navbar-brand-image"
                loading="eager"
              />
              <span className="navbar-tagline">Hanap-Bahay Made Simple</span>
            </div>
          )}
        </div>

        {/* Desktop Navigation */}
        {!isMobile && (
          <>
            <ul className="navbar-links">
              <li>
                <Link 
                  to="/" 
                  className={location.pathname === '/' ? 'active' : ''}
                >
                  <FaHome className="navbar-icon" />
                  Home
                </Link>
              </li>
              <li>
                <Link 
                  to="/about-us" 
                  className={location.pathname === '/about-us' ? 'active' : ''}
                >
                  <FaInfoCircle className="navbar-icon" />
                  About Us
                </Link>
              </li>
              <li>
                <Link 
                  to="/properties" 
                  className={location.pathname === '/properties' ? 'active' : ''}
                >
                  <FaBuilding className="navbar-icon" />
                  Properties
                </Link>
              </li>
            </ul>

            <div className="navbar-login">
              {userRole && !isBanned ? (
                <Link 
                  to={userRole === "tenant" ? "/tenant-profile" : "/landlord-profile"} 
                  className="dashboard-link"
                >
                  <FaUser className="navbar-icon" />
                  <span>Dashboard</span>
                </Link>
              ) : (
                <Link to="/login" className="login-register">
                  <FaSignInAlt className="navbar-icon" />
                  <span>Login / Register</span>
                </Link>
              )}
            </div>
          </>
        )}

        {/* Mobile Hamburger Menu */}
        {isMobile && (
          <div className="mobile-menu-toggle">
            <button 
              ref={buttonRef}
              className={`menu-toggle-btn ${isMenuOpen ? 'active' : ''}`}
              onClick={toggleMenu}
              onTouchStart={handleMenuTouch}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <FaTimes /> : <FaBars />}
            </button>
          </div>
        )}
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobile && (
        <div 
          className={`mobile-menu-overlay ${isMenuOpen ? 'active' : ''}`}
          onClick={() => setIsMenuOpen(false)}
        >
          <div 
            ref={menuRef}
            className={`mobile-menu ${isMenuOpen ? 'active' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-menu-header">
              <div className="mobile-logo" onClick={handleLogoClick}>
                <img 
                  src={images.logoF} 
                  alt="TaHanap logo" 
                  className="mobile-logo-image"
                  loading="eager"
                />
                <div className="mobile-brand-block">
                  <img 
                    src={images.tahanap} 
                    alt="TaHanap brand" 
                    className="mobile-brand-image"
                    loading="eager"
                  />
                  <span className="mobile-tagline">Hanap-Bahay Made Simple</span>
                </div>
              </div>
              <button 
                className="menu-close-btn"
                onClick={toggleMenu}
                onTouchStart={handleMenuTouch}
                aria-label="Close menu"
              >
                <FaTimes />
              </button>
            </div>

            <ul className="mobile-nav-links">
              <li>
                <Link 
                  to="/" 
                  className={`mobile-nav-link ${location.pathname === '/' ? 'active' : ''}`}
                  onClick={handleLinkClick}
                >
                  <FaHome className="mobile-nav-icon" />
                  <span>Home</span>
                </Link>
              </li>
              <li>
                <Link 
                  to="/about-us" 
                  className={`mobile-nav-link ${location.pathname === '/about-us' ? 'active' : ''}`}
                  onClick={handleLinkClick}
                >
                  <FaInfoCircle className="mobile-nav-icon" />
                  <span>About Us</span>
                </Link>
              </li>
              <li>
                <Link 
                  to="/properties" 
                  className={`mobile-nav-link ${location.pathname === '/properties' ? 'active' : ''}`}
                  onClick={handleLinkClick}
                >
                  <FaBuilding className="mobile-nav-icon" />
                  <span>Properties</span>
                </Link>
              </li>
            </ul>

            <div className="mobile-login-section">
              {userRole && !isBanned ? (
                <Link 
                  to={userRole === "tenant" ? "/tenant-profile" : "/landlord-profile"} 
                  className="mobile-dashboard-link"
                  onClick={handleLinkClick}
                >
                  <FaUser className="mobile-nav-icon" />
                  <span>Dashboard</span>
                </Link>
              ) : (
                <Link 
                  to="/login" 
                  className="mobile-login-register"
                  onClick={handleLinkClick}
                >
                  <FaSignInAlt className="mobile-nav-icon" />
                  <span>Login / Register</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;