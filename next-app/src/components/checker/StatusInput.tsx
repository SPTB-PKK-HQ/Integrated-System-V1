'use client';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  id?: string;
  className?: string;
}

export default function StatusInput({
  value,
  onChange,
  placeholder = '-',
  maxLength = 20,
  id,
  className = '',
}: Props) {
  const bgColor = value === '✓' ? '#dcfce7' : value === 'X' ? '#fee2e2' : '#eff6ff';
  const textColor = value === '✓' ? '#166534' : value === 'X' ? '#991b1b' : '#1e40af';

  return (
    <div className="status-input-container flex items-center gap-1">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`status-input flex-1 px-2 py-1.5 rounded-lg text-sm font-semibold border-2 border-blue-200 outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${className}`}
        style={{ backgroundColor: bgColor, color: textColor }}
      />
      <div className="tick-buttons flex gap-0.5">
        <button
          type="button"
          onClick={() => onChange('✓')}
          className="tick-btn w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold text-sm flex items-center justify-center transition-colors"
          title="Set OK"
        >
          ✓
        </button>
        <button
          type="button"
          onClick={() => onChange('X')}
          className="tick-btn w-7 h-7 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-bold text-sm flex items-center justify-center transition-colors"
          title="Set X"
        >
          ✗
        </button>
      </div>
    </div>
  );
}
