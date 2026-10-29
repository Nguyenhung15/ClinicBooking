import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { registerAdminApi } from '../../api/auth';
import { getErrorMessage } from '../../utils/error';
import '../../styles/register.css';
import { useToast } from '../../components/common/ToastProvider';

type FormState = {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  gender: 'OTHER';
};

export default function RegisterAdmin() {
  const [form, setForm] = useState<FormState>({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    gender: 'OTHER',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showSuccess } = useToast();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu không trùng khớp');
      return;
    }

    setLoading(true);
    try {
      await registerAdminApi({
        fullName: form.fullName,
        email: form.email,
        phoneNumber: form.phoneNumber,
        password: form.password,
        gender: form.gender, // giữ nguyên như user
      });
      showSuccess('Tạo tài khoản admin thành công!');
      // tuỳ luồng, có thể điều hướng về /admin/login-admin, tạm thời dùng /login
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="register-page">
      <div className="register-card">
        <h1 className="register-title">Tạo tài khoản Admin</h1>

        <form className="register-form" onSubmit={onSubmit}>
          <Input
            name="fullName"
            id="fullName"
            label="Họ và tên"
            value={form.fullName}
            onChange={onChange}
            placeholder="Nhập họ và tên"
            required
          />
          <Input
            name="email"
            id="email"
            label="Email"
            type="email"
            value={form.email}
            onChange={onChange}
            placeholder="you@example.com"
            required
          />
          <Input
            name="phoneNumber"
            id="phoneNumber"
            label="Số điện thoại"
            type="tel"
            value={form.phoneNumber}
            onChange={onChange}
            placeholder="Nhập số điện thoại"
            required
          />
          <Input
            name="password"
            id="password"
            label="Mật khẩu"
            type="password"
            value={form.password}
            onChange={onChange}
            placeholder="••••••••"
            required
          />
          <Input
            name="confirmPassword"
            id="confirmPassword"
            label="Xác nhận mật khẩu"
            type="password"
            value={form.confirmPassword}
            onChange={onChange}
            placeholder="••••••••"
            required
          />

          {/* giữ field gender = OTHER giống trang user, ẩn đi */}
          <input type="hidden" name="gender" value={form.gender} />

          {error && <div className="error-block">{error}</div>}

          <Button type="submit" disabled={loading} className="btn-auth">
            {loading ? 'Đang xử lý…' : 'Đăng ký Admin'}
          </Button>

          <p className="register-login">
            Đã có tài khoản Admin?{' '}
            <Link to="/login">Đăng nhập</Link>
          </p>
        </form>
      </div>
    </section>
  );
}
