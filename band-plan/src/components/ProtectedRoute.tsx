import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  console.log('ProtectedRoute mounted');
  const { user } = useAuthStore();
  const location = useLocation();
  
  console.log('ProtectedRoute check:', { user, currentPath: location.pathname });

  if (!user) {
    console.log('No user in ProtectedRoute, redirecting to login');
    return <Navigate 
      to="/login" 
      state={{ returnTo: location.pathname + location.search }}
      replace
    />;
  }

  return <>{children}</>;
}