import logo from "@/assets/logo.png";

export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <img
      src={logo}
      alt="VIP Remesas"
      width={256}
      height={256}
      className={`${className} rounded-lg object-cover shadow-gold`}
    />
  );
}
