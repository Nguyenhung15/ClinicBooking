import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { UserType } from '../../types/auth';

export default function RequireRole({ allow }: { allow: UserType[] }) {
  const { userType } = useAuth();
  return allow.includes(userType) ? <Outlet /> : <Navigate to="/403" replace />;
}