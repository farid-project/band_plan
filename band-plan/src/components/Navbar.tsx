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
          <Link to="/" className="flex items-center space-x-2 min-w-0">
            <Music2 className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0" />
            <span className="font-bold text-lg sm:text-xl truncate">Band Manager</span>
          </Link>
          
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
            {user && <NotificationBell />}
            {user ? (
              <>
                <span className="text-xs sm:text-sm hidden md:block truncate max-w-32 lg:max-w-none">{user.email}</span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-1 hover:text-indigo-200 transition-colors"
                >
                  <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            ) : (
              <div className="flex space-x-2 sm:space-x-4">
                <Link to="/login" className="hover:text-indigo-200 transition-colors text-sm sm:text-base">
                  Login
                </Link>
                <Link to="/register" className="hover:text-indigo-200 transition-colors text-sm sm:text-base">
                  Register
                </Link>
                {import.meta.env.DEV && (
                  <Link 
                    to="/accept-invitation?token=test&member_id=test" 
                    className="text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hidden lg:block"
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