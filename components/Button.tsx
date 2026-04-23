type ButtonProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
};

export default function Button({
  children,
  variant = "primary",
}: ButtonProps) {
  const base = "w-full py-2 rounded text-white";

  const styles =
    variant === "primary"
      ? "bg-blue-600 hover:bg-blue-700"
      : "bg-green-600 hover:bg-green-700";

  return <button className={`${base} ${styles}`}>{children}</button>;
}