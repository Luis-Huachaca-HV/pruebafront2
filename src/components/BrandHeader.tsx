type BrandHeaderProps = {
  subtitle: string;
  className?: string;
};

const BrandHeader = ({ subtitle, className = "" }: BrandHeaderProps) => {
  return (
    <div className={`flex flex-col items-center text-center animate-fade-in ${className}`.trim()}>
      <img
        src="/sumac-travel-logo.jpeg"
        alt="Logo de Sumac Travel"
        className="w-64 max-w-[82vw] object-contain drop-shadow-sm"
      />
      <p className="mt-4 text-sm font-medium text-slate-500 sm:text-base">{subtitle}</p>
    </div>
  );
};

export default BrandHeader;
