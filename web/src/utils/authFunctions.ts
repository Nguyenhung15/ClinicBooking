/**
 * ============================
 *  AUTH FUNCTION UTILITIES
 *  Dùng chung cho Login & Register
 * ============================
 */

export type RegisterForm = {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
};

/** Kiểm tra định dạng email */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


/**
 * Xử lý đăng nhập
 * @param email
 * @param password
 */
export async function handleLogin(email: string, password: string): Promise<void> {
  if (!email || !password) throw new Error('Vui lòng nhập đầy đủ thông tin');
  if (!validateEmail(email)) throw new Error('Email không hợp lệ');

  const res = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (!res.ok) throw new Error('Sai email hoặc mật khẩu');  
}

/**
 * Xử lý đăng ký
 * @param form Dữ liệu form đăng ký
 */
export async function handleRegister(form: RegisterForm): Promise<void> {
  const { fullName, email, phoneNumber, password, confirmPassword } = form;

  // ===== VALIDATION =====
  if (!fullName.trim()) throw new Error('Vui lòng nhập họ và tên');
  if (!email.trim()) throw new Error('Vui lòng nhập email');
  if (!validateEmail(email)) throw new Error('Email không hợp lệ');
  if (!phoneNumber.trim()) throw new Error('Vui lòng nhập số điện thoại');
  if (!password) throw new Error('Vui lòng nhập mật khẩu');
  if (password.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
  if (password !== confirmPassword) throw new Error('Mật khẩu xác nhận không khớp');


  // TODO: Thay bằng API thật, ví dụ:
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error('Email đã tồn tại hoặc dữ liệu không hợp lệ');
}

/**
 * Gọi API quên mật khẩu (nếu cần sau này)
 */
export async function handleForgotPassword(email: string): Promise<void> {
  if (!email) throw new Error('Vui lòng nhập email');
  if (!validateEmail(email)) throw new Error('Email không hợp lệ');
  // await fakeDelay();
  console.log('Password reset email sent to:', email);
}