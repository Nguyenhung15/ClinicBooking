import { http } from './http';

export interface DoctorDashboardStats {
  totalAppointments: number;
  totalPatients: number;
  totalShifts: number;
  todayAppointments: number;
}

export interface TodayScheduleItem {
  id: number;
  appointmentTime: string;
  patientName: string;
  status: string;
  type?: 'ONLINE' | 'OFFLINE';
  reason?: string;
}

// Lấy thống kê tổng quan
export async function getDoctorDashboardStats(): Promise<DoctorDashboardStats> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Lấy tất cả appointments của doctor
    const appointmentsRes = await http.get('/appointments/status/ALL');
    const allAppointments = appointmentsRes.data?.data || appointmentsRes.data || [];
    
    // Lấy appointments hôm nay
    const todayRes = await http.get(`/appointments/status/ALL?date=${today}`);
    const todayAppointments = todayRes.data?.data || todayRes.data || [];
    
    // Lấy shifts của doctor
    const shiftsRes = await http.get('/shifts/my');
    const shifts = shiftsRes.data?.data || shiftsRes.data || [];
    
    // Đếm số bệnh nhân unique
    const uniquePatients = new Set(
      allAppointments
        .map((apt: any) => apt.patient?.id || apt.patientId)
        .filter((id: any) => id != null)
    );
    
    return {
      totalAppointments: allAppointments.length,
      totalPatients: uniquePatients.size,
      totalShifts: shifts.length,
      todayAppointments: todayAppointments.length,
    };
  } catch (error) {
    console.error('Error fetching doctor dashboard stats:', error);
    return {
      totalAppointments: 0,
      totalPatients: 0,
      totalShifts: 0,
      todayAppointments: 0,
    };
  }
}

// Lấy lịch khám hôm nay
export async function getTodaySchedule(): Promise<TodayScheduleItem[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await http.get(`/appointments/status/ALL?date=${today}`);
    const appointments = res.data?.data || res.data || [];
    
    return appointments
      .filter((apt: any) => {
        // Chỉ lấy appointments có status phù hợp (CONFIRMED, CHECKED_IN, IN_PROGRESS)
        const status = apt.status?.toUpperCase() || '';
        return ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'].includes(status);
      })
      .map((apt: any) => ({
        id: apt.id,
        appointmentTime: apt.appointmentTime || apt.time || '',
        patientName: apt.patientName || apt.patient?.fullName || 'N/A',
        status: apt.status || '',
        type: apt.type || apt.appointmentType,
        reason: apt.reason || '',
      }))
      .sort((a: TodayScheduleItem, b: TodayScheduleItem) => {
        // Sắp xếp theo thời gian
        return (a.appointmentTime || '').localeCompare(b.appointmentTime || '');
      });
  } catch (error) {
    console.error('Error fetching today schedule:', error);
    return [];
  }
}

