import { useState } from 'react';
import api from './api';

const ChatIcon = () => (<svg style={{ width: '32px', height: '32px' }} viewBox="0 0 24 24"><path fill="currentColor" d="M12,3C17.5,3 22,6.58 22,11C22,15.42 17.5,19 12,19C10.76,19 9.57,18.82 8.47,18.5C5.55,21 2,21 2,21C4.18,18.83 4.5,17.36 4.5,16.5C3.26,15.16 2.5,13.42 2.5,11.5C2.5,7.08 7,3 12,3M11,14V11H8V13H9.5V14.5L11,14M16,14V11H13V13H14.5V14.5L16,14Z" /></svg>);

function Login({ setUser, switchToRegister }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/login/', { phone, password });
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);
      localStorage.setItem('user_id', res.data.user.id);
      localStorage.setItem('username', res.data.user.username);
      localStorage.setItem('avatar', res.data.user.avatar || ''); // <-- ADD THIS
      setUser({ id: res.data.user.id, username: res.data.user.username, avatar: res.data.user.avatar });
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials. Please try again.');
    }
  };

  const styles = {
    pageContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f0f2f5', fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif' },
    loginCard: { backgroundColor: '#ffffff', padding: '40px', borderRadius: '8px', width: '360px', maxWidth: '90vw', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    iconWrapper: { width: '64px', height: '64px', backgroundColor: '#008069', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', marginBottom: '16px' },
    title: { color: '#111b21', fontSize: '24px', fontWeight: 600, margin: 0, marginBottom: '8px' },
    subtitle: { color: '#667781', fontSize: '14px', margin: 0, marginBottom: '32px' },
    form: { width: '100%', display: 'flex', flexDirection: 'column' },
    inputGroup: { marginBottom: '16px' },
    inputLabel: { fontSize: '12px', color: '#667781', marginBottom: '6px', display: 'block' },
    inputField: { width: '100%', padding: '14px 16px', border: '1px solid #e9edef', borderRadius: '8px', fontSize: '15px', color: '#111b21', backgroundColor: '#f9f9f9', outline: 'none', boxSizing: 'border-box' },
    submitBtn: { width: '100%', padding: '14px', backgroundColor: '#008069', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '8px', boxShadow: '0 2px 5px rgba(0,128,105,0.3)' },
    errorText: { color: '#f15c6d', fontSize: '13px', textAlign: 'center', marginBottom: '16px', padding: '10px', backgroundColor: '#fdecee', borderRadius: '6px', width: '100%', boxSizing: 'border-box' },
    switchText: { marginTop: '24px', fontSize: '14px', color: '#667781', textAlign: 'center' },
    switchLink: { color: '#008069', fontWeight: 600, cursor: 'pointer', marginLeft: '4px' }
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.loginCard}>
        <div style={styles.iconWrapper}><ChatIcon /></div>
        <h2 style={styles.title}>WhatsApp Lite</h2>
        <p style={styles.subtitle}>Please log in to continue</p>
        {error && <div style={styles.errorText}>{error}</div>}
        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.inputLabel}>Phone Number</label>
            <input style={styles.inputField} type="tel" placeholder="+1234567890" value={phone} onChange={e => setPhone(e.target.value)} required />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.inputLabel}>Password</label>
            <input style={styles.inputField} type="password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button style={styles.submitBtn} type="submit">Login</button>
        </form>
        <div style={styles.switchText}>
          Don't have an account?<span style={styles.switchLink} onClick={switchToRegister}>Register</span>
        </div>
      </div>
    </div>
  );
}

export default Login;