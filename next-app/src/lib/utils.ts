export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function getDailyGreeting(): string {
  const day = new Date().getDay();
  const greetings: Record<number, string[]> = {
    0: ['Hari Ahad yang tenang. Gunakan masa ini untuk merancang minggu yang lebih teratur.'],
    1: ['Selamat Hari Isnin! Bangun dan bersinar! Setiap hari adalah peluang baru untuk menjadi lebih baik dari semalam.'],
    2: ['Selasa hari yang sibuk. Tapi ingat, setiap perkara besar bermula dengan langkah kecil.'],
    3: ['Selamat Hari Rabu! Pertengahan minggu, jangan kendur. Anda sudah separuh jalan, teruskan dengan lebih gigih.'],
    4: ['Khamis yang cerah! Hampir hujung minggu, tapi jangan lupa tanggungjawab. Selesaikan yang perlu dengan sebaiknya.'],
    5: ['Jumaat yang mulia! Semoga hari ini membawa seribu kebaikan dan keberkatan.'],
    6: ['Sabtu hari rehat. Tapi ingat, masa tidak menunggu. Guna masa lapang dengan bijak.'],
  };
  const pool = greetings[day] || greetings[1];
  return pool[Math.floor(Math.random() * pool.length)];
}
