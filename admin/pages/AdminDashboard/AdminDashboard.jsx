import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar/Sidebar";
import DashboardCard from "../../components/DashboardCard/DashboardCard";
import { FaUsers, FaBuilding, FaUserTie, FaUser } from "react-icons/fa";
import "./AdminDashboard.css";
import axios from "axios"; // Import axios for fetching data
import { buildApi } from "../../services/apiConfig.js";

const AdminDashboard = () => {
  const navigate = useNavigate();

  const [totalUsers, setTotalUsers] = useState(0);
  const [landlordsCount, setLandlordsCount] = useState(0);
  const [tenantsCount, setTenantsCount] = useState(0);
  const [totalProperties, setTotalProperties] = useState(0);

  const [barangayStats, setBarangayStats] = useState([]);
  // Fetch data from backend
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const usersRes = await axios.get(buildApi('/admin/total-users'));
        const propertiesRes = await axios.get(buildApi('/admin/total-properties'));
        const brgyStatsRes = await axios.get(buildApi('/admin/user-barangay-stats'));

        setTotalUsers(usersRes.data.totalUsers || 0);
        setLandlordsCount(usersRes.data.landlords || 0);
        setTenantsCount(usersRes.data.tenants || 0);
        setTotalProperties(propertiesRes.data.totalProperties || 0);
        setBarangayStats(brgyStatsRes.data.barangayStats || []);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };

    fetchDashboardData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin");
  };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-body">
        <Sidebar onLogout={handleLogout} />
        <main className="dashboard-content">
          <h1>Admin Dashboard</h1>
          <p>Manage users and properties efficiently.</p>

          <div className="dashboard-cards">
            <div className="card-accent-blue"><DashboardCard title="Total Users" value={totalUsers} icon={<FaUsers />} /></div>
            <div className="card-accent-purple"><DashboardCard title="Property Owners" value={landlordsCount} icon={<FaUserTie />} /></div>
            <div className="card-accent-green"><DashboardCard title="Property Seekers" value={tenantsCount} icon={<FaUser />} /></div>
            <div className="card-accent-yellow"><DashboardCard title="Properties Listed" value={totalProperties} icon={<FaBuilding />} /></div>
          </div>
          {/* Per-barangay breakdown */}
          <div className="barangay-stats-section" style={{marginTop: '2.5rem'}}>
            <h2 style={{fontSize: '1.3rem', marginBottom: '1.2rem'}}>Property Owners & Property Seekers per Barangay</h2>
            <div className="barangay-stats-tables" style={{display: 'flex', gap: '2.5rem', flexWrap: 'wrap'}}>
              <div style={{flex: 1, minWidth: 260}}>
                <h3 style={{fontSize: '1.1rem', marginBottom: '0.7rem'}}>Property Owners</h3>
                <table className="barangay-table">
                  <thead><tr><th>Barangay</th><th>Count</th></tr></thead>
                  <tbody>
                    {barangayStats.filter(b => b.landlords > 0).map(b => (
                      <tr key={b.barangay}><td>{b.barangay}</td><td>{b.landlords}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{flex: 1, minWidth: 260}}>
                <h3 style={{fontSize: '1.1rem', marginBottom: '0.7rem'}}>Property Seekers</h3>
                <table className="barangay-table">
                  <thead><tr><th>Barangay</th><th>Count</th></tr></thead>
                  <tbody>
                    {barangayStats.filter(b => b.tenants > 0).map(b => (
                      <tr key={b.barangay}><td>{b.barangay}</td><td>{b.tenants}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
