import React from 'react';
import './TermPopup.css';

const TermPopup = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="term-popup-overlay">
            <div className="term-popup">
                <h2>Terms & Agreement</h2>
                <p>By signing up, you agree to our terms and conditions...</p>
                <p><strong>1. Eligibility</strong> - You must be at least 18 years old to register.</p>
                <p><strong>2. Data Privacy</strong> - Your data will be stored securely and used according to our privacy policy.</p>
                <p><strong>3. Account Responsibility</strong> - You agree not to misuse the service or engage in fraudulent activity.</p>
                <p><strong>4. Prohibited Activities</strong> - The terms may be updated periodically.</p>
                <p><strong>5. Service Modifications</strong> - We reserve the right to update or modify our services, including terms and policies, as needed.</p>
                <p><strong>6. Compliance</strong> - Continued use of our platform means you accept any future updates to these terms.</p>
                <button onClick={onClose}>Close</button>
            </div>
        </div>
    );
};

export default TermPopup;
