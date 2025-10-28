import React from 'react';
import './TermPopup.css';

const TermPopup = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="term-popup-overlay">
            <div className="term-popup">
                <div className="terms-text">
                  <p><strong>Terms & Agreement</strong></p>
                  <p>By using our platform, you agree to the following terms and conditions:</p>

                  <p>1. Eligibility - You must be at least 18 years old to register.</p>

                  <p>2. Data Privacy - Your data will be stored securely and used according to our privacy policy.</p>

                  <p>3. Account Responsibility - You agree not to misuse the service or engage in fraudulent activity.</p>

                  <p>4. 360° Image Upload Policy - Every property listing includes 
                     <strong> 1 free </strong> 360° image upload. 
                     Uploading <strong> more than 1 </strong> 360° image will require a small payment
                     to help support hosting and system maintenance.</p>

                  <p>5. Prohibited Activities - Some content and actions are not allowed and
                     may be reviewed by our moderation team.</p>

                  <p>6. Service Modifications - We may update our services, pricing,
                     and policies when necessary.</p>

                  <p>7. Compliance - Continued use of our platform means you accept any future updates to these terms.</p>

                  <div style={{ marginTop: 12 }}>
                    <button className="close-btn" onClick={onClose}>Close</button>
                  </div>
                </div>
            </div>
        </div>
    );
};

export default TermPopup;
