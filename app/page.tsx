'use client';

import { useState, useEffect } from 'react';
import { Send, Heart, MessageCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import ConfirmModal from '@/components/confirm-modal';
import ReportModal from '@/components/report-modal';

type Confession = {
  id: string;
  content: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
};

export default function Home() {
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myPosts, setMyPosts] = useState<string[]>([]);
  
  // App State Additions: Pagination & Cooldown
  const [limit, setLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  
  // Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Track Likes & Reports
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [reportedPosts, setReportedPosts] = useState<string[]>([]);
  
  // Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [postToReport, setPostToReport] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);

  useEffect(() => {
    // Load local posts to allow deletion
    const storedPosts = localStorage.getItem('my_confessions');
    if (storedPosts) {
      setMyPosts(JSON.parse(storedPosts));
    }

    // Load liked posts
    const storedLikes = localStorage.getItem('liked_confessions');
    if (storedLikes) {
      setLikedPosts(JSON.parse(storedLikes));
    }

    // Load reported posts
    const storedReports = localStorage.getItem('reported_confessions');
    if (storedReports) {
      setReportedPosts(JSON.parse(storedReports));
    }

    // Check Cooldown
    const lastPosted = localStorage.getItem('last_posted_time');
    if (lastPosted) {
      const timePassed = Math.floor((Date.now() - parseInt(lastPosted)) / 1000);
      if (timePassed < 60) {
        setCooldown(60 - timePassed);
      }
    }

    fetchConfessions();
    
    const channel = supabase
      .channel('confessions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'confessions' }, (payload) => {
        setConfessions((prev) => {
          if (prev.some(c => c.id === payload.new.id)) return prev;
          return [payload.new as Confession, ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'confessions' }, (payload) => {
        setConfessions((prev) => prev.map(c => c.id === payload.new.id ? payload.new as Confession : c));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'confessions' }, (payload) => {
        setConfessions((prev) => prev.filter(c => c.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Cooldown Timer Effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Re-fetch when limit changes
  useEffect(() => {
    if (limit > 50) {
      fetchConfessions();
    }
  }, [limit]);

  async function fetchConfessions() {
    try {
      const { data, error } = await supabase
        .from('confessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      setConfessions(data || []);
      setHasMore(data?.length === limit);
    } catch (err) {
      console.error('Error fetching confessions:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cooldown > 0) return;

    const commentContent = content.trim();
    if (!commentContent) return;
    
    setIsSubmitting(true);
    setContent('');
    try {
      const { data, error } = await supabase
        .from('confessions')
        .insert({ content: commentContent })
        .select()
        .single();
        
      if (error) throw error;
      
      // Save ID to local storage so user can delete it later
      if (data) {
        const updatedPosts = [...myPosts, data.id];
        setMyPosts(updatedPosts);
        localStorage.setItem('my_confessions', JSON.stringify(updatedPosts));
        
        // Optimistic UI update - show instantly without waiting for broadcast
        setConfessions((prev) => {
          if (prev.some(c => c.id === data.id)) return prev;
          return [data as Confession, ...prev];
        });

        // Trigger Cooldown
        setCooldown(60);
        localStorage.setItem('last_posted_time', Date.now().toString());
      }

    } catch (err) {
      console.error('Error posting confession:', err);
      alert('Failed to post confession. Please try again later.');
      setContent(commentContent); // restore on fail
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLike(id: string) {
    const isLiked = likedPosts.includes(id);

    // Optimistic UI update
    setConfessions(prev => prev.map(c => 
      c.id === id 
        ? { ...c, likes_count: isLiked ? Math.max(0, c.likes_count - 1) : c.likes_count + 1 } 
        : c
    ));
    
    // Save to local storage
    const updatedLikes = isLiked 
      ? likedPosts.filter(pId => pId !== id)
      : [...likedPosts, id];
      
    setLikedPosts(updatedLikes);
    localStorage.setItem('liked_confessions', JSON.stringify(updatedLikes));

    try {
      if (isLiked) {
        await supabase.rpc('decrement_like', { confession_uid: id });
      } else {
        await supabase.rpc('increment_like', { confession_uid: id });
      }
    } catch (err) {
      console.error('Like toggle failed', err);
      // Rollback local storage on error
      const revertedLikes = isLiked 
        ? [...likedPosts, id]
        : likedPosts.filter(pId => pId !== id);
        
      setLikedPosts(revertedLikes);
      localStorage.setItem('liked_confessions', JSON.stringify(revertedLikes));
      fetchConfessions();
    }
  }

  function confirmDelete(id: string) {
    setPostToDelete(id);
    setDeleteModalOpen(true);
  }

  async function handleConfirmedDelete() {
    if (!postToDelete) return;
    setIsDeleting(true);

    // Optimistic UI update
    setConfessions(prev => prev.filter(c => c.id !== postToDelete));
    
    try {
      const { error } = await supabase.from('confessions').delete().eq('id', postToDelete);
      if (error) throw error;
      
      // Remove from local storage
      const updatedPosts = myPosts.filter(postId => postId !== postToDelete);
      setMyPosts(updatedPosts);
      localStorage.setItem('my_confessions', JSON.stringify(updatedPosts));
      
    } catch (err) {
      console.error('Error deleting confession:', err);
      alert('Failed to delete confession.');
      fetchConfessions(); // restore on fail
    } finally {
      setIsDeleting(false);
      setDeleteModalOpen(false);
      setPostToDelete(null);
    }
  }

  function openReportModal(id: string) {
    if (reportedPosts.includes(id)) return;
    setPostToReport(id);
    setReportModalOpen(true);
  }

  async function handleReportSubmit(reason: string) {
    if (!postToReport) return;
    setIsReporting(true);

    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          confession_id: postToReport,
          reason: reason
        });

      if (error) throw error;

      // Save to local storage to prevent multiple reports
      const updatedReports = [...reportedPosts, postToReport];
      setReportedPosts(updatedReports);
      localStorage.setItem('reported_confessions', JSON.stringify(updatedReports));
      
      alert('Report submitted successfully. Thank you for keeping the community safe.');

    } catch (err) {
      console.error('Error submitting report:', err);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsReporting(false);
      setReportModalOpen(false);
      setPostToReport(null);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-4 md:p-8 pt-12 md:pt-20">
      <header className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white to-neutral-500 bg-clip-text text-transparent mb-4">
          Anonymous Confession Wall
        </h1>
        <p className="text-neutral-400 text-lg">
          Share your secrets. Read others' thoughts. Completely anonymous.
        </p>
      </header>

      {/* Write Confession Box */}
      <section className="bg-neutral-900/50 backdrop-blur-md rounded-2xl border border-neutral-800 p-4 md:p-6 mb-12 shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <form onSubmit={handleSubmit} className="relative z-10">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's your secret?"
            className="w-full bg-transparent text-neutral-100 placeholder:text-neutral-600 outline-none resize-none min-h-[120px] text-lg md:text-xl"
            required
            maxLength={1000}
          />
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-neutral-800">
            <span className="text-xs text-neutral-600 font-medium">
              You are completely anonymous
            </span>
            <button
              type="submit"
              disabled={isSubmitting || !content.trim() || cooldown > 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-white text-black font-semibold rounded-full hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <Send size={18} />
              {isSubmitting ? 'Posting...' : cooldown > 0 ? `Wait ${cooldown}s` : 'Post Secret'}
            </button>
          </div>
        </form>
      </section>

      {/* Confessions Feed */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-neutral-200 mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Feed
        </h2>
        
        {loading ? (
          <div className="text-center py-12 text-neutral-500 animate-pulse">
            Loading secrets...
          </div>
        ) : confessions.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 border border-neutral-800 border-dashed rounded-2xl">
            No confessions yet. Be the first to share!
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {confessions.map((confession) => (
              <article 
                key={confession.id} 
                className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5 md:p-7 hover:bg-neutral-900/80 transition-colors relative"
              >
                {myPosts.includes(confession.id) && (
                  <button 
                    onClick={() => confirmDelete(confession.id)}
                    className="absolute top-4 right-4 text-neutral-600 hover:text-red-400 transition-colors"
                    title="Delete your post"
                  >
                    <Trash2 size={18} />
                  </button>
                )}

                <p className="text-neutral-200 text-lg leading-relaxed whitespace-pre-wrap break-words mt-2">
                  {confession.content}
                </p>
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-neutral-800/50 text-neutral-500 text-sm">
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={() => handleLike(confession.id)}
                      className="flex items-center gap-1.5 transition-colors group hover:text-pink-500"
                    >
                      <Heart 
                        size={18} 
                        className={likedPosts.includes(confession.id) ? 'fill-pink-500 text-pink-500' : 'group-active:scale-125 transition-transform text-current'} 
                      />
                      <span className={`font-medium ${likedPosts.includes(confession.id) ? 'text-pink-500' : ''}`}>{confession.likes_count}</span>
                    </button>
                    <Link href={`/confession/${confession.id}`} className="flex items-center gap-1.5 hover:text-blue-400 transition-colors">
                      <MessageCircle size={18} />
                      <span className="font-medium">{confession.comments_count}</span>
                    </Link>
                  </div>
                  <div className="flex items-center gap-4">
                    <span suppressHydrationWarning>
                      {formatDistanceToNow(new Date(confession.created_at), { addSuffix: true })}
                    </span>
                    <button 
                      onClick={() => openReportModal(confession.id)}
                      disabled={reportedPosts.includes(confession.id)}
                      className={`transition-colors ${
                        reportedPosts.includes(confession.id) ? 'text-amber-500 opacity-50 cursor-default' : 'hover:text-amber-400'
                      }`}
                      title={reportedPosts.includes(confession.id) ? "Reported" : "Report"}
                    >
                      <AlertTriangle size={16} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
            
            {/* Load More Button */}
            {hasMore && confessions.length >= 50 && (
              <div className="pt-4 text-center">
                <button
                  onClick={() => setLimit(prev => prev + 50)}
                  className="px-6 py-2.5 bg-neutral-800/50 hover:bg-neutral-800 text-neutral-300 font-medium rounded-full transition-colors border border-neutral-700/50"
                >
                  Load older secrets
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Confession"
        message="Are you sure you want to delete this secret forever? This will also permanently delete all comments and likes attached to it."
        isDeleting={isDeleting}
        onConfirm={handleConfirmedDelete}
        onCancel={() => setDeleteModalOpen(false)}
      />

      {reportModalOpen && (
        <ReportModal
          isOpen={reportModalOpen}
          isSubmitting={isReporting}
          onClose={() => {
            setReportModalOpen(false);
            setPostToReport(null);
          }}
          onSubmit={handleReportSubmit}
        />
      )}
    </main>
  );
}
