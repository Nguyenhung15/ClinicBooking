import { useState } from 'react';
import { Link } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { forgotPasswordApi } from '../../api/auth';
import { getErrorMessage } from '../../utils/error';
import '../../styles/login.css';
import { useToast } from '../../components/common/ToastProvider';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { showSuccess } = useToast();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await forgotPasswordApi({ email });
      setSuccess(true);
      showSuccess('Email đã được gửi thành công! Vui lòng kiểm tra hộp thư của bạn.');
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Không thể gửi email. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <section className="login-page">
        <div className="login-card">
          <div className="success-message">
            <h2>Email đã được gửi!</h2>
            <p>Chúng tôi đã gửi mật khẩu mới đến email <strong>{email}</strong>.</p>
            <p>Vui lòng kiểm tra hộp thư của bạn và sử dụng mật khẩu tạm thời để đăng nhập.</p>
            <p>Sau khi đăng nhập, bạn sẽ được chuyển đến trang thay đổi mật khẩu.</p>
            <div style={{ marginTop: '20px' }}>
              <Link to="/login" className="btn-auth" style={{ display: 'inline-block', textDecoration: 'none' }}>
                Quay lại đăng nhập
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
        <h1 className="register-title">Quên mật khẩu</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
          Nhập email của bạn để nhận mật khẩu mới
        </p>

        <form onSubmit={onSubmit} className="login-form">
          <Input
            id="email"
            name="email"
            label="Email"
            type="email"
            value={email}
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {error && (
            <div className="error-block">
              <p>{error}</p>
            </div>
          )}

          <Button type="submit" disabled={loading} className="btn-auth">
            {loading ? 'Đang gửi…' : 'Gửi mật khẩu mới'}
          </Button>

          <p className="login-register">
            Nhớ mật khẩu? <Link to="/login">Đăng nhập</Link>
          </p>
        </form>
      </div>
    </section>
  );
}

