import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useVideos from '../hooks/useVideos';
import useSocket from '../hooks/useSocket';
import path from 'path-browserify';

const VideoDetail = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [currentKeyframe, setCurrentKeyframe] = useState(null);
  const [error, setError] = useState('');
  
  const { 
    videoDetails,
    detailsLoading, 
    detailsError,
    fetchVideoDetails,
    formatBytes,
    downloadCaptions
  } = useVideos();
  
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captionError, setCaptionError] = useState('');
  
  const {
    connected,
    keyframeStatus,
    keyframeProgress,
    extractKeyframes
  } = useSocket();
  
  useEffect(() => {
    if (isAuthenticated && videoId) {
      fetchVideoDetails(videoId);
    }
  }, [isAuthenticated, videoId, fetchVideoDetails]);
  
  // Get current keyframe extraction status
  const currentKeyframeStatus = keyframeStatus[videoId];
  const currentKeyframeProgress = keyframeProgress[videoId];
  
  const handleExtractKeyframes = async () => {
    setError('');
    
    try {
      await extractKeyframes(videoId);
    } catch (err) {
      setError(err.message || 'Failed to start keyframe extraction');
    }
  };
  
  const handleDownloadCaptions = async () => {
    setCaptionError('');
    setCaptionLoading(true);
    
    try {
      // Extract YouTube video ID from the original URL
      let youtubeId = '';
      
      if (video && video.original_url) {
        // Extract video ID using regex patterns for different YouTube URL formats
        const patterns = [
          /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/user\/\w+\/\w+\/|youtube\.com\/\w+\/\w+\/|youtube\.com\/attribution_link\?[^=]*=|youtube\.com\/attribution_link\?a=[^=]*=|youtube\.com\/[^\/]+\?[^&]*[&;]v=)([^"&?\/\s]{11})/,
          /(?:youtube\.com\/shorts\/|youtube\.com\/live\/)([^"&?\/\s]{11})/,
          /(?:youtube\.com\/playlist\?[^&]*list=)([^"&?\s]+)/
        ];
        
        for (const pattern of patterns) {
          const match = video.original_url.match(pattern);
          if (match && match[1]) {
            youtubeId = match[1];
            break;
          }
        }
      }
      
      if (!youtubeId) {
        throw new Error('Could not extract YouTube video ID from the URL');
      }
      
      console.log('Extracted YouTube ID:', youtubeId);
      
      // Pass the video ID to the server
      const result = await downloadCaptions(videoId, youtubeId);
      console.log('Captions downloaded:', result);
      
      // Refresh video details to show new caption info
      await fetchVideoDetails(videoId);
    } catch (err) {
      setCaptionError(err.message || 'Failed to download captions');
    } finally {
      setCaptionLoading(false);
    }
  };
  
  const goBack = () => {
    navigate('/');
  };
  
  if (!isAuthenticated) {
    return navigate('/login');
  }
  
  if (detailsLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Loading video details...</h1>
            <button
              onClick={goBack}
              className="bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-white px-4 py-2 rounded-md"
            >
              Back to videos
            </button>
          </div>
          <div className="text-center py-12">
            <svg className="animate-spin h-12 w-12 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </div>
      </div>
    );
  }
  
  if (detailsError || !videoDetails) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Error</h1>
            <button
              onClick={goBack}
              className="bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-white px-4 py-2 rounded-md"
            >
              Back to videos
            </button>
          </div>
          <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-6">
            <p className="text-red-600 dark:text-red-400">{detailsError || 'Failed to load video details'}</p>
          </div>
        </div>
      </div>
    );
  }
  
  const { video, keyframes, versions } = videoDetails;
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Video Details</h1>
          <button
            onClick={goBack}
            className="bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-white px-4 py-2 rounded-md"
          >
            Back to videos
          </button>
        </div>
        
        {/* Video Information */}
        <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{video.title || 'Unknown Title'}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Original URL</p>
                <p className="text-gray-900 dark:text-white break-all">{video.original_url}</p>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">File Format</p>
                <p className="text-gray-900 dark:text-white">{video.extension}</p>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">File Size</p>
                <p className="text-gray-900 dark:text-white">{formatBytes(video.file_size)}</p>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                  ${video.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                  video.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                  video.status === 'converting' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                  {video.status}
                </span>
              </div>
              
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Downloaded On</p>
                <p className="text-gray-900 dark:text-white">{new Date(video.created_at).toLocaleString()}</p>
              </div>
            </div>
            
            <div>
              {video.status === 'completed' && (
                <div className="aspect-w-16 aspect-h-9 mb-4">
                  <video 
                    className="w-full h-auto rounded-md shadow-md" 
                    controls
                    src={video.url}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
              
              {/* Action Buttons */}
              {video.status === 'completed' && (
                <div className="mt-4 space-y-3">
                  {/* Keyframe Extraction Button */}
                  <button
                    onClick={handleExtractKeyframes}
                    disabled={!connected || currentKeyframeStatus?.status === 'started'}
                    className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                      connected && currentKeyframeStatus?.status !== 'started' 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'bg-gray-400'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                  >
                    {currentKeyframeStatus?.status === 'started' ? 'Extracting Keyframes...' : 'Extract Keyframes'}
                  </button>
                  
                  {error && (
                    <p className="text-red-600 text-sm mt-2">{error}</p>
                  )}
                  
                  {/* Get Text Button */}
                  <button
                    onClick={handleDownloadCaptions}
                    disabled={captionLoading}
                    className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                      !captionLoading 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-gray-400'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
                  >
                    {captionLoading ? 'Downloading Text...' : 'Get Text'}
                  </button>
                  
                  {captionError && (
                    <p className="text-red-600 text-sm mt-2">{captionError}</p>
                  )}
                  
                  {/* Show caption info if available */}
                  {video.captions_path && (
                    <div className="mt-3 p-2 bg-gray-100 dark:bg-slate-700 rounded-md">
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                        Captions saved successfully!
                      </p>
                      <div className="flex space-x-2">
                        <a 
                          href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/captions/${path.basename(video.directory_path)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          View Online
                        </a>
                        <a 
                          href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/captions/${path.basename(video.directory_path)}?download=true`}
                          className="text-sm text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                        >
                          Download File
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Other Versions */}
        {versions.length > 0 && (
          <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Other Versions</h2>
            
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
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {versions.map((version) => (
                    <tr key={version.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {version.title || 'Unknown Title'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {version.extension}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${version.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                          version.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                          {version.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatBytes(version.file_size)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {version.status === 'completed' && (
                          <a
                            href={version.url}
                            className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Download
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Keyframe Extraction Status */}
        {currentKeyframeStatus && (
          <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Keyframe Extraction</h2>
            
            {currentKeyframeStatus.status === 'started' && (
              <div className="bg-gray-100 dark:bg-slate-700 p-4 rounded-md">
                <p className="text-gray-700 dark:text-gray-300">{currentKeyframeStatus.message}</p>
                {currentKeyframeProgress && (
                  <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                    {currentKeyframeProgress.message}
                  </p>
                )}
              </div>
            )}
            
            {currentKeyframeStatus.status === 'completed' && (
              <div className="text-green-600 dark:text-green-400 mb-4">
                <p>{currentKeyframeStatus.message}</p>
                <p className="text-sm mt-1">Extracted {currentKeyframeStatus.keyframeCount} keyframes</p>
              </div>
            )}
            
            {currentKeyframeStatus.status === 'error' && (
              <p className="text-red-600 dark:text-red-400 mb-4">{currentKeyframeStatus.message}</p>
            )}
          </div>
        )}
        
        {/* Keyframes Grid */}
        {((currentKeyframeStatus && currentKeyframeStatus.status === 'completed' && currentKeyframeStatus.keyframes) || keyframes.length > 0) && (
          <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Keyframes</h2>
            
            {currentKeyframe && (
              <div className="mb-6">
                <img 
                  src={currentKeyframe?.startsWith('http') ? currentKeyframe : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${currentKeyframe}`} 
                  alt="Selected Keyframe" 
                  className="max-w-full h-auto rounded-md shadow-md mx-auto" 
                  onError={(e) => {
                    console.error('Failed to load image:', currentKeyframe);
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjY2NjIi8+PHRleHQgeD0iNSIgeT0iMTQiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj4/PC90ZXh0Pjwvc3ZnPg==';
                  }}
                />
              </div>
            )}
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {(currentKeyframeStatus?.keyframes || keyframes.map(k => k.url)).map((keyframe, index) => (
                <div 
                  key={index}
                  className={`cursor-pointer hover:opacity-75 transition-opacity duration-200 aspect-w-16 aspect-h-9 ${
                    currentKeyframe === keyframe ? 'ring-4 ring-blue-500 dark:ring-blue-400' : ''
                  }`}
                  onClick={() => setCurrentKeyframe(keyframe)}
                >
                  <img 
                    src={keyframe.startsWith('http') ? keyframe : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${keyframe}`} 
                    alt={`Keyframe ${index + 1}`} 
                    className="object-cover w-full h-full rounded-md shadow-sm" 
                    onError={(e) => {
                      console.error('Failed to load image:', keyframe);
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjY2NjIi8+PHRleHQgeD0iNSIgeT0iMTQiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjMzMzIj4/PC90ZXh0Pjwvc3ZnPg==';
                    }}  
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoDetail;