
import React from 'react';

interface AvatarProps {
  src: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isBlinking?: boolean;
  onClick?: () => void;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, size = 'md', isBlinking = false, onClick, className = '' }) => {
  const sizeMap = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32',
  };

  return (
    <div 
      onClick={onClick}
      className={`relative group cursor-pointer transition-all duration-500 active:scale-90 ${sizeMap[size]} ${className}`}
    >
      {/* 霓虹边框 */}
      <div className={`
        absolute inset-0 rounded-full border-2 
        ${isBlinking ? 'animate-breathe' : 'border-white/10'} 
        transition-all duration-500 
        group-hover:border-cyan-400 group-hover:shadow-[0_0_15px_rgba(34,211,238,0.5)]
      `}></div>
      
      {/* 内部填充 */}
      <div className="absolute inset-1 rounded-full overflow-hidden bg-slate-900 shadow-inner">
        <img 
          src={src} 
          alt="Avatar" 
          className="w-full h-full object-cover p-1 opacity-90 group-hover:opacity-100 transition-opacity"
        />
      </div>

      {/* 在线指示器 */}
      {isBlinking && (
        <span className="absolute -bottom-0.5 -right-0.5 w-1/4 h-1/4 min-w-[8px] min-h-[8px] bg-green-500 border-2 border-slate-950 rounded-full shadow-[0_0_8px_#22c55e]"></span>
      )}
    </div>
  );
};
