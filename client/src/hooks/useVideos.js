import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

const useVideos = () => {
  const [videos, setVideos] = useState([]);
  const [videoDetails, setVideoDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailsError, setDetailsError] = useState(null);
  const { isAuthenticated, token } = useAuth();

  const fetchVideos = useCallback(async () => {
    if (!isAuthenticated || !token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/videos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }

      const data = await response.json();
      setVideos(data.videos || []);
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  const fetchVideoDetails = useCallback(async (videoId) => {
    if (!isAuthenticated || !token || !videoId) {
      return;
    }

    setDetailsLoading(true);
    setDetailsError(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/videos/${videoId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch video details');
      }

      const data = await response.json();
      setVideoDetails(data);
      return data;
    } catch (err) {
      console.error('Error fetching video details:', err);
      setDetailsError(err.message || 'Failed to load video details');
      return null;
    } finally {
      setDetailsLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchVideos();
    }
  }, [isAuthenticated, fetchVideos]);

  // Format bytes to human-readable format
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    if (!bytes) return 'Unknown';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Clear video details (useful when navigating away from details page)
  const clearVideoDetails = useCallback(() => {
    setVideoDetails(null);
  }, []);

  return {
    videos,
    videoDetails,
    loading,
    detailsLoading,
    error,
    detailsError,
    refreshVideos: fetchVideos,
    fetchVideoDetails,
    clearVideoDetails,
    formatBytes
  };
};

export default useVideos;