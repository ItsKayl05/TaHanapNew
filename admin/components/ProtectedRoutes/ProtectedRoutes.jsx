import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AdminAuthContext"; // Make sure path is correct

const ProtectedRoute = ({ element }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? element : <Navigate to="/admin" replace />;
};

export default ProtectedRoute;