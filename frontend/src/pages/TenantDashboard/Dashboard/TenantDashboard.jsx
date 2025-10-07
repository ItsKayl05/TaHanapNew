import React, { useEffect, useState, useContext } from "react";
import ChatBox from '../../../components/ChatBox/ChatBox';
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

import images from "../../../assets/assets";
import './TenantDashboard.css';
import '../../LandLordDashboard/landlord-theme.css';
import { AuthContext } from "../../../context/AuthContext";
import TenantSidebar from "../TenantSidebar/TenantSidebar";
import { buildApi } from '../../../services/apiConfig';
import { barangayList } from '../../../utils/barangayList';

const TenantDashboard = () => {
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [role, setRole] = useState("");
    const [userData, setUserData] = useState({
        username: "",
        fullName: "",
        address: "",
        barangay: "",
        contactNumber: "",
        email: "",
        profilePic: ""
    });
    const [passwords, setPasswords] = useState({ oldPassword: "", newPassword: "" });
    const [isUpdated, setIsUpdated] = useState(false);
    const [idVerificationStatus, setIdVerificationStatus] = useState("n/a");

    useEffect(() => {
        const checkBannedStatus = async () => {
            const token = localStorage.getItem("user_token");
            if (!token) return;

            try {
                const response = await fetch(buildApi('/users/check-status'), {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                });

                const data = await response.json();

                if (data.status === "banned") {
                    localStorage.setItem("is_banned", "true");
                    window.dispatchEvent(new Event("storage"));
                }
            } catch (error) {
                console.error("Error checking user status:", error);
            }
        };

        checkBannedStatus();
        const interval = setInterval(checkBannedStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("user_token");

        if (!token) {
            toast.error("No token found. Redirecting to homepage...");
            navigate("/");
            return;
        }

        const verifyTokenExpiry = () => {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            const expirationTime = decodedToken.exp * 1000;
            if (Date.now() >= expirationTime) {
                toast.error("Session expired. Please log in again.");
                localStorage.removeItem("user_token");
                navigate("/login");
                return false;
            }
            return true;
        };

        if (!verifyTokenExpiry()) return;

        const fetchDashboardData = async () => {
            try {
                const response = await fetch(buildApi('/users/tenant-dashboard'), {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (response.status === 403) {
                    const data = await response.json();
                    if (data.banned) {
                        localStorage.setItem("is_banned", "true");
                        window.dispatchEvent(new Event("storage"));
                        return;
                    }
                }

                const data = await response.json();

                if (response.ok && data.role === "tenant") {
                    setRole("tenant");
                    setUserData({
                        username: data.username,
                        fullName: data.fullName || "",
                        address: data.address || "",
                        barangay: data.barangay || "",
                        contactNumber: data.contactNumber || "",
                        email: data.email || "",
                        // ✅ Use Cloudinary URL directly, fallback to default avatar
                        profilePic: data.profilePic || images.avatar,
                    });
                    setIdVerificationStatus(data.idVerificationStatus || "pending");
                } else {
                    toast.error("User is not a tenant. Redirecting...");
                    navigate("/");
                }
            } catch (error) {
                console.error("Error fetching dashboard:", error);
                toast.error("Error fetching dashboard data");
                navigate("/");
            }
        };

        fetchDashboardData();
    }, [navigate, isUpdated]);

    const handleLogout = () => {
        logout();
        localStorage.removeItem("user_token");
        toast.success("Logged out successfully");
        navigate("/");
        window.dispatchEvent(new Event("storage"));
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("user_token");

        if (!token) {
            toast.error("No token found. Please log in.");
            navigate("/login");
            return;
        }

        if (passwords.newPassword.length < 8) {
            toast.error("Password must be at least 8 characters long.");
            return;
        }

        try {
            const response = await fetch(buildApi('/users/change-password'), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    currentPassword: passwords.oldPassword,
                    newPassword: passwords.newPassword,
                }),
            });

            if (response.ok) {
                toast.success("Password changed successfully.");
                setPasswords({ oldPassword: "", newPassword: "" });
                setIsUpdated(prev => !prev);
            } else {
                const errorData = await response.json();
                toast.error(`Error: ${errorData.message || "Failed to change password."}`);
            }
        } catch (error) {
            toast.error("Error changing password.");
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("user_token");

        if (!token) {
            toast.error("No token found. Please log in.");
            navigate("/login");
            return;
        }

        const formData = new FormData();
        formData.append("fullName", userData.fullName);
        formData.append("address", userData.address);
        formData.append("barangay", userData.barangay);
        formData.append("contactNumber", userData.contactNumber);
        formData.append("email", userData.email);

        if (userData.profilePic instanceof File) {
            formData.append("profilePic", userData.profilePic);
        }

        try {
            const response = await fetch(buildApi('/users/update-profile'), {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
                body: formData,
            });

            if (response.ok) {
                toast.success("Profile updated successfully.");

                const updatedDataResponse = await fetch(buildApi('/users/tenant-dashboard'), {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                });

                const updatedData = await updatedDataResponse.json();

                if (updatedDataResponse.ok) {
                    setUserData({
                        username: updatedData.username,
                        fullName: updatedData.fullName || "",
                        address: updatedData.address || "",
                        contactNumber: updatedData.contactNumber || "",
                        email: updatedData.email || "",
                        // ✅ Use Cloudinary URL directly, fallback to default avatar
                        profilePic: updatedData.profilePic || images.avatar,
                    });
                    setIsUpdated(prev => !prev);
                } else {
                    toast.error("Failed to fetch updated data.");
                }
            } else {
                toast.error("Failed to update profile.");
            }
        } catch (error) {
            toast.error("Error updating profile.");
        }
    };

    const handleImageChange = (e) => {
        if (e.target.files[0]) {
            setUserData({
                ...userData,
                profilePic: e.target.files[0]
            });
        }
    };

    const handleImageClick = () => {
        document.getElementById("file-input").click();
    };

    return (
        <div className="tenant-dashboard landlord-dashboard dashboard-container">
            <TenantSidebar handleLogout={handleLogout} />
            <div className="landlord-main">
                {role === "tenant" ? (
                    <>
                        <div className="ll-grid">
                            <section className="ll-card" aria-labelledby="tenant-profile-heading">
                                <h2 id="tenant-profile-heading" style={{marginTop:0, fontSize:'1rem'}}>Profile</h2>
                                <form onSubmit={handleProfileUpdate} className="ll-stack ll-gap-md" noValidate>
                                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'0.65rem'}}>
                                        <div className="tenant-avatar" onClick={handleImageClick} role="button" tabIndex={0} aria-label="Change profile picture" onKeyDown={e=>{if(e.key==='Enter') handleImageClick();}}>
                                            <img src={userData.profilePic instanceof File ? URL.createObjectURL(userData.profilePic) : userData.profilePic} alt="Profile" />
                                            <span className="tenant-avatar-badge">Change</span>
                                        </div>
                                        <p className="tenant-username">@{userData.username}</p>
                                        <input id="file-input" type="file" accept="image/*" hidden onChange={handleImageChange} />
                                    </div>
                                    <div className="ll-stack ll-gap-sm">
                                        <label className="ll-label" htmlFor="fullName">Full Name</label>
                                        <input className="ll-field" id="fullName" value={userData.fullName} onChange={e=>setUserData(u=>({...u, fullName:e.target.value}))} required />
                                    </div>
                                    <div className="ll-grid narrow-two">
                                        <div className="ll-stack ll-gap-sm">
                                            <label className="ll-label" htmlFor="address">Address</label>
                                            <input className="ll-field" id="address" value={userData.address} onChange={e=>setUserData(u=>({...u, address:e.target.value}))} required />
                                        </div>
                                        <div className="ll-stack ll-gap-sm">
                                            <label className="ll-label" htmlFor="barangay">Barangay</label>
                                            <select className="ll-field" id="barangay" value={userData.barangay} onChange={e=>setUserData(u=>({...u, barangay:e.target.value}))} required disabled={!!userData.barangay}>
                                                <option value="">Select Barangay</option>
                                                {barangayList.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                        </div>
                                        <div className="ll-stack ll-gap-sm">
                                            <label className="ll-label" htmlFor="contactNumber">Contact Number</label>
                                            <input className="ll-field" id="contactNumber" value={userData.contactNumber} onChange={e=>setUserData(u=>({...u, contactNumber:e.target.value}))} required />
                                        </div>
                                    </div>
                                    <div className="ll-grid narrow-two">
                                        <div className="ll-stack ll-gap-sm">
                                            <label className="ll-label" htmlFor="email">Email Address</label>
                                            <input className="ll-field" id="email" value={userData.email} readOnly disabled />
                                        </div>
                                        <div className="ll-stack ll-gap-sm">
                                            {/* occupation removed per spec */}
                                        </div>
                                    </div>
                                    <div style={{display:'flex',justifyContent:'flex-end'}}>
                                        <button className="ll-btn primary" type="submit">Save Changes</button>
                                    </div>
                                </form>
                            </section>
                            <section className="ll-card" aria-labelledby="tenant-pw-heading">
                                <h2 id="tenant-pw-heading" style={{marginTop:0, fontSize:'1rem'}}>Change Password</h2>
                                <form onSubmit={handlePasswordChange} className="ll-stack ll-gap-md" noValidate>
                                    <div className="ll-stack ll-gap-sm">
                                        <label className="ll-label" htmlFor="oldPassword">Current Password</label>
                                        <input className="ll-field" id="oldPassword" type="password" value={passwords.oldPassword} onChange={e=>setPasswords(p=>({...p, oldPassword:e.target.value}))} required />
                                    </div>
                                    <div className="ll-stack ll-gap-sm">
                                        <label className="ll-label" htmlFor="newPassword">New Password</label>
                                        <input className="ll-field" id="newPassword" type="password" value={passwords.newPassword} onChange={e=>setPasswords(p=>({...p, newPassword:e.target.value}))} required />
                                    </div>
                                    <div style={{display:'flex',justifyContent:'flex-end'}}>
                                        <button type="submit" className="ll-btn danger" disabled={!passwords.newPassword}>Update Password</button>
                                    </div>
                                </form>
                            </section>
                        </div>
                    </>
                ) : (
                    <p>Loading...</p>
                )}
            </div>
        </div>
    );
};

export default TenantDashboard;