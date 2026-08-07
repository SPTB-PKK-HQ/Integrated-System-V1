var BANK_LIST = [
  { name: 'MAYBANK', logo: 'banks/MAYBANK.png' },
  { name: 'CIMB BANK', logo: 'banks/CIMB-BANK.png' },
  { name: 'PUBLIC BANK', logo: 'banks/PUBLIC-BANK.png' },
  { name: 'RHB BANK', logo: 'banks/RHB-BANK.png' },
  { name: 'HONG LEONG BANK', logo: 'banks/HONG-LEONG-BANK.png' },
  { name: 'AMBANK', logo: 'banks/AMBANK.png' },
  { name: 'UOB MALAYSIA', logo: 'banks/UOB-MALAYSIA.png' },
  { name: 'OCBC BANK', logo: 'banks/OCBC-BANK.png' },
  { name: 'STANDARD CHARTERED', logo: 'banks/STANDARD-CHARTERED.png' },
  { name: 'HSBC MALAYSIA', logo: 'banks/HSBC-MALAYSIA.png' },
  { name: 'CITIBANK', logo: 'banks/CITIBANK.png' },
  { name: 'BANK ISLAM MALAYSIA', logo: 'banks/BANK-ISLAM.png' },
  { name: 'BANK RAKYAT', logo: 'banks/BANK-RAKYAT.ico' },
  { name: 'BSN', logo: 'banks/BSN.png' },
  { name: 'AFFIN BANK', logo: 'banks/AFFIN-BANK.png' },
  { name: 'ALLIANCE BANK', logo: 'banks/ALLIANCE-BANK.png' },
  { name: 'BANK MUAMALAT', logo: 'banks/BANK-MUAMALAT.png' },
  { name: 'MBSB BANK', logo: 'banks/MBSB-BANK.png' },
  { name: 'AGROBANK', logo: 'banks/AGROBANK.png' },
  { name: 'AL RAJHI BANK', logo: 'banks/AL-RAJHI.png' },
  { name: 'KUWAIT FINANCE HOUSE', logo: 'banks/KUWAIT-FINANCE.png' },
  { name: 'BANK OF CHINA (MALAYSIA)', logo: 'banks/BANK-OF-CHINA.png' },
  { name: 'ICBC (MALAYSIA)', logo: 'banks/ICBC.png' },
  { name: 'SMBC (MALAYSIA)', logo: 'banks/SMBC.png' },
  { name: 'MIZUHO BANK (MALAYSIA)', logo: 'banks/MIZUHO.png' },
  { name: 'MUFG BANK (MALAYSIA)', logo: 'banks/MUFG.png' },
  { name: 'DEUTSCHE BANK', logo: 'banks/DEUTSCHE-BANK.png' },
  { name: 'J.P. MORGAN', logo: 'banks/JPMORGAN.png' },
  { name: 'BNP PARIBAS (MALAYSIA)', logo: 'banks/BNP-PARIBAS.png' },
  { name: 'GOLDMAN SACHS', logo: 'banks/GOLDMAN-SACHS.png' },
  { name: 'BANK OF AMERICA', logo: 'banks/BOFA.png' },
  { name: 'MAYBANK ISLAMIC', logo: 'banks/MAYBANK-ISLAMIC.png' },
  { name: 'CIMB ISLAMIC', logo: 'banks/CIMB-ISLAMIC.png' },
  { name: 'PUBLIC ISLAMIC BANK', logo: 'banks/PUBLIC-ISLAMIC.png' },
  { name: 'RHB ISLAMIC', logo: 'banks/RHB-ISLAMIC.png' },
  { name: 'HONG LEONG ISLAMIC', logo: 'banks/HONG-LEONG-ISLAMIC.png' },
  { name: 'AFFIN ISLAMIC', logo: 'banks/AFFIN-ISLAMIC.png' },
  { name: 'AMBANK ISLAMIC', logo: 'banks/AMBANK-ISLAMIC.png' },
  { name: 'ALLIANCE ISLAMIC', logo: 'banks/ALLIANCE-ISLAMIC.png' },
  { name: 'HSBC AMANAH', logo: 'banks/HSBC-AMANAH.png' },
  { name: 'STANDARD CHARTERED SAADIQ', logo: 'banks/SC-SAADIQ.png' },
  { name: 'OCBC AL-AMIN', logo: 'banks/OCBC-ALAMIN.png' },
  { name: 'SME BANK', logo: 'banks/SME-BANK.png' },
  { name: 'EXIM BANK', logo: '' },
  { name: 'BANK PEMBANGUNAN MALAYSIA', logo: 'banks/BANK-PEMBANGUNAN.png' },
  { name: 'AEON BANK (MALAYSIA)', logo: 'banks/AEON-BANK.png' },
  { name: 'GX BANK', logo: 'banks/GX-BANK.png' },
  { name: 'BOOST BANK', logo: 'banks/BOOST-BANK.png' },
  { name: 'RYT BANK', logo: 'banks/RYT-BANK.png' }
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

BANK_LIST.forEach(function (b) {
  b.logo = b.logo || bankLogoDataURI(b.name);
});