import { Container, Row, Col, Carousel } from 'react-bootstrap';
import { useState, useMemo } from 'react';
import '../../styles/difference-section.css';

const carouselReviewImages = [
  '/picture/carouselReview/anh1.png',
  '/picture/carouselReview/anh2.png',
  '/picture/carouselReview/anh3.png',
  '/picture/carouselReview/anh4.png',
  '/picture/carouselReview/anh5.png',
  '/picture/carouselReview/anh6.png',
  '/picture/carouselReview/anh7.png',
  '/picture/carouselReview/anh8.png',
  '/picture/carouselReview/anh9.png',
];

const VISIBLE_COUNT = 3;

export default function DifferenceSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  const slides = useMemo(() => {
    if (carouselReviewImages.length === 0) return [];
    if (carouselReviewImages.length <= VISIBLE_COUNT) return [carouselReviewImages];

    const groups: string[][] = [];
    // Chia ảnh thành các nhóm 3 ảnh, không lặp lại
    for (let idx = 0; idx < carouselReviewImages.length; idx += VISIBLE_COUNT) {
      groups.push(carouselReviewImages.slice(idx, idx + VISIBLE_COUNT));
    }
    return groups;
  }, []);

  const handleSelect = (selectedIndex: number) => {
    setActiveIndex(selectedIndex);
  };

  return (
    <section className="difference-section py-5">
      <Container>
        <Row className="mb-3">
          <Col md={12} className="text-center">
            <span className="difference-badge mb-2">ĐẲNG CẤP VÀ UY TÍN</span>
            <h2 className="difference-title mt-2 mb-3">CHÚNG TÔI TẠO RA SỰ KHÁC BIỆT</h2>
            <p className="difference-desc mx-auto" style={{ maxWidth: '850px' }}>
              Hệ thống phòng khám là nơi tinh hoa y học hội tụ cùng sự ân cần, nồng hậu. 
              Chúng tôi tạo ra một môi trường hiện đại, an tâm, nơi bác sĩ luôn lắng nghe 
              và bạn chính là trung tâm của dịch vụ y tế chất lượng cao.
            </p>
          </Col>
        </Row>

        {/* Trust Stats Bar */}
        <div className="difference-stats">
          <div className="difference-stat-card">
            <div className="difference-stat-number">50,000+</div>
            <div className="difference-stat-label">Lượt khám an tâm</div>
          </div>
          <div className="difference-stat-card">
            <div className="difference-stat-number">100+</div>
            <div className="difference-stat-label">Bác sĩ chuyên khoa</div>
          </div>
          <div className="difference-stat-card">
            <div className="difference-stat-number">15+</div>
            <div className="difference-stat-label">Năm kinh nghiệm</div>
          </div>
          <div className="difference-stat-card">
            <div className="difference-stat-number">99.2%</div>
            <div className="difference-stat-label">Tỷ lệ hài lòng</div>
          </div>
        </div>

        {slides.length > 0 && (
          <Row className="mt-5">
            <Col md={12}>
              <Carousel
                activeIndex={activeIndex}
                onSelect={handleSelect}
                controls={true}
                indicators={true}
                interval={5000}
                pause="hover"
                className="difference-carousel"
              >
                {slides.map((group, slideIndex) => (
                  <Carousel.Item key={slideIndex}>
                    <Row className="g-3">
                      {group.map((imgSrc, imgIndex) => (
                        <Col key={imgIndex} md={4}>
                          <div className="difference-image-wrapper">
                            <img
                              src={imgSrc}
                              alt={`Hình ảnh phòng khám ${slideIndex * VISIBLE_COUNT + imgIndex + 1}`}
                              className="img-fluid rounded shadow-sm"
                              style={{ width: '100%', height: '300px', objectFit: 'cover' }}
                            />
                          </div>
                        </Col>
                      ))}
                    </Row>
                  </Carousel.Item>
                ))}
              </Carousel>
            </Col>
          </Row>
        )}
      </Container>
    </section>
  );
}

