import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { FaHome, FaInfoCircle, FaBuilding, FaSignInAlt, FaUser } from 'react-icons/fa';
import { AuthContext } from '../../context/AuthContext';
import images from '../../assets/assets';
import './Navbar.css';

const Navbar = () => {
  const { userRole, isBanned } = useContext(AuthContext);

  // Clear user data if banned
  if (isBanned) {
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_role");
  }

  const handleLogoClick = () => {
    window.location.href = '/';
  };

  return (
    <nav className="navbar">
      <div className="navbar-logo" onClick={handleLogoClick}>
        <img src={images.logoF} alt="TaHanap logo" className="navbar-logo-image" />
        <div className="navbar-brand-block">
          <img src={images.tahanap} alt="TaHanap brand" className="navbar-brand-image" />
          <span className="navbar-tagline">Hanap-Bahay Made Simple</span>
        </div>
      </div>
      <ul className="navbar-links">
        <li>
          <Link to="/">
            <FaHome className="navbar-icon" />
            Home
          </Link>
        </li>
        <li>
          <Link to="/about-us">
            <FaInfoCircle className="navbar-icon" />
            About Us
          </Link>
        </li>
        <li>
          <Link to="/properties">
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
    </nav>
  );
};

export default Navbar;