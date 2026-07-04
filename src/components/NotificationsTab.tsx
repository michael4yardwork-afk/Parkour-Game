import React, { useState, useEffect } from 'react';
import { Bell, Trash2, CheckCheck, Play, User, Sparkles, RefreshCw } from 'lucide-react';
import { CourseNotification, LevelConfig, UserAccount } from '../types';
import { synths } from '../audio';
import { api } from '../api';

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
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const notifs = await api.users.getNotifications(currentUser.username);
      setNotifications(notifs);
    } catch (e) {
      console.error('Failed to load notifications:', e);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [currentUser]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.users.markNotificationsRead(currentUser.username, [id]);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      onNotificationsChanged();
      synths.playTick();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.users.markNotificationsRead(currentUser.username);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      onNotificationsChanged();
      synths.playFinish();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlayCourse = async (notif: CourseNotification) => {
    try {
      if (!notif.read) {
        await api.users.markNotificationsRead(currentUser.username, [notif.id]);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        onNotificationsChanged();
      }
      const { courses } = await api.community.getCourses();
      const course = courses.find(c => c.id === notif.courseId);
      if (course) {
        onSelectLevel(course);
        synths.playTick();
      } else {
        alert('This course may have been removed from the community workshop.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 flex items-center justify-center gap-3 text-neutral-500">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-sm font-mono">Loading notifications...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 font-sans">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-neutral-900 tracking-tight">Notifications</h1>
            <p className="text-xs text-neutral-500 font-mono mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadNotifications}
            className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:text-indigo-600 hover:border-indigo-300 transition cursor-pointer"
            title="Refresh notifications"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:text-indigo-700 bg-neutral-100 hover:bg-indigo-50 border border-neutral-200 rounded-xl transition cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-neutral-300" />
          </div>
          <h3 className="text-base font-bold text-neutral-700">No notifications yet</h3>
          <p className="text-xs text-neutral-400 mt-2 leading-relaxed max-w-xs mx-auto">
            Follow other athletes to get notified when they publish new courses.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(notif => (
            <div
              key={notif.id}
              className={`p-4 rounded-2xl border transition-all duration-200 ${
                notif.read
                  ? 'bg-white border-neutral-200/60 opacity-75'
                  : 'bg-indigo-50/60 border-indigo-200/60 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!notif.read && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0 mt-1" />
                    )}
                    <p className="text-sm text-neutral-800 font-medium leading-snug">
                      <button
                        onClick={() => onViewProfile(notif.creator)}
                        className="font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        {notif.creator}
                      </button>
                      {' '}published a new course: <span className="font-semibold text-neutral-900">"{notif.courseName}"</span>
                    </p>
                  </div>
                  <p className="text-[10px] font-mono text-neutral-400 mt-1.5">
                    {new Date(notif.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handlePlayCourse(notif)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                    title="Play this course"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Play
                  </button>
                  {!notif.read && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-indigo-600 hover:bg-neutral-100 transition cursor-pointer"
                      title="Mark as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
