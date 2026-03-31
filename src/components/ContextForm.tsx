import { useState } from 'react';
import { 
  MessageSquare, 
  FileText, 
  Hash
} from 'lucide-react';
import { motion } from 'motion/react';
import type { ConversationType } from '../types';

export const ContextForm = ({ 
  type, 
  onSubmit, 
  onCancel 
}: { 
  type: ConversationType; 
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState<any>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl"
      >
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          {type === 'idea' && <MessageSquare className="w-5 h-5 text-blue-500" />}
          {type === 'script' && <FileText className="w-5 h-5 text-purple-500" />}
          {type === 'hashtag' && <Hash className="w-5 h-5 text-emerald-500" />}
          Configure your {type}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'idea' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Topic / Niche</label>
                <input 
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  placeholder="e.g. AI Tools, Cooking, Fitness"
                  onChange={e => setFormData({...formData, topic: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Platform</label>
                <select 
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  onChange={e => setFormData({...formData, platform: e.target.value})}
                >
                  <option value="TikTok">TikTok</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Twitter/X">Twitter/X</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Tone</label>
                <select 
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  onChange={e => setFormData({...formData, tone: e.target.value})}
                >
                  <option value="Funny">Funny</option>
                  <option value="Motivational">Motivational</option>
                  <option value="Educational">Educational</option>
                  <option value="Professional">Professional</option>
                </select>
              </div>
            </>
          )}

          {type === 'script' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Idea or Topic</label>
                <input 
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  placeholder="e.g. How to use Gemini AI"
                  onChange={e => setFormData({...formData, topic: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Platform</label>
                <select 
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  onChange={e => setFormData({...formData, platform: e.target.value})}
                >
                  <option value="TikTok/Shorts">TikTok/Shorts</option>
                  <option value="YouTube Long">YouTube Long</option>
                  <option value="Instagram Reel">Instagram Reel</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Length</label>
                <select 
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  onChange={e => setFormData({...formData, length: e.target.value})}
                >
                  <option value="Short (30s)">Short (30s)</option>
                  <option value="Medium (1-2m)">Medium (1-2m)</option>
                  <option value="Long (5m+)">Long (5m+)</option>
                </select>
              </div>
            </>
          )}

          {type === 'hashtag' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Main Topic</label>
                <input 
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  placeholder="e.g. Digital Marketing"
                  onChange={e => setFormData({...formData, topic: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Platform</label>
                <select 
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  onChange={e => setFormData({...formData, platform: e.target.value})}
                >
                  <option value="Instagram">Instagram</option>
                  <option value="TikTok">TikTok</option>
                  <option value="LinkedIn">LinkedIn</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Number of Hashtags</label>
                <input 
                  type="number"
                  min="10"
                  max="30"
                  defaultValue="15"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  onChange={e => setFormData({...formData, count: e.target.value})}
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold hover:opacity-90 transition-opacity"
            >
              Generate
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
