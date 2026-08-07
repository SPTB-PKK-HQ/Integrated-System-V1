var BANK_LIST = [
  'MAYBANK',
  'CIMB BANK',
  'PUBLIC BANK',
  'RHB BANK',
  'HONG LEONG BANK',
  'AMBANK',
  'UOB MALAYSIA',
  'OCBC BANK',
  'STANDARD CHARTERED',
  'HSBC MALAYSIA',
  'CITIBANK',
  'BANK ISLAM MALAYSIA',
  'BANK RAKYAT',
  'BSN',
  'AFFIN BANK',
  'ALLIANCE BANK',
  'BANK MUAMALAT',
  'MBSB BANK',
  'AGROBANK',
  'AL RAJHI BANK',
  'KUWAIT FINANCE HOUSE',
  'BANK OF CHINA (MALAYSIA)',
  'ICBC (MALAYSIA)',
  'SMBC (MALAYSIA)',
  'MIZUHO BANK (MALAYSIA)',
  'MUFG BANK (MALAYSIA)',
  'DEUTSCHE BANK',
  'J.P. MORGAN',
  'BNP PARIBAS (MALAYSIA)',
  'GOLDMAN SACHS',
  'BANK OF AMERICA',
  'MAYBANK ISLAMIC',
  'CIMB ISLAMIC',
  'PUBLIC ISLAMIC BANK',
  'RHB ISLAMIC',
  'HONG LEONG ISLAMIC',
  'AFFIN ISLAMIC',
  'AMBANK ISLAMIC',
  'ALLIANCE ISLAMIC',
  'HSBC AMANAH',
  'STANDARD CHARTERED SAADIQ',
  'OCBC AL-AMIN',
  'SME BANK',
  'EXIM BANK',
  'BANK PEMBANGUNAN MALAYSIA',
  'AEON BANK (MALAYSIA)',
  'GX BANK',
  'BOOST BANK'
];

var BANK_GENERIC_LOGO = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#e2e8f0"/><path d="M12 6l8 4H4l8-4zm-6 6h12v6H6v-6zm3 1v3m3-3v3m3-3v3" fill="none" stroke="#475569" stroke-width="1.5"/></svg>'
);

var BANK_COLORS = ['#1d4ed8', '#0e7490', '#047857', '#b91c1c', '#7c3aed', '#a16207', '#be185d', '#0f766e', '#4338ca', '#ea580c', '#334155', '#4d7c0f'];

function bankHash(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function bankLogoDataURI(name) {
  var parts = String(name || '').split(/\s+/).filter(Boolean);
  var ab;
  if (parts.length === 0) {
    ab = 'BK';
  } else if (parts.length === 1) {
    ab = parts[0].substring(0, 2);
  } else {
    ab = parts.slice(0, 2).map(function (p) { return p.charAt(0); }).join('');
  }
  ab = ab.toUpperCase();
  var color = BANK_COLORS[bankHash(name || 'BANK') % BANK_COLORS.length];
  var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#0f172a'/><rect x='4' y='4' width='56' height='56' rx='12' fill='" + color + "'/><text x='50%' y='56%' dominant-baseline='middle' text-anchor='middle' font-family='Arial, Helvetica, sans-serif' font-size='22' font-weight='bold' fill='#ffffff'>" + ab + "</text></svg>";
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

BANK_LIST = BANK_LIST.map(function (n) { return { name: n, logo: bankLogoDataURI(n) }; });