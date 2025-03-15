import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import useSocket from '../hooks/useSocket';

const Home = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [currentDownload, setCurrentDownload] = useState(null);
  const [error, setError] = useState('');
  const { connected, downloadStatus, downloadProgress, downloadYouTubeVideo } = useSocket();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleDownload = async (e) => {
    e.preventDefault();
    setError('');
    
    // Basic validation
    if (!youtubeUrl) {
      setError('Please enter a YouTube URL');
      return;
    }
    
    try {
      const result = await downloadYouTubeVideo(youtubeUrl);
      setCurrentDownload(result.downloadId);
      setYoutubeUrl('');
    } catch (err) {
      setError(err.message || 'Failed to start download');
    }
  };

  // Get current download status and progress
  const currentStatus = currentDownload ? downloadStatus[currentDownload] : null;
  const currentProgress = currentDownload ? downloadProgress[currentDownload] : null;

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
        <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Welcome to XVibe</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              You are now logged in! Check out the data dashboard to see detailed insights.
            </p>
            
            <div className="mt-6">
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="mr-2 -ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                View Dashboard
              </button>
            </div>
          </div>
        </div>
        
        {/* YouTube Downloader */}
        <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">YouTube Video Downloader</h2>
            
            <form onSubmit={handleDownload} className="space-y-4">
              <div>
                <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  YouTube URL
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="youtube-url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-md p-2"
                  />
                </div>
              </div>
              
              {error && (
                <p className="text-red-600 text-sm mt-1">{error}</p>
              )}
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!connected || currentStatus?.status === 'started'}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${connected ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
                >
                  {!connected ? 'Connecting...' : 'Download Video'}
                </button>
              </div>
            </form>
            
            {/* Download Status */}
            {currentDownload && (
              <div className="mt-6">
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">Download Status</h3>
                
                <div className="bg-gray-100 dark:bg-slate-700 p-4 rounded-md">
                  {currentStatus?.status === 'started' && (
                    <>
                      <p className="text-gray-700 dark:text-gray-300">{currentStatus.message}</p>
                      {currentProgress && (
                        <div className="mt-2">
                          <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-600" 
                              style={{ width: `${currentProgress.progress}%` }}
                            ></div>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {currentProgress.message}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  
                  {currentStatus?.status === 'completed' && (
                    <div className="text-green-600 dark:text-green-400">
                      <p>{currentStatus.message}</p>
                      <p className="text-sm mt-1">File saved as: {currentStatus.filename}</p>
                    </div>
                  )}
                  
                  {currentStatus?.status === 'error' && (
                    <p className="text-red-600 dark:text-red-400">{currentStatus.message}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;