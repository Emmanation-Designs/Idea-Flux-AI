import React, { useState, useEffect } from 'react';

interface QueueStatusLoaderProps {
  userPlan: 'free' | 'plus' | 'pro';
}

export const QueueStatusLoader: React.FC<QueueStatusLoaderProps> = ({ userPlan }) => {
  const isPaid = userPlan === 'plus' || userPlan === 'pro';
  
  // Paid plans include "Priority processing..." as their premier status.
  const paidMessages = [
    'Priority processing...',
    'Preparing response...',
    'Processing...',
    'Almost ready...',
    'Generating response...'
  ];

  const freeMessages = [
    'Preparing response...',
    'Processing...',
    'Almost ready...',
    'Generating response...'
  ];

  const messages = isPaid ? paidMessages : freeMessages;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Cycle status messages every 2.5 seconds to feel dynamic and alive
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % messages.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="flex items-center gap-3 py-2 px-1 animate-pulse">
      <div className="flex gap-1 items-center">
        <span className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce [animation-delay:0s]" />
        <span className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
        <span className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
      </div>
      <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.12em] transition-all duration-300">
        {messages[index]}
      </p>
    </div>
  );
};
