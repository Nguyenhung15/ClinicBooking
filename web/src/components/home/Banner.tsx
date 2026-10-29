import { Carousel, Container } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';
import { carouselData } from '../../data/carouselData';
import '../../styles/banner.css';

export default function Banner() {
  return (
    <>
      <section className="banner" aria-label="Banner nổi bật">
        <Carousel
          controls
          indicators
          pause="hover"
          interval={5000}   // ms (null để tắt auto)
          fade              // bỏ nếu muốn slide ngang
          touch
          keyboard
        >
          {carouselData.map((s, i) => (
            <Carousel.Item key={i}>
              <img className="d-block w-100 banner-img" src={s.src} alt={s.alt} />
            </Carousel.Item>
          ))}
        </Carousel>
      </section>

      {/* Quick actions đè lên cạnh dưới của banner */}
      <section className="quick-action" aria-label="Tác vụ nhanh">
        <Container className="quick-action__inner">
          <NavLink to="/appointment" className="qa-btn qa-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="qa-icon" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <line x1="12" y1="14" x2="12" y2="18"/>
              <line x1="10" y1="16" x2="14" y2="16"/>
            </svg>
            <span>Đăng ký ngay</span>
          </NavLink>
          <NavLink to="/doctors" className="qa-btn qa-outline">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="qa-icon" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <circle cx="19" cy="11" r="2"/>
              <path d="M19 13v1a2 2 0 0 1-2 2"/>
            </svg>
            <span>Tìm bác sĩ</span>
          </NavLink>
          <NavLink to="/about" className="qa-btn qa-light">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="qa-icon" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>Tìm hiểu thêm</span>
          </NavLink>
        </Container>
      </section>
    </>
  );
}