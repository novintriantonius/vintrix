interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 22, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="vx-logo-mark" x1="5" y1="7" x2="27" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#BAE6FD" />
          <stop offset="0.45" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      <path
        d="M7.5 9.75 16 23.25 24.5 9.75"
        stroke="url(#vx-logo-mark)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 9.75H24.5"
        stroke="url(#vx-logo-mark)"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.35"
      />
      <circle cx="7.5" cy="9.75" r="2.75" fill="url(#vx-logo-mark)" />
      <circle cx="24.5" cy="9.75" r="2.75" fill="url(#vx-logo-mark)" />
      <circle cx="16" cy="23.25" r="3.25" fill="url(#vx-logo-mark)" />
    </svg>
  );
}

interface LogoLockupProps {
  size?: number;
  className?: string;
  textClassName?: string;
}

export function LogoLockup({ size = 22, className = '', textClassName = '' }: LogoLockupProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      <span className={`font-semibold tracking-tight ${textClassName}`}>vintrix</span>
    </span>
  );
}
