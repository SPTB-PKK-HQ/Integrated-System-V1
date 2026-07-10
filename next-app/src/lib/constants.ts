export const SCRIPT_URL = process.env.NEXT_PUBLIC_SCRIPT_URL || '';
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
export const MAIN_FOLDER_URL = process.env.NEXT_PUBLIC_MAIN_FOLDER_URL || '';
export const MAIN_FOLDER_ID = process.env.NEXT_PUBLIC_MAIN_FOLDER_ID || '';

export const STORAGE_KEYS = {
  SESSION: 'stb_session',
  LOGIN_DATE: 'stb_login_date',
  SFX_VOLUME: 'stb_sfx_volume',
} as const;

export const ROLES = {
  PENGESYOR: 'PENGESYOR',
  PELULUS: 'PELULUS',
  PENGARAH: 'PENGARAH',
  KETUA_SEKSYEN: 'KETUA_SEKSYEN',
  ADMIN: 'ADMIN',
} as const;
