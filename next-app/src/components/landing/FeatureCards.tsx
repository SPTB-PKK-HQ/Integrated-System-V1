const features = [
  {
    icon: '📋',
    title: 'Borang Semakan',
    desc: 'Auto-ekstrak PDF dengan AI, semak dokumen dan personel',
  },
  {
    icon: '📊',
    title: 'Dashboard Analisis',
    desc: 'Statistik permohonan, trend bulanan dan jenis permohonan',
  },
  {
    icon: '💬',
    title: 'WhatsApp & Inbox',
    desc: 'Jadual WhatsApp auto, notifikasi dan inbox pintar',
  },
  {
    icon: '📁',
    title: 'Google Drive',
    desc: 'Folder automatik, simpanan PDF berwarna dan QR profile',
  },
];

export default function FeatureCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      {features.map((f) => (
        <div
          key={f.title}
          className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 text-center hover:bg-white/20 transition-all duration-300"
        >
          <div className="text-3xl mb-3">{f.icon}</div>
          <h3 className="text-white font-bold text-sm mb-2">{f.title}</h3>
          <p className="text-white/60 text-xs leading-relaxed">{f.desc}</p>
        </div>
      ))}
    </div>
  );
}
