/* eslint-disable @next/next/no-img-element */

type RemoteImageProps = {
  src: string;
  alt: string;
};

export function RemoteImage({ src, alt }: RemoteImageProps) {
  return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" />;
}
