import { Row, Col, Card, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import type { Doctor } from '../../api/doctor';
import '../../styles/doctor-card.css';

interface DoctorCardListProps {
  doctors: Doctor[];
}

export default function DoctorCardList({ doctors }: DoctorCardListProps) {
  const navigate = useNavigate();

  if (doctors.length === 0) {
    return (
      <div className="text-center py-5">
        <p className="text-muted">Không tìm thấy bác sĩ nào.</p>
      </div>
    );
  }

  return (
    <Row className="g-4 justify-content-center">
      {doctors.map((doctor) => (
        <Col key={doctor.id} md={6} lg={4}>
          <Card className="doctor-card h-100">
            <div className="doctor-card__image-wrapper">
              <img
                src="/img/doctor-placeholder.jpg"
                alt={doctor.fullName}
                className="doctor-card__image"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/img/doctor-placeholder.jpg';
                }}
              />
            </div>
            <Card.Body className="doctor-card__body">
              <Card.Title className="doctor-card__name">{doctor.fullName}</Card.Title>
              {doctor.degree && (
                <Card.Subtitle className="doctor-card__degree">{doctor.degree}</Card.Subtitle>
              )}
              {doctor.specialtyName && (
                <p className="doctor-card__specialty">{doctor.specialtyName}</p>
              )}
              {doctor.experience && (
                <p className="doctor-card__experience">Kinh nghiệm: {doctor.experience}</p>
              )}
              {doctor.description && (
                <Card.Text className="doctor-card__description">{doctor.description}</Card.Text>
              )}
              <div className="doctor-card__actions">
                <Button
                  variant="outline-primary"
                  size="sm"
                  className="doctor-card__btn"
                  onClick={() => navigate('/doctors')}
                >
                  Xem thông tin
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="doctor-card__btn"
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set('doctorId', String(doctor.id));
                    if (doctor.specialtyId) {
                      params.set('specialtyId', String(doctor.specialtyId));
                    }
                    navigate(`/appointment?${params.toString()}`);
                  }}
                >
                  Đặt lịch ngay
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  );
}


