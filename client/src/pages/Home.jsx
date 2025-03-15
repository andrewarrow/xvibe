import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-4xl font-bold text-center mb-8">Welcome to XVibe</h1>
          <p className="text-gray-600 dark:text-gray-300 text-center mb-8">
            Sign in or create an account to get started
          </p>
          
          <div className="flex flex-col gap-4">
            <button 
              onClick={() => navigate('/login')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
            >
              Login
            </button>
            
            <button
              onClick={() => navigate('/register')} 
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
            >
              Register
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">XVibe</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 dark:text-gray-300">Welcome, {user?.username}</span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Dashboard</h2>
            <p className="text-gray-600 dark:text-gray-300">
              You are now logged in to XVibe!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;