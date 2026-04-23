import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export const Logo = ({ className, showText = true }: LogoProps) => (
  <div className={cn("flex items-center gap-2", className)}>
    <div className="relative h-9 w-9 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center">
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-primary-foreground">
        <path d="M4 18V6l8 8V6l8 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
    {showText && (
      <span className="text-xl font-semibold tracking-tight text-foreground">
        Nivra
      </span>
    )}
  </div>
);
