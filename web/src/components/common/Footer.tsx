import { Link } from 'react-router-dom';
import logo from '../../assets/logo.png';
import '../../styles/footer.css';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer" role="contentinfo" aria-label="Thông tin chân trang">
      <div className="footer-inner container">
        {/* Cột 1: Thương hiệu + địa chỉ */}
        <div className="footer-col footer-brand">
          <div className="brand-line">
            <img src={logo} alt="Clinic Booking" className="brand-logo" />
            <span className="brand-name">Clinic Booking</span>
          </div>
          <ul className="contact-list">
            <li>📍 123 Nguyễn Văn Linh, Hải Châu, TP. Đà Nẵng</li>
            <li>📞 Hotline: 0901 234 567</li>
            <li>✉️ Email: <a href="mailto:lienhe@danangcare.vn">lienhe@clinicbooking.vn</a></li>
            <li>🕒 Giờ làm việc: Thứ 2 – Thứ 7 (7:30 – 17:30)</li>
          </ul>
        </div>

        {/* Cột 2: Dành cho bệnh nhân */}
        <nav className="footer-col" aria-label="Dành cho bệnh nhân">
          <h3 className="col-title">Dành cho bệnh nhân</h3>
          <ul className="link-list">
            <li><Link to="/guide">Hướng dẫn đặt lịch khám</Link></li>
            <li><Link to="/faq">Câu hỏi thường gặp (FAQ)</Link></li>
            <li><Link to="/privacy">Chính sách bảo mật</Link></li>
            <li><Link to="/terms">Điều khoản sử dụng</Link></li>
            <li><Link to="/support">Hỗ trợ trực tuyến</Link></li>
          </ul>
        </nav>

        {/* Cột 3: Mạng xã hội */}
        <div className="footer-col">
          <h3 className="col-title">Mạng xã hội</h3>
          <ul className="social-list">
            <li>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook">
                <span className="social-ico">f</span> Facebook
              </a>
            </li>
            <li>
              <a href="https://zalo.me" target="_blank" rel="noreferrer" aria-label="Zalo">
                <span className="social-ico">Z</span> Zalo
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Copyright */}
      <div className="copyright">
        Copyright © {year} Clinic Booking. All Rights Reserved.
      </div>
    </footer>
  );
}
