import { Card, Badge, Spinner } from 'react-bootstrap';
import { useEffect, useState } from 'react';
import { getTodaySchedule, type TodayScheduleItem } from '../../api/doctorDashboard';
import './TodayScheduleCard.css';

export default function TodayScheduleCard() {
  const [schedule, setSchedule] = useState<TodayScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getTodaySchedule();
      setSchedule(data);
    } catch (err) {
      setError('Không thể tải lịch khám hôm nay');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusUpper = status.toUpperCase();
    if (statusUpper === 'CONFIRMED') {
      return <Badge bg="primary">Đã xác nhận</Badge>;
    }
    if (statusUpper === 'CHECKED_IN') {
      return <Badge bg="success">Đã check-in</Badge>;
    }
    if (statusUpper === 'IN_PROGRESS') {
      return <Badge bg="info">Đang khám</Badge>;
    }
    return <Badge bg="secondary">{status}</Badge>;
  };

  const formatTime = (time: string) => {
    if (!time) return 'N/A';
    return time.slice(0, 5); // HH:mm
  };

  return (
    <Card className="today-schedule-card">
      <Card.Header className="today-schedule-card__header">
        <h5 className="mb-0">Lịch khám hôm nay</h5>
        <small className="text-muted">
          {new Date().toLocaleDateString('vi-VN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </small>
      </Card.Header>
      <Card.Body className="today-schedule-card__body">
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" />
            <p className="text-muted mt-2 mb-0">Đang tải...</p>
          </div>
        ) : error ? (
          <div className="text-center py-4 text-danger">
            <p>{error}</p>
          </div>
        ) : schedule.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted mb-0">Không có lịch khám nào hôm nay</p>
          </div>
        ) : (
          <div className="today-schedule-card__list">
            {schedule.map((item) => (
              <div key={item.id} className="today-schedule-card__item">
                <div className="today-schedule-card__time">
                  {formatTime(item.appointmentTime)}
                </div>
                <div className="today-schedule-card__info">
                  <div className="today-schedule-card__patient">
                    {item.patientName}
                  </div>
                  {item.reason && (
                    <div className="today-schedule-card__reason">
                      {item.reason}
                    </div>
                  )}
                </div>
                <div className="today-schedule-card__meta">
                  {getStatusBadge(item.status)}
                  {item.type === 'ONLINE' && (
                    <Badge bg="info" className="ms-2">
                      Online
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

