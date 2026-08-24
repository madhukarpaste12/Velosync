import { useState } from 'react';

const InputField = ({ label, type = 'text', value, onChange, error, placeholder, name }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="input-group">
      <label htmlFor={name}>{label}</label>
      <div className="input-wrapper">
        <input
          id={name}
          name={name}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={error ? 'input-error' : ''}
        />
        {isPassword && (
          <button 
            type="button" 
            className="toggle-password" 
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {error && <span className="error-message">{error}</span>}
    </div>
  );
};

export default InputField;
