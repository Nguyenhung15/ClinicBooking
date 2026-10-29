import { createContext, useState, useContext } from 'react';
import type { ReactNode } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';

export type ToastContextType = {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
};

const ToastContext = createContext<ToastContextType>({ showSuccess: () => {}, showError: () => {} });

export const useToast = (): ToastContextType => useContext(ToastContext);

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<'success' | 'danger'>('success');
  const [msg, setMsg] = useState('');

  const showSuccess = (message: string) => {
    setVariant('success');
    setMsg(message);
    setOpen(true);
  };

  const showError = (message: string) => {
    setVariant('danger');
    setMsg(message);
    setOpen(true);
  };

  return (
    <ToastContext.Provider value={{ showSuccess, showError }}>
      {children}
      <ToastContainer position="top-center" className="p-3">
        <Toast bg={variant} show={open} onClose={() => setOpen(false)} delay={2500} autohide>
          <Toast.Body className="text-white text-center fw-bold">{msg}</Toast.Body>
        </Toast>
      </ToastContainer>
    </ToastContext.Provider>
  );
}