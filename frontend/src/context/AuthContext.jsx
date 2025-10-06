import { createContext, useState, useEffect } from "react";
import { toast } from "react-toastify";
import axios from 'axios';
import { buildUpload, buildApi } from '../services/apiConfig';

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [userRole, setUserRole] = useState(null);
  const [isBanned, setIsBanned] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    const bannedStatus = localStorage.getItem("is_banned") === "true";
    
    if (role) {
      setUserRole(role);
    }
    // Try to hydrate current user from localStorage (fast) then refresh from API
    try {
      const raw = localStorage.getItem('current_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        setCurrentUser(parsed);
      }
    } catch (e) {}
    if (bannedStatus) {
      handleBannedUser();
    }

    const handleStorageChange = (e) => {
      if (e.key === "is_banned" && e.newValue === "true") {
        handleBannedUser();
      }
      if (e.key === "user_role" && !e.newValue) {
        setUserRole(null);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // fetch current user profile when token is present
  useEffect(() => {
    const token = localStorage.getItem('user_token');
    if (!token) return;
    let mounted = true;
  axios.get(buildApi('/users/me'), { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!mounted) return;
        const u = res.data || {};
        // normalize profile pic to absolute url
        let profilePic = u.profilePic || u.profile_pic || u.avatar || '';
        if (profilePic && !profilePic.startsWith('http')) profilePic = buildUpload(`/profiles/${profilePic}`);
        const normalized = { id: u._id || u.id || '', fullName: u.fullName || u.username || '', username: u.username || '', profilePic };
        setCurrentUser(normalized);
        try { localStorage.setItem('current_user', JSON.stringify(normalized)); } catch(e){}
      })
      .catch(() => {
        // ignore - don't force logout here
      });
    return () => { mounted = false; };
  }, []);

  const handleBannedUser = () => {
    setIsBanned(true);
    logout();
    toast.error("Your account has been banned. Please contact support.");
    window.location.href = "/login?banned=true";
  };

  const login = (role) => {
    localStorage.setItem("user_role", role);
    localStorage.removeItem("is_banned");
    setUserRole(role);
    setIsBanned(false);
    // If current_user is already present in localStorage (e.g., set by the login flow), hydrate it into context
    try {
      const raw = localStorage.getItem('current_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        setCurrentUser(parsed);
      }
    } catch (e) {}
    if (role === 'tenant') {
      toast.success('Tenant login successful');
    } else if (role === 'landlord') {
      toast.success('Landlord login successful');
    } else {
      toast.success('Login successful');
    }
  };

  const logout = () => {
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_token");
    localStorage.removeItem("is_banned");
    // clear cached current_user so components relying on it (chat avatars) update immediately
    try { localStorage.removeItem('current_user'); } catch (e) {}
    setUserRole(null);
    setIsBanned(false);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ userRole, isBanned, currentUser, setCurrentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;