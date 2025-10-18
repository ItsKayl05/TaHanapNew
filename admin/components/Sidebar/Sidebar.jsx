import React from "react";
import { Link, useLocation } from "react-router-dom";
import "./Sidebar.css";

const Sidebar = ({ onLogout }) => {
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Admin Panel</h2>
      </div>
      <nav>
        <ul>
          <li>
            <Link 
              to="/admin/dashboard" 
              className={location.pathname === "/admin/dashboard" ? "active" : ""}
            >
              <span>Dashboard</span>
            </Link>
          </li>
          <li>
            <Link 
              to="/admin/manage-users" 
              className={location.pathname === "/admin/manage-users" ? "active" : ""}
            >
              <span>Manage Users</span>
            </Link>
          </li>
          <li>
            <Link 
              to="/admin/manage-properties" 
              className={location.pathname === "/admin/manage-properties" ? "active" : ""}
            >
              <span>Manage Properties</span>
            </Link>
          </li>
          <li>
            <Link 
              to="/admin/landlord-verification" 
              className={location.pathname === "/admin/landlord-verification" ? "active" : ""}
            >
              <span>Property Owner Verification</span>
            </Link>
          </li>
        </ul>
      </nav>
      <div className="sidebar-footer">
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </div>
    </aside>
  );
};

export default Sidebar;