interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className = '' }: BrandMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M12 2L21.5 19.5H16.2L12 11.4L7.8 19.5H2.5L12 2Z"
          fill="#F4F5F7"
        />
        <path
          d="M12 14.5L14.7 19.5H9.3L12 14.5Z"
          fill="#E5383B"
        />
      </svg>
      <span className="font-display text-lg font-bold tracking-[0.14em] text-[#F4F5F7]">
        ANIVEXA
      </span>
    </span>
  );
}
