import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUser, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import { motion } from "framer-motion";
import axios from "axios";
import { buildApi } from "../../services/apiConfig";
import { useAuth } from "../../context/AdminAuthContext";
import "./AdminLogin.css";

const AdminLogin = () => {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    setError(""); // Clear error when user starts typing
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!credentials.username.trim() || !credentials.password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const loginUrl = buildApi('/auth/admin/login');
      console.log('🔐 Admin login attempt:', { 
        username: credentials.username, 
        url: loginUrl 
      });

      const response = await axios.post(loginUrl, {
        username: credentials.username,
        password: credentials.password,
      }, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json',
        }
      });

      console.log('✅ Admin login response:', { 
        status: response.status, 
        data: response.data, 
        headers: response.headers 
      });

      // Handle response with proper error checking
      if (response.data) {
        const { token, role } = response.data;
        
        if (token && role === "admin") {
          login(token);
          console.log('🎯 Login successful, redirecting to admin dashboard');
          navigate("/admin/dashboard", { replace: true });
        } else if (token && role !== "admin") {
          setError("Access denied: User does not have admin privileges");
          console.error('❌ User is not admin:', { role, hasToken: !!token });
        } else {
          setError("Invalid response from server");
          console.error('❌ Missing token or role in response:', response.data);
        }
      } else {
        setError("No response data received from server");
        console.error('❌ Empty response data');
      }
    } catch (err) {
      console.error('❌ Admin login error:', err);
      
      let errorMsg = "Login failed. Please try again.";
      
      if (err.code === 'ECONNABORTED') {
        errorMsg = "Request timeout. Please check your connection and try again.";
      } else if (err.response) {
        // Server responded with error status
        errorMsg = err.response.data?.msg || 
                  err.response.data?.error || 
                  err.response.data?.message || 
                  `Server error: ${err.response.status}`;
        
        if (err.response.status === 401) {
          errorMsg = "Invalid username or password";
        } else if (err.response.status === 403) {
          errorMsg = "Access denied: Admin privileges required";
        } else if (err.response.status === 404) {
          errorMsg = "Login endpoint not found";
        } else if (err.response.status >= 500) {
          errorMsg = "Server error. Please try again later.";
        }
      } else if (err.request) {
        // Request was made but no response received
        errorMsg = "Cannot connect to server. Please check your connection.";
      }
      
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <motion.div
        className="login-box"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <h2>TaHanap Admin</h2>
        
        {error && (
          <motion.p 
            className="error-message" 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {error}
          </motion.p>
        )}
        
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <div className="input-field">
              <FaUser className="icon" />
              <input
                type="text"
                id="username"
                name="username"
                placeholder="Enter admin username"
                value={credentials.username}
                onChange={handleChange}
                disabled={isLoading}
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div className="input-field">
              <FaLock className="icon" />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                placeholder="Enter your password"
                value={credentials.password}
                onChange={handleChange}
                disabled={isLoading}
                required
                autoComplete="current-password"
              />
              <span 
                className={`toggle-password ${isLoading ? 'disabled' : ''}`} 
                onClick={!isLoading ? togglePasswordVisibility : undefined}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={isLoading}
            whileHover={!isLoading ? { scale: 1.05 } : {}}
            whileTap={!isLoading ? { scale: 0.95 } : {}}
            className={isLoading ? 'loading' : ''}
          >
            {isLoading ? (
              <div className="loading-spinner"></div>
            ) : (
              "Login"
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default AdminLogin;