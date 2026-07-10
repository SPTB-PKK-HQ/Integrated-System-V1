import Image from 'next/image';
import GoogleSignIn from '@/components/auth/GoogleSignIn';

export default function Hero() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 p-8 md:p-12 text-center">
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-400/20 rounded-full blur-3xl" />

      <Image
        src="/jata.svg"
        alt="Jata Negara"
        width={80}
        height={80}
        className="mx-auto mb-4"
        priority
      />

      <div className="inline-block bg-white/10 text-white/80 text-xs font-semibold px-3 py-1 rounded-full mb-4 border border-white/20">
        V6.6.0
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 leading-tight">
        SISTEM BERSEPADU<br />SPTB (HQ)
      </h1>

      <p className="text-white/70 text-sm mb-8 max-w-md mx-auto">
        Pusat Khidmat Kontraktor<br />
        Kementerian Pembangunan Usahawan dan Koperasi (KUSKOP)
      </p>

      <div className="w-16 h-0.5 bg-white/20 mx-auto mb-8" />

      <p className="text-white/60 text-sm mb-6">Log masuk untuk mengakses sistem</p>

      <GoogleSignIn />
    </div>
  );
}
