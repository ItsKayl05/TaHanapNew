import React, { useState } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import axios from 'axios';
import { buildApi } from '../../services/apiConfig.js';
import './AdminChangePassword.css';

const AdminChangePassword = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('adminToken');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', msg: '' });

    if (newPassword !== confirmPassword) {
      return setStatus({ type: 'error', msg: 'New passwords do not match' });
    }
    if (newPassword.length < 8) {
      return setStatus({ type: 'error', msg: 'New password must be at least 8 characters' });
    }

    try {
      setLoading(true);
  const res = await axios.post(buildApi('/auth/admin/change-password'), {
        oldPassword,
        newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus({ type: 'success', msg: res.data.msg || 'Password updated. Please login again.' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Clear token to force re-login
      localStorage.removeItem('adminToken');
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.msg || 'Error updating password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-change-password-page">
      <Sidebar onLogout={() => { localStorage.removeItem('adminToken'); window.location.href='/admin'; }} />
      <main className="change-password-content">
        <h1>Change Password</h1>
        <p className="subtitle">Rotate your admin credentials regularly for better security.</p>
        <form className="change-password-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Current Password</label>
            <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading}>{loading ? 'Updating...' : 'Update Password'}</button>
          {status.msg && <div className={`status-msg ${status.type}`}>{status.msg}</div>}
          {status.type === 'success' && <p className="relogin-hint">After success, reload and login with your new password.</p>}
        </form>
        <div className="tips">
          <h3>Password Tips</h3>
          <ul>
            <li>Use at least 12 characters in production.</li>
            <li>Mix upper/lowercase, numbers, and symbols.</li>
            <li>Avoid reusing old passwords.</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default AdminChangePassword;
