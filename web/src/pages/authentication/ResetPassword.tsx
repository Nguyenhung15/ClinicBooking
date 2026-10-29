import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { resetPasswordApi } from '../../api/auth';
import { getErrorMessage } from '../../utils/error';
import '../../styles/login.css';
import { useToast } from '../../components/common/ToastProvider';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  
  const [form, setForm] = useState({
    email: email,
    temporaryPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { showSuccess } = useToast();

  useEffect(() => {
    if (email) {
      setForm((prev) => ({ ...prev, email }));
    }
  }, [email]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validation
    if (!form.email) {
      setError('Vui lòng nhập email');
      return;
    }

    if (!form.temporaryPassword) {
      setError('Vui lòng nhập mật khẩu tạm thời từ email');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('Mật khẩu mới không trùng khớp');
      return;
    }

    if (form.newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    setLoading(true);
    try {
      await resetPasswordApi({
        email: form.email,
        temporaryPassword: form.temporaryPassword,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });
      setSuccess(true);
      showSuccess('Đổi mật khẩu thành công!');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Không thể đổi mật khẩu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <section className="login-page">
        <div className="login-card">
          <div className="success-message">
            <h2>Đổi mật khẩu thành công!</h2>
            <p>Mật khẩu của bạn đã được thay đổi thành công.</p>
            <p>Bạn sẽ được chuyển đến trang đăng nhập trong giây lát...</p>
            <div style={{ marginTop: '20px' }}>
              <Link to="/login" className="btn-auth" style={{ display: 'inline-block', textDecoration: 'none' }}>
                Đăng nhập ngay
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="login-page">
      <div className="login-card">
        <h1 className="register-title">Thay đổi mật khẩu</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
          Nhập mật khẩu tạm thời từ email và mật khẩu mới của bạn
        </p>

        <form onSubmit={onSubmit} className="login-form">
          <Input
            id="email"
            name="email"
            label="Email"
            type="email"
            value={form.email}
            placeholder="you@example.com"
            onChange={onChange}
            required
            disabled={!!email}
          />

          <Input
            id="temporaryPassword"
            name="temporaryPassword"
            label="Mật khẩu tạm thời (từ email)"
            type="password"
            value={form.temporaryPassword}
            placeholder="Nhập mật khẩu từ email"
            onChange={onChange}
            required
          />

          <Input
            id="newPassword"
            name="newPassword"
            label="Mật khẩu mới"
            type="password"
            value={form.newPassword}
            placeholder="••••••••"
            onChange={onChange}
            required
          />

          <Input
            id="confirmPassword"
            name="confirmPassword"
            label="Xác nhận mật khẩu mới"
            type="password"
            value={form.confirmPassword}
            placeholder="••••••••"
            onChange={onChange}
            required
          />

          {error && (
            <div className="error-block">
              <p>{error}</p>
            </div>
          )}

          <Button type="submit" disabled={loading} className="btn-auth">
            {loading ? 'Đang xử lý…' : 'Đổi mật khẩu'}
          </Button>

          <p className="login-register">
            <Link to="/login">Quay lại đăng nhập</Link>
          </p>
        </form>
      </div>
    </section>
  );
}

