import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import useSocket from '../hooks/useSocket';
import useVideos from '../hooks/useVideos';

const Home = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [currentDownload, setCurrentDownload] = useState(null);
  const [currentConversion, setCurrentConversion] = useState(null);
  const [error, setError] = useState('');
  const { 
    connected, 
    downloadStatus, 
    downloadProgress, 
    conversionStatus,
    conversionProgress,
    downloadYouTubeVideo,
    convertVideoToMp4
  } = useSocket();
  const { videos, loading, error: videosError, refreshVideos, formatBytes } = useVideos();

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
  
  // Get current conversion status and progress
  const currentConversionStatus = currentConversion ? conversionStatus[currentConversion] : null;
  const currentConversionProgress = currentConversion ? conversionProgress[currentConversion] : null;
  
  const handleConvertToMp4 = async (videoId) => {
    try {
      const result = await convertVideoToMp4(videoId);
      setCurrentConversion(result.convertId);
    } catch (err) {
      setError(err.message || 'Failed to start conversion');
    }
  };
  
  // Refresh video list when a download or conversion completes
  useEffect(() => {
    if (currentStatus?.status === 'completed' || currentConversionStatus?.status === 'completed') {
      refreshVideos();
    }
  }, [currentStatus, currentConversionStatus, refreshVideos]);

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
        
        {/* YouTube Downloader */}
        <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg mb-6">
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
                          
                          <div className="text-sm mt-2">
                            <p className="text-gray-700 dark:text-gray-300">
                              {currentProgress.message}
                            </p>
                            
                            {currentProgress.details && (
                              <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {currentProgress.details.fileSize && (
                                  <div>
                                    <span className="font-medium">Size:</span> {currentProgress.details.fileSize}
                                  </div>
                                )}
                                {currentProgress.details.speed && (
                                  <div>
                                    <span className="font-medium">Speed:</span> {currentProgress.details.speed}
                                  </div>
                                )}
                                {currentProgress.details.eta && (
                                  <div>
                                    <span className="font-medium">ETA:</span> {currentProgress.details.eta}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {currentStatus?.status === 'completed' && (
                    <div className="text-green-600 dark:text-green-400">
                      <p>{currentStatus.message}</p>
                      <p className="text-sm mt-1">File saved as: {currentStatus.filename}</p>
                      {currentStatus.title && (
                        <p className="text-sm mt-1">Title: {currentStatus.title}</p>
                      )}
                    </div>
                  )}
                  
                  {currentStatus?.status === 'error' && (
                    <p className="text-red-600 dark:text-red-400">{currentStatus.message}</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Conversion Status */}
            {currentConversion && (
              <div className="mt-6">
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">Conversion Status</h3>
                
                <div className="bg-gray-100 dark:bg-slate-700 p-4 rounded-md">
                  {currentConversionStatus?.status === 'started' && (
                    <>
                      <p className="text-gray-700 dark:text-gray-300">{currentConversionStatus.message}</p>
                      {currentConversionProgress && (
                        <div className="mt-2">
                          <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-600" 
                              style={{ width: `${currentConversionProgress.progress || 0}%` }}
                            ></div>
                          </div>
                          
                          <div className="text-sm mt-2">
                            <p className="text-gray-700 dark:text-gray-300">
                              {currentConversionProgress.message || 'Preparing conversion...'}
                            </p>
                            
                            {currentConversionProgress.details && (
                              <div className="grid grid-cols-3 gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {currentConversionProgress.details.currentTime && (
                                  <div>
                                    <span className="font-medium">Time:</span> {currentConversionProgress.details.currentTime}
                                  </div>
                                )}
                                {currentConversionProgress.details.totalTime && (
                                  <div>
                                    <span className="font-medium">Duration:</span> {currentConversionProgress.details.totalTime}
                                  </div>
                                )}
                                {currentConversionProgress.details.speed && (
                                  <div>
                                    <span className="font-medium">Speed:</span> {currentConversionProgress.details.speed}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {currentConversionStatus?.status === 'completed' && (
                    <div className="text-green-600 dark:text-green-400">
                      <p>{currentConversionStatus.message}</p>
                      <p className="text-sm mt-1">File saved as: {currentConversionStatus.filename}</p>
                    </div>
                  )}
                  
                  {currentConversionStatus?.status === 'error' && (
                    <p className="text-red-600 dark:text-red-400">{currentConversionStatus.message}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Video History */}
        <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Your Video Downloads</h2>
            
            {loading ? (
              <div className="text-center py-4">
                <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-2 text-gray-600 dark:text-gray-300">Loading your videos...</p>
              </div>
            ) : videosError ? (
              <div className="text-center py-4">
                <p className="text-red-600 dark:text-red-400">{videosError}</p>
                <button 
                  onClick={refreshVideos}
                  className="mt-2 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No videos yet</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by downloading your first video.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Title
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Format
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Size
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {videos.map((video) => (
                      <tr key={video.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {video.title || 'Unknown Title'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {video.original_url}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {video.extension || 'unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${video.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                              video.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                              video.status === 'converting' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                            {video.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatBytes(video.file_size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {new Date(video.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {video.status === 'completed' && video.extension !== 'mp4' && (
                            <button
                              onClick={() => handleConvertToMp4(video.id)}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                              Convert to MP4
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
