/** Presentation only: retain the calculated duration, rounded to the nearest second. */
export function formatarDuracaoMinutos(minutos: number): string {
  const segundos = Math.max(0, Math.round(minutos * 60));
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return seg === 0 ? `${min} min` : min === 0 ? `${seg} s` : `${min} min ${seg} s`;
}
