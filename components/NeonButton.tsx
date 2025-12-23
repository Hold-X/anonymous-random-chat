
import React from 'react';

interface NeonButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const NeonButton: React.FC<NeonButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  isLoading = false,
  icon
}) => {
  const variantStyles = {
    primary: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-[0_0_25px_rgba(236,72,153,0.6)] border-purple-500/20',
    secondary: 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] border-cyan-500/20',
    danger: 'bg-gradient-to-r from-red-600 to-orange-600 hover:shadow-[0_0_25px_rgba(220,38,38,0.6)] border-red-500/20',
  };

  return (
    <button 
      onClick={onClick}
      disabled={isLoading}
      className={`
        relative px-8 py-3.5 rounded-2xl font-black text-sm tracking-[0.2em] text-white uppercase
        transition-all duration-300 border active:scale-95 disabled:opacity-50
        flex items-center justify-center gap-3 overflow-hidden group
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {/* 光泽扫过效果 */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
      
      {isLoading ? (
        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
};
