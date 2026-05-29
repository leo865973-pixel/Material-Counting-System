const { useState, useEffect, useRef } = React;

// ============================================================================
// Icon Component
// ============================================================================
window.Icon = ({ name, className = '' }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide && window.lucide.icons[name]) {
      ref.current.innerHTML = '';
      const iconNode = window.lucide.createElement(window.lucide.icons[name]);
      iconNode.setAttribute('class', 'w-full h-full');
      iconNode.setAttribute('stroke-width', '1.5'); 
      ref.current.appendChild(iconNode);
    }
  }, [name]);
  return <span ref={ref} className={`inline-flex items-center justify-center ${className}`}></span>;
};

// ============================================================================
// UI Components
// ============================================================================
window.Badge = ({ children, className = '' }) => (
  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase border ${className}`}>
    {children}
  </span>
);

window.Button = ({ children, variant = 'primary', size = 'default', className = '', disabled, isLoading, ...props }) => {
  const baseStyle = "inline-flex items-center justify-center rounded-full font-medium transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]/50 disabled:pointer-events-none disabled:opacity-50 cursor-pointer relative active:scale-[0.97]";
  const variants = {
    primary: "bg-[#1d1d1f] text-white hover:bg-[#424245] shadow-[0_4px_14px_rgba(0,0,0,0.1)]",
    secondary: "bg-white text-[#1d1d1f] hover:bg-[#f5f5f7] border border-[#d2d2d7] shadow-sm",
    outline: "border border-[#d2d2d7] bg-transparent hover:bg-[#f5f5f7] text-[#1d1d1f]",
    ghost: "hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]",
    danger: "bg-[#ff3b30] text-white hover:bg-[#d70015] shadow-[0_4px_14px_rgba(255,59,48,0.2)]",
    success: "bg-[#34c759] text-white hover:bg-[#248a3d] shadow-[0_4px_14px_rgba(52,199,89,0.2)]"
  };
  const sizes = {
    default: "h-10 px-4 sm:px-5 text-sm",
    sm: "h-8 px-3 sm:px-4 text-xs",
    lg: "h-12 px-6 sm:px-8 text-base"
  };
  return (
    <button disabled={disabled || isLoading} className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {isLoading ? <window.Icon name="Loader2" className="w-4 h-4 mr-2 animate-spin" /> : null}
      {children}
    </button>
  );
};

window.Input = ({ className = '', ...props }) => (
  <input 
    className={`flex h-11 w-full rounded-xl border border-[#d2d2d7] bg-white/50 px-4 py-2 text-sm text-[#1d1d1f] shadow-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0066cc]/10 focus-visible:border-[#0066cc] disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur-md placeholder:text-[#86868b] ${className}`}
    {...props}
  />
);

window.Card = ({ children, className = '' }) => (
  <div className={`rounded-2xl sm:rounded-3xl border border-[#d2d2d7]/50 bg-white/80 backdrop-blur-2xl text-[#1d1d1f] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col transition-all duration-300 ${className}`}>
    {children}
  </div>
);

window.Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-md" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1d1d1f]/20 backdrop-blur-sm p-4 transition-all duration-300">
      <div className={`bg-white/90 backdrop-blur-3xl border border-[#d2d2d7]/50 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.1)] w-full ${maxWidth} flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#d2d2d7]/30 shrink-0">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-[#1d1d1f]">{title}</h2>
          <button onClick={onClose} className="text-[#86868b] hover:text-[#1d1d1f] transition-colors bg-[#f5f5f7] hover:bg-[#e5e5ea] p-2 rounded-full"><window.Icon name="X" className="w-5 h-5"/></button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Notification Toast System
// ============================================================================
let toastListener = null;
window.showToast = (message, type = 'info') => {
  if (toastListener) toastListener(message, type);
};

window.ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastListener = (message, type) => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    };
    return () => { toastListener = null; };
  }, []);

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:top-6 sm:right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] text-white transform transition-all duration-300 animate-in slide-in-from-top-5 fade-in backdrop-blur-xl border border-white/10 ${t.type === 'success' ? 'bg-[#34c759]/90' : t.type === 'error' ? 'bg-[#ff3b30]/90' : 'bg-[#1d1d1f]/90'}`}>
          <window.Icon name={t.type === 'success' ? 'CheckCircle2' : t.type === 'error' ? 'X' : 'Info'} className="w-5 h-5 mr-3 opacity-90 shrink-0" />
          <span className="font-medium tracking-wide text-sm">{t.message}</span>
        </div>
      ))}
    </div>
  );
};