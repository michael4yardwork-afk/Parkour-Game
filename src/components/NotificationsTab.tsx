import React, { useState, useEffect } from 'react';
import { Bell, Trash2, CheckCheck, Play, User, Sparkles } from 'lucide-react';
import { CourseNotification, LevelConfig, UserAccount } from '../types';
import { synths } from '../audio';

interface NotificationsTabProps {
  currentUser: UserAccount;
  onSelectLevel: (level: LevelConfig) => void;
  onViewProfile: (username: string) => void;
  onNotificationsChanged: () => void;
}

export default function NotificationsTab({
  currentUser,
  onSelectLevel,
  onViewProfile,
  onNotificationsChanged
}: NotificationsTabProps) {
  const [notifications, setNotifications] = useState<CourseNotification[]>([]);
  const [followedPlayers, setFollowedPlayers] = useState<string[]>([]);

  const loadNotifications = () => {
    try {
      const notifKey = `momentum_notifications_${currentUser.username.toLowerCase().trim()}`;
      const stored = localStorage.getItem(notifKey);
      if (stored) {
        setNotifications(JSON.parse(stored));
      } else {
        setNotifications([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadFollows = () => {
    try {
      const followsKey = `momentum_follows_${currentUser.username.toLowerCase().trim()}`;
      const stored = localStorage.getItem(followsKey);
      if (stored) {
        setFollowedPlayers(JSON.parse(stored));
      } else {
        setFollowedPlayers([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadNotifications();
    loadFollows();
  }, [currentUser]);

  const saveNotifications = (updated: CourseNotification[]) => {
    try {
      const notifKey = `momentum_notifications_${currentUser.username.toLowerCase().trim()}`;
      localStorage.setItem(notifKey, JSON.stringify(updated));
      setNotifications(updated);
      onNotificationsChanged();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAsRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    saveNotifications(updated);
    synths.playTick();
  };

  const handleMarkAllRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    saveNotifications(updated);
    synths.playFinish();
  };

  const handleClearAll = () => {
    saveNotifications([]);
    synths.playTick();
  };

  const handleDeleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notifications.filter(n => n.id !== id);
    saveNotifications(updated);
    synths.playTick();
  };

  const handleRunCourse = (courseId: string) => {
    try {
      const communityStored = localStorage.getItem('community_published_courses');
      if (communityStored) {
        const communityCourses: LevelConfig[] = JSON.parse(communityStored);
        const course = communityCourses.find(c => c.id === courseId);
        if (course) {
          // Mark notification as read
          const updated = notifications.map(n => n.courseId === courseId ? { ...n, read: true } : n);
          saveNotifications(updated);
          onSelectLevel(course);
          synths.playFinish();
          return;
        }
      }
      alert("This course could not be loaded. It might have been deleted by the creator.");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-neutral-200/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
            <Bell className="w-6 h-6 animate-swing" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight uppercase">
              Inbox Notifications
            </h1>
            <p className="text-xs text-neutral-400 font-mono">
              REAL-TIME ALERTS FROM RUNNERS YOU FOLLOW
            </p>
          </div>
        </div>

        {/* Quick actions */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-600 transition cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 rounded-xl text-xs font-bold text-rose-600 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear inbox</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Notifications Feed */}
        <div className="lg:col-span-2 space-y-4">
          
          {notifications.length === 0 ? (
            <div className="bg-white border border-neutral-200/80 rounded-2xl p-8 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center text-neutral-400 mx-auto border border-neutral-100">
                <Bell className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-neutral-800 text-sm">Your notifications inbox is empty</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                  Follow other players via their profiles, and you will get notified whenever they publish brand new custom parkour courses!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notif) => {
                const isFollowed = followedPlayers.map(p => p.toLowerCase()).includes(notif.creator.toLowerCase());

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkAsRead(notif.id)}
                    className={`bg-white border rounded-2xl p-4 transition-all duration-200 hover:shadow-md cursor-pointer flex gap-4 items-start relative ${
                      notif.read ? 'border-neutral-200/80 opacity-80' : 'border-indigo-200 bg-indigo-50/5 shadow-sm'
                    }`}
                  >
                    {/* Unread dot indicator */}
                    {!notif.read && (
                      <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                    )}

                    {/* Left Icon */}
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      notif.read ? 'bg-neutral-50 text-neutral-400' : 'bg-indigo-50 text-indigo-600'
                    }`}>
                      <Sparkles className="w-5 h-5" />
                    </div>

                    {/* Middle Info */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewProfile(notif.creator);
                            }}
                            className="font-extrabold text-neutral-900 text-xs hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <User className="w-3 h-3 text-neutral-400" />
                            {notif.creator}
                          </span>
                          {isFollowed && (
                            <span className="py-0.5 px-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-extrabold font-mono text-[8px] rounded uppercase tracking-wider">
                              Followed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                          published a new parkour course: <span className="font-bold text-neutral-800">"{notif.courseName}"</span>!
                        </p>
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRunCourse(notif.courseId);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[10px] font-mono uppercase tracking-wider rounded-lg transition"
                        >
                          <Play className="w-3 h-3 fill-current text-indigo-400" />
                          <span>Run Course</span>
                        </button>

                        <span className="text-[10px] text-neutral-400 font-mono">
                          {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Delete item button */}
                    <button
                      onClick={(e) => handleDeleteNotification(notif.id, e)}
                      className="p-1.5 text-neutral-400 hover:text-rose-500 rounded-lg hover:bg-neutral-50 shrink-0 self-center"
                      title="Delete Notification"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Sidebar Info & Follows List */}
        <div className="space-y-6">
          
          {/* Follows Directory Card */}
          <div className="bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 pb-2">
              Following Athletes ({followedPlayers.length})
            </h3>

            {followedPlayers.length === 0 ? (
              <p className="text-xs text-neutral-400 italic leading-relaxed py-2">
                You aren't following any other runners yet. When you browse the community workshop or look at race leaderboards, click on any username to view their profile and follow them!
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {followedPlayers.map((player) => (
                  <div
                    key={player}
                    onClick={() => onViewProfile(player)}
                    className="flex items-center justify-between p-2 rounded-xl border border-neutral-100 hover:border-indigo-100 hover:bg-neutral-50/50 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center text-xs">
                        🏃
                      </div>
                      <span className="text-xs font-bold text-neutral-700">{player}</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-neutral-400 uppercase">
                      Profile
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
