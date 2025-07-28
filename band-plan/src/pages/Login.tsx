import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-hot-toast';
import Input from '../components/Input';
import Button from '../components/Button';
import { Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.returnTo;
  const { user, setUser } = useAuthStore();


  useEffect(() => {
    if (user) {
      let redirectTo = returnTo || '/';
      
      // Check if returnTo contains Spotify callback parameters
      if (returnTo && (returnTo.includes('code=') || returnTo.includes('state='))) {
        
        // Extract the Spotify parameters from returnTo
        const returnUrl = new URL(returnTo, window.location.origin);
        const spotifyCode = returnUrl.searchParams.get('code');
        const spotifyState = returnUrl.searchParams.get('state');
        const spotifyError = returnUrl.searchParams.get('error');
        
        if (spotifyCode && spotifyState) {
          // Redirect to root with Spotify parameters
          redirectTo = `/?code=${spotifyCode}&state=${spotifyState}`;
        } else if (spotifyError) {
          redirectTo = `/?error=${spotifyError}`;
        } else {
          // Remove Spotify params from returnTo if they're incomplete
          redirectTo = returnUrl.pathname;
        }
      }
      
      navigate(redirectTo, { replace: true });
    }
  }, [user, returnTo, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setUser(data.user);
      toast.success('Successfully logged in!');
      
      let redirectTo = returnTo || '/';
      
      // Check if returnTo contains Spotify callback parameters
      if (returnTo && (returnTo.includes('code=') || returnTo.includes('state='))) {
        
        // Extract the Spotify parameters from returnTo
        const returnUrl = new URL(returnTo, window.location.origin);
        const spotifyCode = returnUrl.searchParams.get('code');
        const spotifyState = returnUrl.searchParams.get('state');
        const spotifyError = returnUrl.searchParams.get('error');
        
        if (spotifyCode && spotifyState) {
          // Redirect to root with Spotify parameters
          redirectTo = `/?code=${spotifyCode}&state=${spotifyState}`;
        } else if (spotifyError) {
          redirectTo = `/?error=${spotifyError}`;
        } else {
          // Remove Spotify params from returnTo if they're incomplete
          redirectTo = returnUrl.pathname;
        }
      }
      
      navigate(redirectTo, { replace: true });
    } catch (error: any) {
      toast.error(error.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  // If user is already logged in, don't render the login form
  if (user) {
    return null;
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white p-8 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Welcome Back
        </h2>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="your@email.com"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />


          <Button type="submit" loading={loading} fullWidth>
            Sign In
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          <Link to="/forgot-password" className="text-indigo-600 hover:text-indigo-500">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/register" className="text-indigo-600 hover:text-indigo-500">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}