import React, { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import api from '../api/client';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from '../firebase';
import './LoginPage.css';

const showDemoLogin =
  process.env.NODE_ENV !== 'production' || process.env.REACT_APP_ENABLE_DEMO_LOGIN === 'true';

const LoginPage = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const establishSession = async (firebaseUser, overrides = {}) => {
    if (!firebaseUser) {
      throw new Error('Missing authenticated user');
    }

    const response = await api.post('/api/auth/session', {
      name: overrides.name || firebaseUser.displayName || '',
      profilePicture: overrides.profilePicture || firebaseUser.photoURL || null
    });

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Could not establish authenticated session');
    }

    const userData = response.data.user || {};
    onLogin({
      ...userData,
      userId: response.data.userId || userData.uid || firebaseUser.uid,
      uid: userData.uid || firebaseUser.uid,
      email: userData.email || firebaseUser.email,
      name: userData.name || firebaseUser.displayName || overrides.name || 'User',
      profilePicture: userData.profilePicture || firebaseUser.photoURL || null
    });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await signInWithPopup(auth, googleProvider);
      await establishSession(result.user);
    } catch (error) {
      console.error('Google sign in error:', error);
      setError(error.response?.data?.message || error.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        await establishSession(userCredential.user);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        if (formData.name.trim()) {
          await updateProfile(userCredential.user, { displayName: formData.name.trim() });
        }
        await establishSession(userCredential.user, { name: formData.name.trim() });
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setFormData({ email: '', password: '', name: '' });
  };

  const useDemo = () => {
    setFormData({
      email: 'demo@test.com',
      password: 'Demo123!',
      name: 'Demo User'
    });
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>Carbon Tracker</h1>
          <p>Track your daily carbon footprint and make eco-conscious choices</p>
        </div>

        <div className="login-card">
          <h2>{isLogin ? 'Welcome back' : 'Create an account'}</h2>

          <form onSubmit={handleSubmit} className="login-form">
            {!isLogin && (
              <div className="form-group">
                <label className="form-label" htmlFor="signup-name">
                  Name
                </label>
                <input
                  id="signup-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input"
                  placeholder="Your name"
                  required={!isLogin}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="auth-email">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="input"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="auth-password">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>

            {error && <div className="error">{error}</div>}

            <div className="divider">
              <span>or</span>
            </div>

            <button 
              type="button" 
              className="btn google-btn" 
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <span className="google-icon">G</span>
              {loading ? 'Signing in…' : 'Continue with Google'}
            </button>

            <button type="submit" className="btn login-btn" disabled={loading}>
              {loading ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}
            </button>
          </form>

          <div className="login-footer">
            <button type="button" className="btn-link" onClick={toggleMode}>
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
            </button>

            {showDemoLogin ? (
              <button type="button" className="btn-link demo-btn" onClick={useDemo}>
                Use demo account
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
