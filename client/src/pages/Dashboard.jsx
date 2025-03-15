import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [tweetData, setTweetData] = useState(null);
  const [activeTab, setActiveTab] = useState('tweets');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Load data from the JSON file
    const fetchData = async () => {
      try {
        const response = await fetch('/sample_json/compact.json');
        const data = await response.json();
        setTweetData(data);
        setLoading(false);
      } catch (error) {
        console.error('Error loading tweet data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const filteredTweets = tweetData?.data?.filter(tweet => 
    tweet.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (tweet.entities?.mentions?.some(mention => 
      mention.username.toLowerCase().includes(searchTerm.toLowerCase()))) ||
    (tweet.entities?.annotations?.some(annotation => 
      annotation.normalized_text?.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  // Get unique languages
  const languages = tweetData?.data ? 
    [...new Set(tweetData.data.map(tweet => tweet.lang))] : [];

  // Get engagement metrics summary
  const calculateMetrics = () => {
    if (!tweetData?.data) return [];
    
    return tweetData.data.map(tweet => ({
      id: tweet.id,
      text: tweet.text.substring(0, 50) + (tweet.text.length > 50 ? '...' : ''),
      retweet_count: tweet.public_metrics.retweet_count,
      reply_count: tweet.public_metrics.reply_count,
      like_count: tweet.public_metrics.like_count,
      quote_count: tweet.public_metrics.quote_count,
      bookmark_count: tweet.public_metrics.bookmark_count,
      total_engagement: 
        tweet.public_metrics.retweet_count + 
        tweet.public_metrics.reply_count + 
        tweet.public_metrics.like_count + 
        tweet.public_metrics.quote_count + 
        tweet.public_metrics.bookmark_count
    })).sort((a, b) => b.total_engagement - a.total_engagement);
  };

  const getImages = () => {
    if (!tweetData) return [];
    
    return tweetData.media.map(media => ({
      media_key: media.media_key,
      url: media.url,
      type: media.type,
      width: media.width,
      height: media.height,
      // Find the tweet that contains this media
      tweet: tweetData.data.find(tweet => 
        tweet.attachments?.media_keys?.includes(media.media_key))
    }));
  };

  const getEntities = () => {
    if (!tweetData?.data) return [];

    let entities = [];
    
    tweetData.data.forEach(tweet => {
      // Add mentions
      if (tweet.entities?.mentions) {
        tweet.entities.mentions.forEach(mention => {
          entities.push({
            type: 'mention',
            value: `@${mention.username}`,
            id: mention.id,
            tweetId: tweet.id
          });
        });
      }
      
      // Add annotations
      if (tweet.entities?.annotations) {
        tweet.entities.annotations.forEach(annotation => {
          entities.push({
            type: annotation.type,
            value: annotation.normalized_text,
            probability: annotation.probability,
            tweetId: tweet.id
          });
        });
      }
      
      // Add hashtags
      if (tweet.entities?.hashtags) {
        tweet.entities.hashtags.forEach(hashtag => {
          entities.push({
            type: 'hashtag',
            value: `#${hashtag.tag}`,
            tweetId: tweet.id
          });
        });
      }
    });
    
    return entities;
  };

  const renderTweetsTable = () => {
    if (!filteredTweets) return null;
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-slate-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-100 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Author</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tweet</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Language</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Engagement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
            {filteredTweets.map(tweet => (
              <tr key={tweet.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">{tweet.author_id}</td>
                <td className="px-4 py-4 text-sm text-gray-800 dark:text-gray-200">
                  {tweet.text.substring(0, 100)}{tweet.text.length > 100 ? '...' : ''}
                  {tweet.attachments?.media_keys && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        Has media
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                  {new Date(tweet.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {tweet.lang}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  <div className="flex space-x-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                      <svg className="mr-1 h-3 w-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {tweet.public_metrics.retweet_count}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                      <svg className="mr-1 h-3 w-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
                      </svg>
                      {tweet.public_metrics.reply_count}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                      <svg className="mr-1 h-3 w-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                      </svg>
                      {tweet.public_metrics.like_count}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderEngagementTab = () => {
    const metrics = calculateMetrics();
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-slate-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-100 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tweet</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Retweets</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Replies</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Likes</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total Engagement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
            {metrics.map(metric => (
              <tr key={metric.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                <td className="px-4 py-4 text-sm text-gray-800 dark:text-gray-200">{metric.text}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min(100, metric.retweet_count * 10)}%` }}></div>
                    </div>
                    <span className="ml-2">{metric.retweet_count}</span>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${Math.min(100, metric.reply_count * 10)}%` }}></div>
                    </div>
                    <span className="ml-2">{metric.reply_count}</span>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div className="bg-red-600 h-2.5 rounded-full" style={{ width: `${Math.min(100, metric.like_count * 10)}%` }}></div>
                    </div>
                    <span className="ml-2">{metric.like_count}</span>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${Math.min(100, metric.total_engagement * 5)}%` }}></div>
                    </div>
                    <span className="ml-2">{metric.total_engagement}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderMediaTab = () => {
    const images = getImages();
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map(image => (
          <div key={image.media_key} className="bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow">
            <img 
              src={image.url} 
              alt="Media content" 
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {image.tweet?.text.substring(0, 100)}{image.tweet?.text.length > 100 ? '...' : ''}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {image.width}x{image.height}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {image.type}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderEntitiesTab = () => {
    const entities = getEntities();
    const entityTypes = [...new Set(entities.map(entity => entity.type))];
    
    return (
      <div className="space-y-6">
        {entityTypes.map(type => (
          <div key={type} className="bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow p-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 capitalize">{type}</h3>
            <div className="flex flex-wrap gap-2">
              {entities
                .filter(entity => entity.type === type)
                .map((entity, index) => (
                  <span 
                    key={`${entity.value}-${index}`}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  >
                    {entity.value}
                    {entity.probability && (
                      <span className="ml-1 text-xs text-blue-600 dark:text-blue-300">
                        ({(entity.probability * 100).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                ))
              }
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderLanguagesTab = () => {
    if (!tweetData?.data) return null;
    
    // Count tweets by language
    const langCounts = {};
    tweetData.data.forEach(tweet => {
      langCounts[tweet.lang] = (langCounts[tweet.lang] || 0) + 1;
    });
    
    const langCountsArray = Object.entries(langCounts).map(([lang, count]) => ({
      lang,
      count,
      percentage: (count / tweetData.data.length) * 100
    })).sort((a, b) => b.count - a.count);
    
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow p-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Language Distribution</h3>
          
          <div className="space-y-4">
            {langCountsArray.map(item => (
              <div key={item.lang} className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {item.lang.toUpperCase()} ({item.count} tweets)
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">XVibe Dashboard</h1>
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
            <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
              <h2 className="text-xl font-medium text-gray-900 dark:text-white">
                Tweet Analysis Dashboard
              </h2>
              
              <div className="w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Search tweets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                />
              </div>
            </div>
            
            <div className="border-b border-gray-200 dark:border-slate-700 mb-6">
              <div className="flex flex-wrap -mb-px">
                <button
                  onClick={() => setActiveTab('tweets')}
                  className={`mr-2 py-2 px-4 text-sm font-medium border-b-2 ${
                    activeTab === 'tweets'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Tweets
                </button>
                <button
                  onClick={() => setActiveTab('engagement')}
                  className={`mr-2 py-2 px-4 text-sm font-medium border-b-2 ${
                    activeTab === 'engagement'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Engagement
                </button>
                <button
                  onClick={() => setActiveTab('media')}
                  className={`mr-2 py-2 px-4 text-sm font-medium border-b-2 ${
                    activeTab === 'media'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Media
                </button>
                <button
                  onClick={() => setActiveTab('entities')}
                  className={`mr-2 py-2 px-4 text-sm font-medium border-b-2 ${
                    activeTab === 'entities'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Entities
                </button>
                <button
                  onClick={() => setActiveTab('languages')}
                  className={`mr-2 py-2 px-4 text-sm font-medium border-b-2 ${
                    activeTab === 'languages'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Languages
                </button>
              </div>
            </div>
            
            <div className="mt-4">
              {activeTab === 'tweets' && renderTweetsTable()}
              {activeTab === 'engagement' && renderEngagementTab()}
              {activeTab === 'media' && renderMediaTab()}
              {activeTab === 'entities' && renderEntitiesTab()}
              {activeTab === 'languages' && renderLanguagesTab()}
            </div>
            
            <div className="mt-6 text-right text-sm text-gray-500 dark:text-gray-400">
              Total tweets: {tweetData?.data?.length || 0}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;