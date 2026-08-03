type FlagCode = "BR" | "MX" | "EU" | "US" | "CU";

function Br() {
  return (
    <svg viewBox="0 0 60 42" className="h-full w-full">
      <rect width="60" height="42" fill="#009B3A" />
      <path d="M30 4 56 21 30 38 4 21Z" fill="#FEDF00" />
      <circle cx="30" cy="21" r="9" fill="#002776" />
      <path d="M21.5 18.5c6 -2 11.5 1 17 5.2" stroke="#fff" strokeWidth="2.2" fill="none" />
    </svg>
  );
}
function Mx() {
  return (
    <svg viewBox="0 0 60 42" className="h-full w-full">
      <rect width="20" height="42" fill="#006847" />
      <rect x="20" width="20" height="42" fill="#fff" />
      <rect x="40" width="20" height="42" fill="#CE1126" />
      <circle cx="30" cy="21" r="5.5" fill="#8C6239" />
      <circle cx="30" cy="21" r="3" fill="#006847" />
    </svg>
  );
}
function Eu() {
  return (
    <svg viewBox="0 0 60 42" className="h-full w-full">
      <rect width="60" height="42" fill="#003399" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * Math.PI) / 6;
        return (
          <circle
            key={i}
            cx={30 + Math.sin(a) * 11}
            cy={21 - Math.cos(a) * 11}
            r="1.7"
            fill="#FFCC00"
          />
        );
      })}
    </svg>
  );
}
function Us() {
  return (
    <svg viewBox="0 0 60 42" className="h-full w-full">
      <rect width="60" height="42" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={i * 3.23} width="60" height="3.23" fill="#B22234" />
      ))}
      <rect width="26" height="22.6" fill="#3C3B6E" />
      {Array.from({ length: 12 }).map((_, i) => (
        <circle
          key={i}
          cx={4 + (i % 4) * 6.5}
          cy={5 + Math.floor(i / 4) * 6.5}
          r="1.4"
          fill="#fff"
        />
      ))}
    </svg>
  );
}
function Cu() {
  return (
    <svg viewBox="0 0 60 42" className="h-full w-full">
      <rect width="60" height="42" fill="#fff" />
      {[0, 2, 4].map((i) => (
        <rect key={i} y={i * 8.4} width="60" height="8.4" fill="#002A8F" />
      ))}
      <path d="M0 0 26 21 0 42Z" fill="#CF142B" />
      <path
        d="M9 15.2l1.6 4.4 4.7.1-3.7 2.9 1.3 4.5-3.9-2.7-3.9 2.7 1.3-4.5-3.7-2.9 4.7-.1z"
        fill="#fff"
      />
    </svg>
  );
}

const MAP: Record<FlagCode, () => JSX.Element> = { BR: Br, MX: Mx, EU: Eu, US: Us, CU: Cu };

export function FlagIcon({
  code,
  className = "h-6 w-9",
}: {
  code: string;
  className?: string;
}) {
  const Cmp = MAP[(code as FlagCode) in MAP ? (code as FlagCode) : "CU"];
  return (
    <span
      aria-hidden
      className={`${className} inline-block shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10`}
    >
      <Cmp />
    </span>
  );
}
