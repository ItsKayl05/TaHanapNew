import React, { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaHome, FaInfoCircle, FaBuilding, FaSignInAlt, FaUser, FaBars, FaTimes } from 'react-icons/fa';
import { AuthContext } from '../../context/AuthContext';
import images from '../../assets/assets';
import './Navbar.css';

const Navbar = () => {
  const { userRole, isBanned } = useContext(AuthContext);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Close menu when switching to desktop
      if (!mobile) {
        setIsMenuOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clear user data if banned
  if (isBanned) {
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_role");
  }

  const handleLogoClick = () => {
    window.location.href = '/';
    setIsMenuOpen(false);
  };

  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMenuOpen && !event.target.closest('.navbar') && !event.target.closest('.mobile-menu')) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isMenuOpen]);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-logo" onClick={handleLogoClick}>
          <img src={images.logoF} alt="TaHanap logo" className="navbar-logo-image" />
          {!isMobile && (
            <div className="navbar-brand-block">
              <img src={images.tahanap} alt="TaHanap brand" className="navbar-brand-image" />
              <span className="navbar-tagline">Hanap-Bahay Made Simple</span>
            </div>
          )}
        </div>

        {/* Desktop Navigation */}
        {!isMobile && (
          <>
            <ul className="navbar-links">
              <li>
                <Link to="/" onClick={handleLinkClick}>
                  <FaHome className="navbar-icon" />
                  Home
                </Link>
              </li>
              <li>
                <Link to="/about-us" onClick={handleLinkClick}>
                  <FaInfoCircle className="navbar-icon" />
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/properties" onClick={handleLinkClick}>
                  <FaBuilding className="navbar-icon" />
                  Properties
                </Link>
              </li>
            </ul>

            <div className="navbar-login">
              {userRole && !isBanned ? (
                <Link to={userRole === "tenant" ? "/tenant-profile" : "/landlord-profile"} className="dashboard-link">
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
              className="menu-toggle-btn"
              onClick={toggleMenu}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <FaTimes /> : <FaBars />}
            </button>
          </div>
        )}
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobile && isMenuOpen && (
        <div className="mobile-menu-overlay">
          <div className="mobile-menu">
            <div className="mobile-menu-header">
              <div className="mobile-logo" onClick={handleLogoClick}>
                <img src={images.logoF} alt="TaHanap logo" className="mobile-logo-image" />
                <div className="mobile-brand-block">
                  <img src={images.tahanap} alt="TaHanap brand" className="mobile-brand-image" />
                  <span className="mobile-tagline">Hanap-Bahay Made Simple</span>
                </div>
              </div>
              <button 
                className="menu-close-btn"
                onClick={toggleMenu}
                aria-label="Close menu"
              >
                <FaTimes />
              </button>
            </div>

            <ul className="mobile-nav-links">
              <li>
                <Link to="/" onClick={handleLinkClick} className="mobile-nav-link">
                  <FaHome className="mobile-nav-icon" />
                  <span>Home</span>
                </Link>
              </li>
              <li>
                <Link to="/about-us" onClick={handleLinkClick} className="mobile-nav-link">
                  <FaInfoCircle className="mobile-nav-icon" />
                  <span>About Us</span>
                </Link>
              </li>
              <li>
                <Link to="/properties" onClick={handleLinkClick} className="mobile-nav-link">
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