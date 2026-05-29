/* eslint-disable @next/next/no-img-element */

type RemoteImageProps = {
  src: string;
  alt: string;
  priority?: boolean;
};

export function RemoteImage({ src, alt, priority = false }: RemoteImageProps) {
  if (!src) {
    return <span className="remote-image-placeholder" aria-label={alt} />;
  }

  return <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" referrerPolicy="no-referrer" />;
}
