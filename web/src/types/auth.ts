export type UserType = 'Guest' | 'Patient' | 'Doctor' | 'Receptionist' | 'Admin';

export type User = {
  id: string | number;
  email: string;
  fullName?: string;
  phoneNumber?: string;
  userType: UserType;   // <-- QUAN TRỌNG: tên field & kiểu nhất quán
};