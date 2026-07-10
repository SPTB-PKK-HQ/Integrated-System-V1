export interface User {
  name: string;
  email: string;
  role: Role;
  color: string;
  phone: string;
  imageUrl: string;
  signUrl: string;
  copUrl: string;
  firebaseCode?: string;
}

export type Role = 'PENGESYOR' | 'PELULUS' | 'PENGARAH' | 'KETUA_SEKSYEN' | 'ADMIN';

export interface ApplicationRecord {
  row: number;
  syarikat: string;
  cidb: string;
  gred: string;
  jenis: string;
  negeri: string;
  tarikh_surat: string;
  start_date: string;
  status: string;
  pengesyor: string;
  syor_status: string;
  tarikh_syor: string;
  pelulus: string;
  keputusan: string;
  tarikh_lulus: string;
  date_submit: string;
  pautan: string;
  pautan_drive: string;
  justifikasi: string;
  alamat_perniagaan: string;
  tatatertib: string;
  syor_lawatan: string;
  borang_json: string;
  no_telefon: string;
  tarikh_masuk_sheet: string;
  status_hantar_spi: string;
  pemadam: string;
  kelulusan?: string;
  alasan?: string;
  jenis_konsultansi?: string;
  [key: string]: unknown;
}

export interface AuthResponse {
  authenticated: boolean;
  user?: User;
  message?: string;
  error?: string;
  code?: number;
}

export interface AIProcessResponse {
  success: boolean;
  data?: Record<string, unknown>;
  provider?: string;
  error?: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  description: string;
}

export interface InboxItem {
  id: string;
  message: string;
  type: string;
  read: boolean;
  timestamp: string;
}

export interface QueueData {
  status: string;
  siasat: unknown[];
  pemutihan: unknown[];
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  url: string;
}
