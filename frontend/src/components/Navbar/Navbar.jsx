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
  const isInitialMount = useRef(true);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMenuOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
    if (!isInitialMount.current) {
      setIsMenuOpen(false);
    }
    isInitialMount.current = false;
  }, [location.pathname]);

  // Close menu when clicking outside - FIXED VERSION
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside both menu and toggle button
      const isOutsideMenu = menuRef.current && !menuRef.current.contains(event.target);
      const isOutsideButton = buttonRef.current && !buttonRef.current.contains(event.target);
      
      if (isMenuOpen && isOutsideMenu && isOutsideButton) {
        setIsMenuOpen(false);
      }
    };

    // Use timeout to avoid immediate closing
    const handleDocumentClick = (event) => {
      setTimeout(() => {
        handleClickOutside(event);
      }, 10);
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('touchstart', handleDocumentClick);
    
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('touchstart', handleDocumentClick);
    };
  }, [isMenuOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const handleLogoClick = () => {
    window.location.href = '/';
  };

  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  const toggleMenu = () => {
    setIsMenuOpen(prev => !prev);
  };

  // Direct menu handlers without event propagation issues
  const handleOverlayClick = (e) => {
    // Only close if clicking directly on overlay background
    if (e.target === e.currentTarget) {
      setIsMenuOpen(false);
    }
  };

  const handleMenuClick = (e) => {
    // Prevent click from bubbling to overlay
    e.stopPropagation();
  };

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
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <FaTimes /> : <FaBars />}
            </button>
          </div>
        )}
      </nav>

      {/* Mobile Menu Overlay - SIMPLIFIED VERSION */}
      {isMobile && isMenuOpen && (
        <div 
          className="mobile-menu-overlay active"
          onClick={handleOverlayClick}
        >
          <div 
            ref={menuRef}
            className="mobile-menu active"
            onClick={handleMenuClick}
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
                onClick={() => setIsMenuOpen(false)}
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