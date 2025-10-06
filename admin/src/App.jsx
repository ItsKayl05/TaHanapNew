import React from "react";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AdminDashboard from "../pages/AdminDashboard/AdminDashboard";
import AdminLogin from "../pages/AdminLogin/AdminLogin";
import ManageProperties from "../pages/ManageProperties/ManageProperties";
import ManageUsers from "../pages/ManageUsers/ManageUsers";
 
import LandlordVerification from "../pages/LandlordVerification/LandlordVerification";
import ProtectedRoute from "../components/ProtectedRoutes/ProtectedRoutes"; 
import { AuthProvider } from "../context/AdminAuthContext"; 

const App = () => {
  return (
  <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin" element={<AdminLogin />} />

          {/* Protected Admin Routes */}
          <Route path="/admin/dashboard" element={<ProtectedRoute element={<AdminDashboard />} />} />
          <Route path="/admin/manage-users" element={<ProtectedRoute element={<ManageUsers />} />} />
          <Route path="/admin/manage-properties" element={<ProtectedRoute element={<ManageProperties />} />} />
// ...existing code...
          <Route path="/admin/landlord-verification" element={<ProtectedRoute element={<LandlordVerification />} />} /> {/* ✅ Added Route */}
        </Routes>
      </Router>
      <ToastContainer position="bottom-right" autoClose={3000} newestOnTop theme="light" pauseOnFocusLoss={false} closeOnClick />
    </AuthProvider>
  );
};

export default App;
