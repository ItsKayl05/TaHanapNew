import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./RegisterPage.css";
import TermPopup from "../../components/TermPopup/TermPopup";
import { 
    AiOutlineUser, AiOutlineMail, AiOutlineLock, AiOutlineEye, 
    AiOutlineEyeInvisible, AiOutlineHome, AiOutlinePhone, AiOutlineIdcard, AiOutlineEnvironment 
} from "react-icons/ai";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import zxcvbn from "zxcvbn";
import { buildApi } from '../../services/apiConfig';

const RegisterPage = () => {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        username: "",
        email: "",
        fullName: "",
        address: "",
        contactNumber: "",
        password: "",
        role: "tenant",
        termsAccepted: false
    });

    const [passwordVisible, setPasswordVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [isPopupOpen, setIsPopupOpen] = useState(false); // State for terms popup

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));

        if (name === "password") {
            setPasswordStrength(zxcvbn(value).score);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
      
        if (!formData.termsAccepted) {
          toast.error("You must accept the terms and agreement.");
          setLoading(false);
          return;
        }
      
        try {
          const response = await fetch(buildApi('/auth/register'), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
      
          const data = await response.json();
          if (!response.ok) throw new Error(data.msg || "Registration failed.");
      
          toast.success("OTP sent to your email. Please verify.");
          localStorage.setItem("user_email", formData.email);
      
          setTimeout(() => navigate("/verify-otp"), 2000);
        } catch (error) {
          console.error('Fetch error:', error); // Log fetch errors
          setError(error.message);
          toast.error(error.message);
        } finally {
          setLoading(false);
        }
      };

    return (
        <div className="register-page with-illustration">
            <div className="auth-illustration" aria-hidden="true">
                <picture className="illu-art">
                    <source srcSet="/auth-hero.svg" type="image/svg+xml" />
                    <img src="/auth-hero.svg" alt="Decorative abstract housing illustration" loading="lazy" />
                </picture>
                <div className="illu-inner">
                    <h2>Find Your Next Home</h2>
                    <p>Register now to save favorites, contact landlords, and manage your rentals effortlessly.</p>
                </div>
            </div>
            <div className="auth-form-wrap">
            <h1>Sign Up</h1>
            <form className="register-form" onSubmit={handleSubmit}>
                {error && <div className="error-message">{error}</div>}

                <div className="input-group">
                    <label htmlFor="username">Username</label>
                    <div className="input-wrapper">
                        <AiOutlineUser size={20} color="#777" />
                        <input
                            type="text"
                            name="username"
                            id="username"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="Username"
                            autoComplete="username"
                        />
                    </div>
                </div>

                <div className="input-group">
                    <label htmlFor="fullName">Full Name</label>
                    <div className="input-wrapper">
                        <AiOutlineIdcard size={20} color="#777" />
                        <input
                            type="text"
                            name="fullName"
                            id="fullName"
                            value={formData.fullName}
                            onChange={handleChange}
                            placeholder="Full Name"
                            autoComplete="name"
                        />
                    </div>
                </div>

                <div className="input-group">
                    <label htmlFor="email">Email</label>
                    <div className="input-wrapper">
                        <AiOutlineMail size={20} color="#777" />
                        <input
                            type="email"
                            name="email"
                            id="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="Email"
                            autoComplete="email"
                        />
                    </div>
                </div>

                <div className="input-group">
                    <label htmlFor="address">Address</label>
                    <div className="input-wrapper">
                        <AiOutlineEnvironment size={20} color="#777" />
                        <input
                            type="text"
                            name="address"
                            id="address"
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="Address"
                            autoComplete="address"
                        />
                    </div>
                </div>

                <div className="input-group">
                    <label htmlFor="role">Select Role</label>
                    <div className="input-wrapper">
                        {formData.role === "tenant" ? (
                            <AiOutlineUser size={20} color="#777" />
                        ) : (
                            <AiOutlineHome size={20} color="#777" />
                        )}
                        <select name="role" id="role" value={formData.role} onChange={handleChange}>
                            <option value="tenant">Tenant</option>
                            <option value="landlord">Landlord</option>
                        </select>
                    </div>
                </div>

                <div className="input-group">
                    <label htmlFor="contactNumber">Contact Number</label>
                    <div className="input-wrapper">
                        <AiOutlinePhone size={20} color="#777" />
                        <input
                            type="tel"
                            name="contactNumber"
                            id="contactNumber"
                            value={formData.contactNumber}
                            onChange={handleChange}
                            placeholder="Contact Number"
                            autoComplete="tel"
                        />
                    </div>
                </div>

                <div className="input-group full">
                    <label htmlFor="password">Password</label>
                    <div className="input-wrapper">
                        <AiOutlineLock size={20} color="#777" />
                        <input
                            type={passwordVisible ? "text" : "password"}
                            name="password"
                            id="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Password"
                            autoComplete="new-password"
                        />
                        <div className="eye-icon" onClick={() => setPasswordVisible(!passwordVisible)}>
                            {passwordVisible ? <AiOutlineEyeInvisible size={20} color="#777" /> : <AiOutlineEye size={20} color="#777" />}
                        </div>
                    </div>
                    {formData.password && (
                        <div className="password-strength">
                            <progress value={passwordStrength} max={4}></progress>
                        </div>
                    )}
                </div>

                <div className="input-group full">
                    <label>
                        <input
                            type="checkbox"
                            name="termsAccepted"
                            checked={formData.termsAccepted}
                            onChange={handleChange}
                        />
                        ‎ I accept the <span className="terms-link" onClick={() => setIsPopupOpen(true)}>Terms & Agreement</span>
                    </label>
                </div>

                <button className="register-btn" type="submit" disabled={loading}>
                    {loading ? "Signing Up..." : "Sign Up"}
                </button>

                <div className="signup-link">
                    Already have an account? <a href="/login">Log In</a>
                </div>
            </form>
            </div>

            <TermPopup isOpen={isPopupOpen} onClose={() => setIsPopupOpen(false)} />

            <ToastContainer position="top-right" autoClose={5000} hideProgressBar />
        </div>
    );
};

export default RegisterPage;