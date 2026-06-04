interface VideoBackgroundProps {
  opacity?: number;
}

export function VideoBackground({ opacity = 0.38 }: VideoBackgroundProps) {
  return (
    <>
      <video
        autoPlay
        muted
        loop
        playsInline
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          opacity,
          pointerEvents: 'none',
        }}
      >
        <source src="/assets/videos/Hexagonal_mountain_peaks_indigo.mp4" type="video/mp4" />
      </video>

      {/* Edge vignette — blends video borders into the dark background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse 90% 90% at 50% 50%, transparent 40%, rgba(6,11,21,0.75) 100%)
        `,
        pointerEvents: 'none',
      }} />
    </>
  );
}
