import React from 'react';

const Slider: React.FC<{
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}> = ({value, onChange, min = 0, max = 4}) => (
  <input
    type="number"
    min={min}
    max={max}
    value={value}
    onChange={(e) => {
      const n = parseInt(e.target.value, 10);
      if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
    }}
    placeholder={`${min}-${max}`}
    style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 120,
      padding: '10px 14px',
      fontSize: 18,
      textAlign: 'center',
      borderRadius: 8,
      border: '1px solid #334155',
      background: '#0f172a',
      color: '#f8fafc',
      outline: 'none',
    }}
  />
);

export default Slider;
