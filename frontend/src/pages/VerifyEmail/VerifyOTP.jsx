import React, { useState, useEffect } from 'react';
import './VerifyOTP.css';
import { ToastContainer, toast } from 'react-toastify';
import { buildApi } from '../../services/apiConfig';
import 'react-toastify/dist/ReactToastify.css';

const VerifyOTP = () => {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(120); // 2-minute timer (120 seconds)
    const [canResend, setCanResend] = useState(false);
    const email = localStorage.getItem('user_email'); // Retrieve stored email
    const inputRefs = Array(6).fill(null).map(() => React.createRef());

    useEffect(() => {
        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanResend(true);
        }
    }, [timeLeft]);

    // Handle OTP input changes
    const handleChange = (index, value) => {
        if (!/\d?/.test(value)) return; // Ensure only numbers are entered
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            inputRefs[index + 1].current.focus();
        }
    };

    // Handle backspace navigation
    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs[index - 1].current.focus();
        }
    };

    useEffect(() => {
        if (inputRefs[0].current) inputRefs[0].current.focus();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const otpCode = otp.join('');

        try {
            const response = await fetch(buildApi('/auth/verify-otp'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp: otpCode }),
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.msg || 'Invalid OTP. Please try again.');

            toast.success('OTP Verified! Redirecting...');
            localStorage.removeItem('user_email');
            setTimeout(() => window.location.href = '/login', 2000);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        try {
            const response = await fetch(buildApi('/auth/resend-otp'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.msg || 'Error resending OTP.');
            
            toast.success('OTP resent successfully! Check your email.');
            setTimeLeft(120); // Reset timer
            setCanResend(false);
        } catch (error) {
            toast.error(error.message);
        }
    };

    return (
        <div className="verify-otp-page">
            <div className="verify-otp-container">
                <h1>Verify OTP</h1>
                <p>Enter the 6-digit OTP sent to <strong>{email}</strong></p>
                <form className="verify-otp-form" onSubmit={handleSubmit}>
                    <div className="otp-inputs">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                type="text"
                                maxLength="1"
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, index)}
                                ref={inputRefs[index]}
                            />
                        ))}
                    </div>
                    <p className="otp-timer">{timeLeft > 0 ? `Time left: ${Math.floor(timeLeft / 60)}:${('0' + (timeLeft % 60)).slice(-2)}` : 'OTP Expired'}</p>
                    <button type="submit" disabled={loading || timeLeft === 0}>
                        {loading ? 'Verifying...' : 'Verify OTP'}
                    </button>
                </form>
                {canResend && (
                    <button className="resend-otp" onClick={handleResendOTP}>Resend OTP</button>
                )}
            </div>
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
        </div>
    );
};

export default VerifyOTP;