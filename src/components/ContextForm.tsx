import { useState } from 'react';
import { 
  MessageSquare, 
  FileText, 
  Hash,
  Zap
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
          {type === 'image' && <Zap className="w-5 h-5 text-orange-500" />}
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
                  placeholder="e.g. How to use AI in marketing"
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

          {type === 'image' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Describe the image you want</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none resize-none"
                  placeholder="e.g. A futuristic city with neon lights and flying cars"
                  onChange={e => setFormData({...formData, prompt: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-70">Style</label>
                <select 
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-500 outline-none"
                  onChange={e => setFormData({...formData, style: e.target.value})}
                >
                  <option value="Realistic">Realistic</option>
                  <option value="Cartoon">Cartoon</option>
                  <option value="Artistic">Artistic</option>
                  <option value="Cyberpunk">Cyberpunk</option>
                  <option value="Minimalist">Minimalist</option>
                </select>
              </div>
            </>
          )}

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox"
                  className="peer sr-only"
                  checked={formData.ready_to_copy || false}
                  onChange={e => setFormData({...formData, ready_to_copy: e.target.checked})}
                />
                <div className="w-10 h-5 bg-zinc-200 dark:bg-zinc-800 rounded-full peer-checked:bg-zinc-900 dark:peer-checked:bg-white transition-colors" />
                <div className="absolute left-1 top-1 w-3 h-3 bg-zinc-400 dark:bg-zinc-600 rounded-full transition-all peer-checked:left-6 peer-checked:bg-white dark:peer-checked:bg-zinc-900" />
              </div>
              <div className="text-sm">
                <div className="font-bold opacity-90 group-hover:opacity-100 transition-opacity">I want it ready to copy</div>
                <div className="text-[10px] opacity-50">Format output in a copyable block</div>
              </div>
            </label>
          </div>

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
