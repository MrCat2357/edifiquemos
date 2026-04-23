type InputProps = {
  label: string;
  placeholder?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
};

export default function Input({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
}: InputProps) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>

      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}