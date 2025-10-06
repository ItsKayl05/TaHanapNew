import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children, allowedRole }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const token = localStorage.getItem("user_token");
    const role = localStorage.getItem("user_role");
    const isBanned = localStorage.getItem("is_banned") === "true";

    useEffect(() => {
        // Debug output
        console.log('[ProtectedRoute] token:', token, 'role:', role, 'allowedRole:', allowedRole, 'isBanned:', isBanned);
        if (!token || isBanned) {
            localStorage.removeItem("user_token");
            localStorage.removeItem("user_role");
            navigate("/login", { 
                state: { 
                    from: location,
                    banned: isBanned 
                } 
            });
        } else if (role !== allowedRole) {
            navigate("/");
        }
    }, [navigate, token, role, isBanned, location, allowedRole]);

    return children;
};

export default ProtectedRoute;