
import React, { useState, useEffect } from 'react';
import { Trash2, X } from 'lucide-react';
import { useData } from '../services/dataContext';

// Helper to get theme-specific styles
const useThemeStyles = () => {
  const { settings } = useData();
  const theme = settings.theme;

  const baseStyles = {
    'stained-glass': {
        card: 'glass-panel rounded-2xl text-white',
        cardHeader: 'border-b border-white/10 mb-4 pb-2',
        cardTitle: 'text-xl font-semibold tracking-wide text-white/90',
        input: 'bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:ring-2 focus:ring-blue-500/50',
        buttonPrimary: 'bg-blue-600/80 hover:bg-blue-500/90 text-white shadow-lg shadow-blue-500/30 rounded-xl',
        buttonDanger: 'bg-red-500/80 hover:bg-red-400/90 text-white shadow-lg shadow-red-500/30 rounded-xl',
        buttonSecondary: 'bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl',
        modalOverlay: 'bg-black/60 backdrop-blur-sm',
        modalContent: 'glass-panel rounded-2xl border border-white/10',
    },
    'windows-xp': {
        card: 'bg-[#ECE9D8] border-[3px] border-[#0054E3] rounded-t-lg rounded-b-none shadow-xl text-black font-tahoma xp-window',
        cardHeader: 'xp-header p-2 mb-4 flex justify-between items-center',
        cardTitle: 'text-lg font-bold text-white italic drop-shadow-md',
        input: 'bg-white border-2 border-[#7F9DB9] rounded-none px-2 py-2 text-black shadow-inner focus:outline-none focus:border-[#0054E3]',
        buttonPrimary: 'bg-[linear-gradient(180deg,#3E9B36_0%,#84C63C_100%)] border-2 border-[#fff] outline outline-1 outline-[#333] hover:brightness-110 text-white font-bold rounded px-4 py-1 shadow-sm',
        buttonDanger: 'bg-[linear-gradient(180deg,#e86060_0%,#d13030_100%)] border-2 border-[#fff] outline outline-1 outline-[#333] hover:brightness-110 text-white font-bold rounded px-4 py-1 shadow-sm',
        buttonSecondary: 'bg-[linear-gradient(180deg,#fff_0%,#ece9d8_100%)] border border-[#003c74] text-black hover:bg-[#ffe] rounded px-4 py-1',
        modalOverlay: 'bg-black/30',
        modalContent: 'bg-[#ECE9D8] border-[3px] border-[#0054E3] rounded-t-lg xp-window shadow-2xl',
    },
    'android-16': {
        card: 'bg-white/90 backdrop-blur-md rounded-[24px] shadow-md border border-gray-100 text-slate-800 font-roboto',
        cardHeader: 'mb-4 pb-2 px-2',
        cardTitle: 'text-2xl font-normal text-slate-800',
        input: 'bg-slate-100 border-none rounded-xl px-4 py-4 text-slate-900 focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 transition-all',
        buttonPrimary: 'bg-[#D0BCFF] hover:bg-[#E8DEF8] text-[#381E72] font-medium rounded-full px-6 shadow-sm hover:shadow-md transition-all',
        buttonDanger: 'bg-[#F2B8B5] hover:bg-[#F9DEDC] text-[#601410] font-medium rounded-full px-6 shadow-sm hover:shadow-md transition-all',
        buttonSecondary: 'bg-transparent border border-[#79747E] text-[#381E72] font-medium rounded-full px-6 hover:bg-[#E8DEF8]/20',
        modalOverlay: 'bg-slate-900/40 backdrop-blur-sm',
        modalContent: 'bg-[#FEF7FF] rounded-[28px] shadow-xl',
    }
  };

  return { styles: baseStyles[theme], theme };
};

export const Card: React.FC<{ children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode }> = ({ children, className = '', title, action }) => {
  const { styles, theme } = useThemeStyles();
  
  // Custom structure for XP
  if (theme === 'windows-xp') {
      return (
        <div className={`${styles.card} ${className}`}>
            {(title || action) && (
                <div className={styles.cardHeader}>
                    <div className="flex items-center gap-2">
                        {title && <h3 className={styles.cardTitle}>{title}</h3>}
                    </div>
                    {action && <div className="flex items-center gap-2">{action}</div>}
                    {!action && <div className="flex gap-1 ml-auto">
                        <div className="w-5 h-5 bg-[#D54737] border border-white rounded-[3px] flex items-center justify-center shadow-sm"><X size={12} color="white"/></div>
                    </div>}
                </div>
            )}
            <div className="p-4 pt-2">
                {children}
            </div>
        </div>
      );
  }

  return (
    <div className={`${styles.card} p-6 ${className}`}>
      {(title || action) && (
        <div className={`flex justify-between items-center ${styles.cardHeader}`}>
          {title && <h3 className={styles.cardTitle}>{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'secondary' | 'ghost' }> = ({ children, className = '', variant = 'primary', ...props }) => {
  const { styles } = useThemeStyles();
  
  let variantClass = styles.buttonPrimary;
  if (variant === 'danger') variantClass = styles.buttonDanger;
  if (variant === 'secondary') variantClass = styles.buttonSecondary;
  if (variant === 'ghost') variantClass = 'hover:bg-white/10 text-current opacity-70 hover:opacity-100';

  return (
    <button
      className={`px-4 py-2 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-medium ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => {
    const { styles } = useThemeStyles();
    return (
        <div className="flex flex-col gap-1 w-full">
            {label && <label className="text-xs font-medium opacity-60 ml-1 uppercase tracking-wider text-theme-base">{label}</label>}
            <input
            className={`${styles.input} ${className}`}
            {...props}
            />
        </div>
    );
};

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({ label, className = '', children, ...props }) => {
    const { styles } = useThemeStyles();
    return (
        <div className="flex flex-col gap-1 w-full">
            {label && <label className="text-xs font-medium opacity-60 ml-1 uppercase tracking-wider text-theme-base">{label}</label>}
            <select
            className={`${styles.input} appearance-none cursor-pointer ${className}`}
            {...props}
            style={{
                backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23888888%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
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
};

export const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color }) => {
    const { theme } = useThemeStyles();
    const defaultColor = theme === 'stained-glass' ? 'bg-blue-500/20 text-blue-200' : 'bg-blue-100 text-blue-800 border border-blue-200';
    return (
        <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${color || defaultColor}`}>
            {children}
        </span>
    );
};

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  const { styles, theme } = useThemeStyles();
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${styles.modalOverlay}`}>
      <div className={`${styles.modalContent} w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200`}>
        {theme === 'windows-xp' ? (
             <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>{title}</h2>
                <button onClick={onClose} className="w-5 h-5 bg-[#D54737] border border-white rounded-[3px] flex items-center justify-center shadow-sm">
                    <X size={12} color="white"/>
                </button>
             </div>
        ) : (
            <div className="flex justify-between items-center p-6 border-b border-theme-border sticky top-0 bg-theme-panel/90 backdrop-blur-xl z-10">
                <h2 className="text-xl font-bold text-theme-base">{title}</h2>
                <button onClick={onClose} className="p-2 hover:bg-theme-muted/10 rounded-full transition-colors text-theme-base">
                    <X size={24} />
                </button>
            </div>
        )}
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