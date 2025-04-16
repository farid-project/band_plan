import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Music2, LogOut } from 'lucide-react';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <nav className="bg-indigo-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <Music2 className="h-8 w-8" />
            <span className="font-bold text-xl">Band Manager</span>
          </Link>
          
          <div className="flex items-center space-x-4">
            {user && <NotificationBell />}
            {user ? (
              <>
                <span className="text-sm">{user.email}</span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-1 hover:text-indigo-200 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <div className="space-x-4">
                <Link to="/login" className="hover:text-indigo-200 transition-colors">
                  Login
                </Link>
                <Link to="/register" className="hover:text-indigo-200 transition-colors">
                  Register
                </Link>
                {import.meta.env.DEV && (
                  <Link 
                    to="/accept-invitation?token=test&member_id=test" 
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Test Invitation
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}