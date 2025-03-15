import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './useAuth';

const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState({});
  const [downloadProgress, setDownloadProgress] = useState({});
  const { token, isAuthenticated } = useAuth();

  useEffect(() => {
    // Initialize socket
    const socketInstance = io('http://localhost:5000');
    
    socketInstance.on('connect', () => {
      setConnected(true);
      console.log('Connected to websocket server');
    });
    
    socketInstance.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from websocket server');
    });
    
    socketInstance.on('download_status', (data) => {
      setDownloadStatus(prev => ({
        ...prev,
        [data.id]: {
          status: data.status,
          message: data.message,
          filename: data.filename,
          title: data.title
        }
      }));
    });
    
    socketInstance.on('download_progress', (data) => {
      setDownloadProgress(prev => ({
        ...prev,
        [data.id]: {
          progress: data.progress,
          message: data.message,
          details: data.details
        }
      }));
    });
    
    setSocket(socketInstance);
    
    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, []);
  
  const downloadYouTubeVideo = useCallback(async (url) => {
    if (!socket || !connected) {
      throw new Error('Socket not connected');
    }
    
    if (!isAuthenticated || !token) {
      throw new Error('Authentication required');
    }
    
    try {
      const response = await fetch('http://localhost:5000/api/download-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url, socketId: socket.id }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start download');
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error starting download:', error);
      throw error;
    }
  }, [socket, connected, token, isAuthenticated]);
  
  return {
    socket,
    connected,
    downloadStatus,
    downloadProgress,
    downloadYouTubeVideo
  };
};

export default useSocket;