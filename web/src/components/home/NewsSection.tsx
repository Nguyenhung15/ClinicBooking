import { useEffect, useState } from 'react';
import { Container, Row, Col, Card, Spinner } from 'react-bootstrap';
import { fetchLatestNews, type News } from '../../api/news';
import '../../styles/news-section.css';

export default function NewsSection() {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    try {
      setLoading(true);
      const data = await fetchLatestNews(6);
      setNews(data);
    } catch (error) {
      console.error('Error loading news:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('vi-VN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const truncateText = (text: string, maxLength: number = 120) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  const handleNewsClick = (newsItem: News) => {
    if (newsItem.link) {
      window.open(newsItem.link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <section className="news-section py-5">
      <Container>
        <div className="news-section__header text-center mb-5">
          <span className="news-badge">KIẾN THỨC &amp; ĐỜI SỐNG</span>
          <h2 className="news-section__title mt-2">Tin Tức Y Tế &amp; Sức Khỏe</h2>
          <p className="news-section__subtitle text-muted">
            Cập nhật những kiến thức y khoa chuẩn xác, phương pháp phòng bệnh và thông tin hữu ích từ chuyên gia.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Đang tải...</span>
            </Spinner>
            <p className="text-muted mt-3">Đang tải tin tức...</p>
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-5">
            <p className="text-muted">Hiện chưa có tin tức nào.</p>
          </div>
        ) : (
          <Row className="g-4">
            {news.map((item) => (
              <Col key={item.id} md={6} lg={4}>
                <Card
                  className={`news-card h-100 ${item.link ? 'news-card--clickable' : ''}`}
                  onClick={() => item.link && handleNewsClick(item)}
                >
                  {(item.imageUrl || item.image) && (
                    <div className="news-card__image-wrapper">
                      <img
                        src={item.imageUrl || item.image}
                        alt={item.title}
                        className="news-card__image"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <Card.Body className="news-card__body">
                    {item.source && (
                      <div className="news-card__source">
                        <span className="news-card__source-name">{item.source.name}</span>
                        {item.source.category && (
                          <span className="news-card__source-category"> • {item.source.category}</span>
                        )}
                      </div>
                    )}
                    <Card.Title className="news-card__title">{item.title}</Card.Title>
                    {(item.description || item.summary) && (
                      <Card.Text className="news-card__description">
                        {truncateText(item.description || item.summary || '')}
                      </Card.Text>
                    )}
                    <div className="news-card__footer">
                      {item.pubDate && (
                        <small className="text-muted news-card__date">
                          {formatDate(item.pubDate)}
                        </small>
                      )}
                      {item.link && (
                        <small className="news-card__read-more">
                          Đọc thêm →
                        </small>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Container>
    </section>
  );
}

