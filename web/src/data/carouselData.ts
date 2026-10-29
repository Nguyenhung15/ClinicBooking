export type Slide = {
  src: string;
  alt: string;
};

// Sử dụng ảnh từ public/picture/banner/
export const carouselData: Slide[] = [
  {
    src: '/picture/banner/bannertrangchu.jpg',
    alt: 'Đặt lịch khám trực tuyến - Phòng khám chất lượng cao'
  },
  {
    src: '/picture/banner/bannertrangchu2.png',
    alt: 'Đội ngũ bác sĩ chuyên nghiệp - Chăm sóc sức khỏe toàn diện'
  },
  {
    src: '/picture/banner/bannertrangchu3.jpg',
    alt: 'Dịch vụ y tế uy tín - Đồng hành cùng sức khỏe của bạn'
  }
];
