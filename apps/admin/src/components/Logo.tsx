import '@fontsource/offside'; // Bold sports-inspired display font

interface LogoProps {
  collapsed?: boolean;
  className?: string;
}

/**
 * PayIn Logo Component
 * Displays a bold "P" using Offside font (sports-inspired bold style)
 */
export function Logo({ collapsed = false, className = '' }: LogoProps) {
  return (
    <div
      className={`
        flex items-center justify-center
        ${collapsed ? 'w-10 h-10' : 'w-12 h-12'}
        ${className}
      `}
    >
      <span
        className="
          text-4xl
          bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600
          dark:from-blue-400 dark:via-blue-500 dark:to-purple-500
          bg-clip-text text-transparent
        "
        style={{ fontFamily: '"Offside", sans-serif' }}
      >
        P
      </span>
    </div>
  );
}
