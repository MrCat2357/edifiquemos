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
    "w-full py-2 rounded text-white transition duration-200";

  const styles =
    variant === "primary"
      ? "bg-blue-600 hover:bg-blue-700"
      : "bg-green-600 hover:bg-green-700";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      {children}
    </button>
  );
}