type ButtonProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
};

export default function Button({
  children,
  variant = "primary",
  disabled = false,
  type = "button",
  onClick,
}: ButtonProps) {
  const base =
    "w-full py-2 rounded transition duration-200 text-center";

  const styles =
    variant === "primary"
      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
      : "bg-emerald-600 hover:bg-emerald-700 text-white";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer active:scale-95 active:translate-y-0.5 shadow-md"
      }`}
    >
      {children}
    </button>
  );
}