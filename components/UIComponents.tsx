import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

export const Card: React.FC<{ children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode }> = ({ children, className = '', title, action }) => (
  <div className={`glass-panel rounded-2xl p-6 text-white ${className}`}>
    {(title || action) && (
      <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
        {title && <h3 className="text-xl font-semibold tracking-wide text-white/90">{title}</h3>}
        {action && <div>{action}</div>}
      </div>
    )}
    {children}
  </div>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'secondary' | 'ghost' }> = ({ children, className = '', variant = 'primary', ...props }) => {
  const variants = {
    primary: 'bg-blue-600/80 hover:bg-blue-500/90 text-white shadow-lg shadow-blue-500/30',
    danger: 'bg-red-500/80 hover:bg-red-400/90 text-white shadow-lg shadow-red-500/30',
    secondary: 'bg-white/10 hover:bg-white/20 text-white border border-white/10',
    ghost: 'hover:bg-white/5 text-white/70 hover:text-white',
  };

  return (
    <button
      className={`px-4 py-2 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-medium ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <label className="text-xs font-medium text-white/60 ml-1 uppercase tracking-wider">{label}</label>}
    <input
      className={`bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all ${className}`}
      {...props}
    />
  </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({ label, className = '', children, ...props }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <label className="text-xs font-medium text-white/60 ml-1 uppercase tracking-wider">{label}</label>}
    <select
      className={`bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all appearance-none cursor-pointer ${className}`}
      {...props}
      style={{
        backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right .7em top 50%',
        backgroundSize: '.65em auto',
        paddingRight: '2.5em'
      }}
    >
      {children}
    </select>
  </div>
);

export const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = 'bg-blue-500/20 text-blue-200' }) => (
  <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border border-white/5 ${color}`}>
    {children}
  </span>
);

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-6 border-b border-white/10 sticky top-0 bg-[#1a1c2c]/90 backdrop-blur-xl z-10">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export const DeleteButton: React.FC<{ onDelete: () => void }> = ({ onDelete }) => {
  const [state, setState] = useState<'idle' | 'counting'>('idle');
  const [count, setCount] = useState(3);
  
  useEffect(() => {
    let timer: any;
    if (state === 'counting') {
        if (count > 0) {
            timer = setTimeout(() => setCount(c => c - 1), 1000);
        } else {
            onDelete();
            setState('idle');
            setCount(3);
        }
    }
    return () => clearTimeout(timer);
  }, [state, count, onDelete]);

  if (state === 'counting') {
      return (
          <button onClick={() => { setState('idle'); setCount(3); }} className="px-3 py-1 rounded bg-red-500/80 hover:bg-red-400 text-white text-xs animate-pulse font-bold shadow-lg shadow-red-500/20">
              Cancel ({count})
          </button>
      )
  }

  return (
    <button onClick={() => setState('counting')} className="p-2 hover:bg-red-500/20 text-red-400 rounded-full transition-colors" title="Delete">
        <Trash2 size={16}/>
    </button>
  );
};