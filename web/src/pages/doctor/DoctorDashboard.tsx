import { useEffect, useState } from 'react';
import { Row, Col, Container, Spinner } from 'react-bootstrap';
import { getDoctorDashboardStats } from '../../api/doctorDashboard';
import OverviewCard from '../../components/doctor/OverviewCard';
import TodayScheduleCard from '../../components/doctor/TodayScheduleCard';
import type { DoctorDashboardStats } from '../../api/doctorDashboard';

export default function DoctorDashboard() {
  const [stats, setStats] = useState<DoctorDashboardStats>({
    totalAppointments: 0,
    totalPatients: 0,
    totalShifts: 0,
    todayAppointments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getDoctorDashboardStats();
      setStats(data);
    } catch (err) {
      setError('Không thể tải thống kê');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container fluid className="py-4">
      <div className="mb-4">
        <h4 className="mb-2">Tổng quan</h4>
        <p className="text-muted">Chào mừng trở lại! Đây là tổng quan hoạt động của bạn.</p>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
          <p className="text-muted mt-3">Đang tải dữ liệu...</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <>
          {/* Overview Cards */}
          <Row className="g-4 mb-4">
            <Col md={6} lg={3}>
              <OverviewCard
                title="Tổng số lịch hẹn"
                value={stats.totalAppointments}
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M19 4H5C3.89 4 3 4.9 3 6V20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V9H19V20ZM7 11H9V13H7V11ZM11 11H13V13H11V11ZM15 11H17V13H15V11ZM7 15H9V17H7V15ZM11 15H13V17H11V15ZM15 15H17V17H15V15Z"
                      fill="currentColor"
                    />
                  </svg>
                }
                color="primary"
              />
            </Col>
            <Col md={6} lg={3}>
              <OverviewCard
                title="Tổng số bệnh nhân"
                value={stats.totalPatients}
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z"
                      fill="currentColor"
                    />
                  </svg>
                }
                color="success"
              />
            </Col>
            <Col md={6} lg={3}>
              <OverviewCard
                title="Tổng số ca trực"
                value={stats.totalShifts}
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M11.99 2C6.47 2 2 6.48 2 12C2 17.52 6.47 22 11.99 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 11.99 2ZM12 20C7.58 20 4 16.42 4 12C4 7.58 7.58 4 12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20ZM12.5 7H11V13L16.25 16.15L17 14.92L12.5 12.25V7Z"
                      fill="currentColor"
                    />
                  </svg>
                }
                color="info"
              />
            </Col>
            <Col md={6} lg={3}>
              <OverviewCard
                title="Lịch hẹn hôm nay"
                value={stats.todayAppointments}
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M19 3H18V1H16V3H8V1H6V3H5C3.89 3 3.01 3.9 3.01 5L3 19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V8H19V19ZM7 10H12V15H7V10Z"
                      fill="currentColor"
                    />
                  </svg>
                }
                color="warning"
              />
            </Col>
          </Row>

          {/* Today's Schedule */}
          <Row>
            <Col lg={12}>
              <TodayScheduleCard />
            </Col>
          </Row>
        </>
      )}
    </Container>
  );
}


