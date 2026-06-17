import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state from sessionStorage on mount
  useEffect(() => {
    const savedToken = sessionStorage.getItem('auth_token');
    if (savedToken) {
      setToken(savedToken);
      fetchUser(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch current user data
  const fetchUser = async (authToken = token) => {
    if (!authToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          logout();
          return;
        }
        throw new Error(`Failed to fetch user: ${response.statusText}`);
      }

      const userData = await response.json();
      setUser(userData);
      setError(null);
    } catch (err) {
      console.error('Error fetching user:', err);
      setError(err.message);
      setUser(null);
      setToken(null);
      sessionStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth login
  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      // Redirect to Google login endpoint
      window.location.href = '/api/v1/auth/google/login';
    } catch (err) {
      console.error('Error initiating Google login:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Development login for testing
  const devLogin = async (email) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/auth/dev/login?email=${encodeURIComponent(email)}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Dev login failed: ${response.statusText}`);
      }

      const data = await response.json();
      const authToken = data.access_token || data.token;
      setToken(authToken);
      sessionStorage.setItem('auth_token', authToken);
      await fetchUser(authToken);
      setError(null);
    } catch (err) {
      console.error('Error with dev login:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Logout
  const logout = (redirect = true) => {
    setUser(null);
    setToken(null);
    setError(null);
    sessionStorage.removeItem('auth_token');
    if (redirect) {
      window.location.href = '/login';
    }
  };

  // Handle auth callback from OAuth redirect
  const handleAuthCallback = () => {
    const params = new URLSearchParams(window.location.search);
    const authToken = params.get('token');

    if (authToken) {
      setToken(authToken);
      sessionStorage.setItem('auth_token', authToken);
      fetchUser(authToken);
      // Clean up URL
      window.history.replaceState({}, document.title, '/');
    }
  };

  const value = {
    user,
    setUser,
    token,
    loading,
    error,
    loginWithGoogle,
    devLogin,
    logout,
    fetchUser,
    handleAuthCallback,
    isAuthenticated: !!token && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
