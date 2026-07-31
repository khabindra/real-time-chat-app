import { useState, useEffect } from 'react';
import api from './api';
import Login from './Login';
import Register from './Register';
import Chat from './Chat';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      api.get('/users/')
        .then(() => {
          setUser({ 
            id: localStorage.getItem('user_id'), 
            username: localStorage.getItem('username'),
            avatar: localStorage.getItem('avatar') // <-- ADD THIS
          });
        })
        .catch(() => localStorage.removeItem('access_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      {user ? (
        <Chat user={user} setUser={setUser} />
      ) : showRegister ? (
        <Register setUser={setUser} switchToLogin={() => setShowRegister(false)} />
      ) : (
        <Login setUser={setUser} switchToRegister={() => setShowRegister(true)} />
      )}
    </div>
  );
}

export default App;