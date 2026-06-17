import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader } from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const { loginWithGoogle, devLogin, loading, isAuthenticated } = useAuth();
  const [devEmail, setDevEmail] = useState('');
  const [error, setError] = useState('');

  // Redirect to dashboard when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Seeded test users
  const devUsers = [
    { email: 'jp@taperpay.com', name: 'Joost P.', role: 'Admin Pay' },
    { email: 'jvl@taperpay.com', name: 'Jurgen v.L.', role: 'Admin Trade' },
    { email: 'sales1@taperpay.com', name: 'Thomas K.', role: 'Sales' },
    { email: 'sales2@taperpay.com', name: 'Lisa M.', role: 'Teamleader' },
    { email: 'backoffice@taperpay.com', name: 'Anna B.', role: 'Backoffice' },
  ];

  const handleGoogleLogin = async () => {
    setError('');
    try {
      await loginWithGoogle();
      // Google login redirects, so we don't navigate here
    } catch (err) {
      setError('Google sign-in failed. Please try again.');
      console.error('Google login error:', err);
    }
  };

  const handleDevLogin = async (e) => {
    e.preventDefault();
    if (!devEmail) {
      setError('Email is required');
      return;
    }

    setError('');
    try {
      await devLogin(devEmail);
      navigate('/dashboard');
    } catch (err) {
      setError(
        err.message ||
        'Login failed. Please try again.'
      );
      console.error('Dev login error:', err);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Background Video */}
      <video
        autoPlay
        muted
        loop
        className="absolute inset-0 w-full h-full object-cover"
        src="/fotos/globe-hero.mp4"
      />

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" />

      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in">
          {/* Glass Card */}
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl shadow-popup border border-white/20 dark:border-gray-800/20 p-10 space-y-8">
            {/* Logo Section */}
            <div className="flex justify-center">
              <img
                src="/branding/Logos/Taper - Logo - Vierkant - V3.png"
                alt="Taper Logo"
                className="h-32 w-auto object-contain animate-slide-up"
                style={{ animationDelay: '100ms' }}
              />
            </div>

            {/* Title Section */}
            <div className="text-center space-y-3 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <h1 className="text-3xl font-heading font-bold text-navy dark:text-white">
                Taper® {'Backoffice'}
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">
                {'Bringing back how banking should have been.'}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400 text-sm animate-slide-up">
                {error}
              </div>
            )}

            {/* Google Sign In */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-taper-blue hover:bg-blue-light active:shadow-lg text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-card hover:shadow-popup animate-slide-up"
              style={{ animationDelay: '300ms' }}
            >
              {loading ? (
                <Loader size={20} className="animate-spin" />
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {'Continue with Google'}
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative animate-slide-up" style={{ animationDelay: '400ms' }}>
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                  {'Development'}
                </span>
              </div>
            </div>

            {/* Dev Login - Quick User Select */}
            <div className="space-y-3 animate-slide-up" style={{ animationDelay: '500ms' }}>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 text-center uppercase tracking-wider">
                {'Select test user'}
              </p>
              <div className="space-y-2">
                {devUsers.map((devUser) => (
                  <button
                    key={devUser.email}
                    onClick={async () => {
                      try {
                        setError('');
                        const resp = await fetch(`/api/v1/auth/dev/login?email=${encodeURIComponent(devUser.email)}`, { method: 'POST' });
                        if (!resp.ok) throw new Error('Login failed');
                        const data = await resp.json();
                        const authToken = data.access_token || data.token;
                        sessionStorage.setItem('auth_token', authToken);
                        window.location.href = '/dashboard';
                      } catch (err) {
                        setError(err.message || 'Login failed');
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-blue-pale dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl transition-all duration-200 disabled:opacity-50 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-taper-blue/10 dark:bg-taper-blue/20 flex items-center justify-center text-taper-blue font-bold text-sm">
                        {devUser.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white group-hover:text-taper-blue transition-colors">
                          {devUser.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{devUser.email}</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                      {devUser.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 animate-slide-up" style={{ animationDelay: '600ms' }}>
              {'Secure connection • Encrypted data'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
