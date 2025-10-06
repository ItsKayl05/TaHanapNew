import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    token: null,
    loading: true
  });

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    setAuthState({
      isAuthenticated: !!token,
      token: token,
      loading: false
    });
  }, []);

  const login = (token) => {
    localStorage.setItem("adminToken", token);
    setAuthState({
      isAuthenticated: true,
      token: token,
      loading: false
    });
  };

  const logout = () => {
    localStorage.removeItem("adminToken");
    setAuthState({
      isAuthenticated: false,
      token: null,
      loading: false
    });
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;