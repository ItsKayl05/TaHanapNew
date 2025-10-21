import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import validator from "validator";
import { buildApi } from '../../services/apiConfig';
import { AiOutlineMail, AiOutlineLock, AiOutlineEye, AiOutlineEyeInvisible, AiOutlineReload } from 'react-icons/ai';
import "./ForgotPassword.css";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [showPwd, setShowPwd] = useState(false);
    const [showConfirmPwd, setShowConfirmPwd] = useState(false);
    const [pwdScore, setPwdScore] = useState(0); // 0-100 simple heuristic
    const [resendTimer, setResendTimer] = useState(0);

    // Timer countdown for resend OTP
    useEffect(()=>{
        if(resendTimer <= 0) return;
        const t = setTimeout(()=> setResendTimer(s => s-1), 1000);
        return ()=> clearTimeout(t);
    },[resendTimer]);

    const normalizeEmail = e => e.trim().toLowerCase();

    const isValidPassword = (pwd) => validator.isStrongPassword(pwd, {
        minLength:8, minLowercase:1, minUppercase:1, minNumbers:1, minSymbols:1
    });

    // Lightweight password scoring for visual meter
    useEffect(()=>{
        const pwd = newPassword;
        if(!pwd){ setPwdScore(0); return; }
        let score = 0;
        if(pwd.length >= 8) score += 25;
        if(/[A-Z]/.test(pwd)) score += 20;
        if(/[0-9]/.test(pwd)) score += 20;
        if(/[^A-Za-z0-9]/.test(pwd)) score += 20;
        if(pwd.length >= 14) score += 15;
        if(score > 100) score = 100;
        setPwdScore(score);
    },[newPassword]);

    const handleSendOtp = async () => {
        if(!email){ toast.error("Enter your email"); return; }
        setSendingOtp(true);
        try {
            const res = await axios.post(buildApi('/auth/forgot-password'), { email: normalizeEmail(email) });
            toast.success(res.data.msg || 'OTP sent');
            setOtpSent(true);
            setResendTimer(60); // 60s cooldown
        } catch(err){
            toast.error(err.response?.data?.msg || 'Failed to send OTP');
        } finally { setSendingOtp(false); }
    };

    const handleReset = async () => {
        if(!otp || !newPassword || !confirmPassword){ toast.error('Complete all fields'); return; }
        if(!isValidPassword(newPassword)){ toast.error('Password must include upper, lower, number & symbol (min 8)'); return; }
        if(newPassword !== confirmPassword){ toast.error('Passwords do not match'); return; }
        setResetLoading(true);
        try {
            const res = await axios.post(buildApi('/auth/reset-password'), { email: normalizeEmail(email), otp, newPassword });
            toast.success(res.data.msg || 'Password reset');
            setTimeout(()=> window.location.href = '/login', 1600);
        } catch(err){
            toast.error(err.response?.data?.msg || 'Reset failed');
        } finally { setResetLoading(false); }
    };

    const strengthLabel = pwdScore >= 80 ? 'Strong' : pwdScore >= 55 ? 'Medium' : pwdScore > 0 ? 'Weak' : '';

    return (
        <div className="forgot-page with-illustration">
            <div className="auth-illustration" aria-hidden="true">
                <picture className="illu-art">
                    <source srcSet="/auth-hero.svg" type="image/svg+xml" />
                    <img src="/auth-hero.svg" alt="Decorative abstract housing illustration" loading="lazy" />
                </picture>
                <div className="illu-inner">
                    <h2>Reset Access</h2>
                    <p>Enter your email to receive a secure one‑time code and set a new password. Keep your account protected with a strong passphrase.</p>
                </div>
            </div>
            <div className="auth-form-wrap">
                <h1>Password Recovery</h1>
                <form className="forgot-form" onSubmit={(e)=> e.preventDefault()} noValidate>
                    <div className="input-group">
                        <label htmlFor="fp-email">Email</label>
                        <div className="input-wrapper">
                            <AiOutlineMail size={20} />
                            <input id="fp-email" type="email" value={email} disabled={otpSent} onChange={e=> setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
                        </div>
                    </div>
                    {!otpSent && (
                        <button type="button" className="action-btn" onClick={handleSendOtp} disabled={sendingOtp} aria-busy={sendingOtp}>
                            {sendingOtp ? 'Sending OTP…' : 'Send OTP'}
                        </button>
                    )}
                    {otpSent && (
                        <>
                            <div className="otp-row">
                                <div className="input-group">
                                    <label htmlFor="fp-otp">OTP Code</label>
                                    <div className="input-wrapper">
                                        <AiOutlineReload size={20} />
                                        <input id="fp-otp" type="text" value={otp} onChange={e=> setOtp(e.target.value)} placeholder="6-digit code" required autoComplete="one-time-code" />
                                    </div>
                                </div>
                                <div className="resend-wrap">
                                    <button type="button" className="resend-btn" onClick={handleSendOtp} disabled={resendTimer>0 || sendingOtp}>
                                        {resendTimer>0 ? `Resend in ${resendTimer}s` : 'Resend'}
                                    </button>
                                </div>
                            </div>
                            <div className="input-group full">
                                <label htmlFor="fp-new">New Password</label>
                                <div className="input-wrapper password-wrapper">
                                    <AiOutlineLock size={20} />
                                    <input id="fp-new" type={showPwd? 'text':'password'} value={newPassword} onChange={e=> setNewPassword(e.target.value)} placeholder="New password" required autoComplete="new-password" />
                                    <button type="button" className="toggle-visibility" aria-label={showPwd? 'Hide password':'Show password'} onClick={()=> setShowPwd(p=>!p)}>
                                        {showPwd? <AiOutlineEyeInvisible size={20} /> : <AiOutlineEye size={20} />}
                                    </button>
                                </div>
                                {newPassword && (
                                    <div className="pwd-strength" aria-live="polite">
                                        <div className={`meter meter-${strengthLabel.toLowerCase()}`}> <span style={{width: `${pwdScore}%`}} /> </div>
                                        <div className="meter-label">{strengthLabel}</div>
                                    </div>
                                )}
                            </div>
                            <div className="input-group full">
                                <label htmlFor="fp-confirm">Confirm Password</label>
                                <div className="input-wrapper password-wrapper">
                                    <AiOutlineLock size={20} />
                                    <input id="fp-confirm" type={showConfirmPwd? 'text':'password'} value={confirmPassword} onChange={e=> setConfirmPassword(e.target.value)} placeholder="Repeat password" required autoComplete="new-password" />
                                    <button type="button" className="toggle-visibility" aria-label={showConfirmPwd? 'Hide password':'Show password'} onClick={()=> setShowConfirmPwd(p=>!p)}>
                                        {showConfirmPwd? <AiOutlineEyeInvisible size={20} /> : <AiOutlineEye size={20} />}
                                    </button>
                                </div>
                            </div>
                            <button type="button" className="action-btn" onClick={handleReset} disabled={resetLoading} aria-busy={resetLoading}>
                                {resetLoading ? 'Resetting…' : 'Reset Password'}
                            </button>
                        </>
                    )}
                    <div className="alt-hint">Remembered your password? <a href="/login">Back to Login</a></div>
                </form>
            </div>
            <ToastContainer position="top-right" autoClose={3200} hideProgressBar />
            <div className="sr-only" aria-live="polite">{sendingOtp || resetLoading ? 'Processing' : ''}</div>
        </div>
    );
};

export default ForgotPassword;
