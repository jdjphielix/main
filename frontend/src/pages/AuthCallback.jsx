import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader } from 'lucide-react';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleAuthCallback } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract token from URL search params
        const token = searchParams.get('token');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(error);
        }

        if (!token) {
          throw new Error('Missing token in callback');
        }

        // Store token in sessionStorage
        sessionStorage.setItem('auth_token', token);

        // Use auth context's callback handler
        handleAuthCallback();

        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('Auth callback error:', err);
        // Redirect to login on error
        navigate('/login', { replace: true });
      }
    };

    handleCallback();
  }, [searchParams, navigate, handleAuthCallback]);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-off-white dark:bg-gray-900">
      <div className="text-center space-y-4">
        <Loader size={48} className="animate-spin text-taper-blue mx-auto" />
        <h2 className="text-2xl font-heading font-bold text-navy dark:text-white">
          Authenticating...
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Please wait while we complete your sign-in.
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;
