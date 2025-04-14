import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Dashboard from '../pages/Dashboard';

export default function PasswordResetHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  useEffect(() => {
    // Check if there's a code parameter in the URL (password reset flow)
    const searchParams = new URLSearchParams(location.search);
    const code = searchParams.get('code');
    
    if (code) {
      // Instead of trying to verify the token, let's redirect to a custom page
      // that handles password reset in a simpler way
      console.log('Code detected in URL, redirecting to manual password reset page');
      
      // Redirect to a simplified password reset page
      navigate('/update-password-manual', { 
        replace: true,
        state: { resetCode: code }
      });
      return;
    }
    
    // If no code is present and the user is not logged in, redirect to login
    if (!user && !code && location.pathname === '/') {
      navigate('/login', { replace: true });
    }
  }, [location, navigate, user]);

  // If there's no code, render the normal dashboard if user is logged in
  if (user) {
    return <Dashboard />;
  }
  
  // This is just a loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );
}
