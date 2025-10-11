import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

const ProtectedRoute = ({ children, allowedRole }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(true);
    const token = localStorage.getItem("user_token");
    const role = localStorage.getItem("user_role");
    const isBanned = localStorage.getItem("is_banned") === "true";

    useEffect(() => {
        const checkAuth = () => {
            if (!token) {
                toast.error("Please log in to access this page");
                localStorage.removeItem("user_token");
                localStorage.removeItem("user_role");
                navigate("/login", { 
                    state: { 
                        from: location,
                        message: "Please log in to continue" 
                    } 
                });
                return false;
            }

            if (isBanned) {
                toast.error("Your account has been banned. Please contact support.");
                localStorage.removeItem("user_token");
                localStorage.removeItem("user_role");
                navigate("/login", { 
                    state: { 
                        from: location,
                        banned: true,
                        message: "Your account has been banned" 
                    } 
                });
                return false;
            }

            if (role !== allowedRole) {
                toast.error(`Access denied. This page is only for ${allowedRole}s`);
                navigate("/", { 
                    state: { 
                        from: location,
                        message: `Access denied. This page is only for ${allowedRole}s` 
                    } 
                });
                return false;
            }

            return true;
        };

        const init = async () => {
            const isAuthorized = checkAuth();
            setIsLoading(false);
            return isAuthorized;
        };

        init();
    }, [navigate, token, role, isBanned, location, allowedRole]);

    if (isLoading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    return token && role === allowedRole && !isBanned ? children : null;
};

export default ProtectedRoute;