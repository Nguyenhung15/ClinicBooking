import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};
export default function Input({ label, error, id, ...rest }: Props){
  return (
    <div>
      {label && <label className="label" htmlFor={id}>{label}</label>}
      <input className="input" id={id} {...rest}/>
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}
