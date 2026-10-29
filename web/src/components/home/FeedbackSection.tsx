import { useEffect, useMemo, useState } from "react";
import { Container, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  fetchFeedbackStats,
  fetchPublicFeedbacks,
  type FeedbackItem,
  type FeedbackStats,
} from "../../api/feedback";
import { useAuth } from "../../hooks/useAuth";
import "../../styles/home-feedback.css";

const PAGE_SIZE = 6;

export default function FeedbackSection() {
  const { isAuthenticated, userType } = useAuth();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchPublicFeedbacks(), fetchFeedbackStats()])
      .then(([list, statsData]) => {
        if (!alive) return;
        setFeedbacks(list);
        setStats(statsData);
      })
      .catch((err) => {
        console.error("Không thể tải đánh giá phòng khám:", err);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const filteredFeedbacks = useMemo(() => {
    if (!starFilter) return feedbacks;
    return feedbacks.filter((f) => f.rating === starFilter);
  }, [feedbacks, starFilter]);

  const displayedFeedbacks = useMemo(() => {
    return filteredFeedbacks.slice(0, visibleCount);
  }, [filteredFeedbacks, visibleCount]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="d-inline-flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            style={{
              color: star <= rating ? "#f59e0b" : "#cbd5e1",
              fontSize: "16px",
              lineHeight: 1,
            }}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <section id="clinic-feedbacks" className="home-feedback-section">
      <Container>
        {/* Section Heading */}
        <div className="text-center mb-5">
          <span className="home-feedback-badge">Ý KIẾN KHÁCH HÀNG & BỆNH NHÂN</span>
          <h2 className="home-feedback-title">Cảm Nhận & Đánh Giá Về Phòng Khám</h2>
          <p className="home-feedback-subtitle">
            Sự hài lòng, tin tưởng và sức khoẻ của người bệnh là niềm tự hào và động lực phát triển mỗi ngày của chúng tôi.
          </p>
        </div>

        {/* Overview Score Box */}
        {stats && stats.totalFeedbacks > 0 && (
          <div className="home-feedback-overview">
            {/* Score column */}
            <div className="home-feedback-score-col">
              <div className="home-feedback-score-big">
                {stats.averageRating.toFixed(1)}
              </div>
              <div className="home-feedback-stars-row">
                {renderStars(Math.round(stats.averageRating))}
              </div>
              <div className="home-feedback-score-count">
                Dựa trên <strong>{stats.totalFeedbacks}</strong> lượt đánh giá
              </div>
            </div>

            {/* Distribution bars */}
            <div className="home-feedback-bars">
              {[5, 4, 3, 2, 1].map((s) => {
                const count = stats.starCounts?.[s] || 0;
                const pct =
                  stats.totalFeedbacks > 0
                    ? Math.round((count / stats.totalFeedbacks) * 100)
                    : 0;

                return (
                  <div key={s} className="home-feedback-bar-item">
                    <span className="home-feedback-bar-label">
                      {s} <span style={{ color: "#f59e0b" }}>★</span>
                    </span>
                    <div className="home-feedback-bar-track">
                      <div
                        className="home-feedback-bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="home-feedback-bar-num">{count}</span>
                  </div>
                );
              })}
            </div>

            {/* CTA action */}
            <div className="home-feedback-cta-col">
              {isAuthenticated && userType === "Patient" ? (
                <Link to="/patient/feedback" className="home-feedback-cta-btn">
                  <span>✍️ Viết đánh giá của bạn</span>
                </Link>
              ) : (
                <Link
                  to="/login?redirect=/patient/feedback"
                  className="home-feedback-cta-btn"
                >
                  <span>✍️ Gửi đánh giá phòng khám</span>
                </Link>
              )}
              <span className="home-feedback-cta-sub">
                Đóng góp ý kiến để chúng tôi phục vụ tốt hơn
              </span>
            </div>
          </div>
        )}

        {/* Filter bar */}
        {feedbacks.length > 0 && (
          <div className="home-feedback-filter-bar">
            <button
              type="button"
              className={`home-feedback-filter-chip ${
                starFilter === null ? "is-active" : ""
              }`}
              onClick={() => {
                setStarFilter(null);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              Tất cả ({feedbacks.length})
            </button>
            {[5, 4, 3, 2, 1].map((s) => {
              const count = feedbacks.filter((f) => f.rating === s).length;
              if (count === 0) return null;
              return (
                <button
                  key={s}
                  type="button"
                  className={`home-feedback-filter-chip ${
                    starFilter === s ? "is-active" : ""
                  }`}
                  onClick={() => {
                    setStarFilter(starFilter === s ? null : s);
                    setVisibleCount(PAGE_SIZE);
                  }}
                >
                  {s} sao ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Feedbacks Grid */}
        {loading ? (
          <div className="text-center py-5 text-muted">
            <Spinner animation="border" size="sm" className="me-2" />
            Đang tải đánh giá từ người dùng...
          </div>
        ) : filteredFeedbacks.length === 0 ? (
          <div className="text-center py-5 text-muted bg-white rounded-4 border p-4">
            <p className="mb-2 fs-5 fw-semibold text-secondary">
              Chưa có đánh giá nào được hiển thị
            </p>
            <p className="text-muted mb-3">
              Hãy là người đầu tiên chia sẻ cảm nhận về dịch vụ của chúng tôi!
            </p>
            <Link to="/patient/feedback" className="btn btn-outline-primary btn-sm">
              Gửi đánh giá ngay
            </Link>
          </div>
        ) : (
          <>
            <div className="home-feedback-grid">
              {displayedFeedbacks.map((item) => (
                <div key={item.id} className="home-feedback-card">
                  <div>
                    {/* Header: avatar + name + rating badge */}
                    <div className="home-feedback-card-header">
                      <div className="home-feedback-patient-info">
                        <div
                          className={`home-feedback-avatar ${
                            item.isAnonymous ? "anonymous" : ""
                          }`}
                        >
                          {item.isAnonymous
                            ? "ẨD"
                            : item.patientName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="home-feedback-meta-name">
                            {item.patientName}
                            {item.isAnonymous && (
                              <span className="home-feedback-badge-anon">
                                Ẩn danh
                              </span>
                            )}
                          </div>
                          <span className="home-feedback-meta-date">
                            {formatDate(item.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="home-feedback-stars-badge">
                        ★ {item.rating}
                      </div>
                    </div>

                    {/* Body: category + title + comment */}
                    <div className="home-feedback-card-body">
                      {item.category && (
                        <span className="home-feedback-category">
                          {item.category}
                        </span>
                      )}
                      {item.title && (
                        <h4 className="home-feedback-card-title">{item.title}</h4>
                      )}
                      <p className="home-feedback-card-comment">{item.comment}</p>
                    </div>
                  </div>

                  {/* Clinic response */}
                  {item.adminResponse && (
                    <div className="home-feedback-admin-reply">
                      <div className="home-feedback-admin-title">
                        <span>🏥</span> Phản hồi từ Phòng khám:
                      </div>
                      <div>{item.adminResponse}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* View more / collapse button */}
            {filteredFeedbacks.length > PAGE_SIZE && (
              <div className="home-feedback-more-wrap">
                {visibleCount < filteredFeedbacks.length ? (
                  <button
                    type="button"
                    className="home-feedback-more-btn"
                    onClick={() =>
                      setVisibleCount((prev) => prev + PAGE_SIZE)
                    }
                  >
                    Xem thêm đánh giá ({filteredFeedbacks.length - visibleCount} còn lại)
                  </button>
                ) : (
                  <button
                    type="button"
                    className="home-feedback-more-btn"
                    onClick={() => setVisibleCount(PAGE_SIZE)}
                  >
                    Thu gọn
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </Container>
    </section>
  );
}
