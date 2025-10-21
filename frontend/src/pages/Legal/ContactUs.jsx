import React, { useState } from 'react';

const ContactUs = () => {
  const [form,setForm] = useState({ name:'', email:'', message:'' });
  const [status,setStatus] = useState('idle');

  const handleChange = e => setForm(f=> ({ ...f, [e.target.name]: e.target.value }));
  const canSend = form.name.trim() && form.email.trim() && form.message.trim();

  const handleSubmit = async e => {
    e.preventDefault();
    if(!canSend) return;
    setStatus('sending');
    try {
      // Placeholder: integrate backend endpoint /api/support/contact later
      await new Promise(r=> setTimeout(r, 600));
      setStatus('sent');
      setForm({ name:'', email:'', message:'' });
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="legal-page">
      <h1>Contact Us</h1>
      <p>Questions, feedback, or issues? Reach out using the form below.</p>
      <form className="contact-form" onSubmit={handleSubmit} noValidate>
        <label>Name
          <input name="name" value={form.name} onChange={handleChange} required />
        </label>
        <label>Email
          <input type="email" name="email" value={form.email} onChange={handleChange} required />
        </label>
        <label>Message
          <textarea name="message" rows={5} value={form.message} onChange={handleChange} required />
        </label>
        <button type="submit" disabled={!canSend || status==='sending'}>
          {status==='sending' ? 'Sending...' : status==='sent' ? 'Sent!' : 'Send Message'}
        </button>
        {status==='error' && <p className="error">Failed to send. Try again later.</p>}
      </form>
      <section className="alt-contact">
        <h2>Other ways</h2>
        <p>Email: <a href="mailto:support@propertyfinder.test">support@propertyfinder.test</a></p>
        <p>For legal or privacy inquiries use: <a href="mailto:privacy@propertyfinder.test">privacy@propertyfinder.test</a></p>
      </section>
    </div>
  );
};

export default ContactUs;
