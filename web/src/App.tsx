import AppRoutes from './routes/Index';
import { AuthProvider } from './hooks/useAuth';
import ToastProvider from './components/common/ToastProvider';

export default function App(){
  return (
    <AuthProvider>
      <ToastProvider >
        <main style={{ flex:1 }}>
          <AppRoutes />
        </main>
      </ToastProvider>
    </AuthProvider>
  );
}