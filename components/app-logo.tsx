import { cn } from "@/lib/utils";

type AppLogoProps = {
  className?: string;
  /** Pixel size (width & height). Default 32. */
  size?: number;
};

/** Simple brand mark: rounded tile + upward trend line. */
export function AppLogo({ className, size = 32 }: AppLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M8 22 L14 14 L20 18 L26 8"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
