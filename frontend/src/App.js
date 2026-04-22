import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import api from './api/client';
import { auth } from './firebase';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        localStorage.removeItem('carbonGamifiedUser');
        setLoading(false);
        return;
      }

      try {
        const response = await api.post('/api/auth/session', {
          name: firebaseUser.displayName || '',
          profilePicture: firebaseUser.photoURL || null
        });

        if (response.data?.success) {
          const userData = response.data.user || {};
          const normalized = {
            ...userData,
            userId: response.data.userId || userData.uid || firebaseUser.uid,
            uid: userData.uid || firebaseUser.uid,
            email: userData.email || firebaseUser.email,
            name: userData.name || firebaseUser.displayName || 'User',
            profilePicture: userData.profilePicture || firebaseUser.photoURL || null
          };
          setUser(normalized);
          localStorage.setItem('carbonGamifiedUser', JSON.stringify(normalized));
        } else {
          setUser(null);
          localStorage.removeItem('carbonGamifiedUser');
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
        await signOut(auth).catch(() => null);
        setUser(null);
        localStorage.removeItem('carbonGamifiedUser');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (loginResponse) => {
    const userData = loginResponse.user || loginResponse;
    const normalized = {
      ...userData,
      userId: userData.userId || userData.uid || userData.id
    };
    setUser(normalized);
    localStorage.setItem('carbonGamifiedUser', JSON.stringify(normalized));
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('carbonGamifiedUser');
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        {user ? (
          <Dashboard user={user} onLogout={handleLogout} />
        ) : (
          <LoginPage onLogin={handleLogin} />
        )}
      </div>
    </div>
  );
}

export default App;
