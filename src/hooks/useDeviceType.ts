import { useEffect, useState } from "react";

export type DeviceType = "mobile" | "desktop";

const MOBILE_BREAKPOINT = 768;

/**
 * Detecta o tipo de dispositivo combinando User-Agent + largura de viewport.
 *
 * Estratégia:
 * - Se o UA indica iOS/Android/Windows Phone → mobile (mesmo em landscape).
 * - Senão, se viewport < 768px → mobile.
 * - Caso contrário → desktop.
 *
 * Importante para o fluxo Open Finance via Pluggy:
 * - Desktop → mostramos QR Code para o cliente escanear no celular.
 * - Mobile  → redirecionamos diretamente para o app/site do banco selecionado.
 */
function detect(): DeviceType {
  if (typeof window === "undefined") return "desktop";

  const ua = window.navigator.userAgent || "";
  const isMobileUA =
    /android|iphone|ipod|ipad|windows phone|iemobile|blackberry|bb10|mobile/i.test(ua);

  // iPadOS recente identifica-se como Mac — checamos touch.
  const isIpadOS =
    /Macintosh/.test(ua) &&
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints !== undefined &&
    ((navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0) > 1;

  if (isMobileUA || isIpadOS) return "mobile";

  if (window.innerWidth < MOBILE_BREAKPOINT) return "mobile";
  return "desktop";
}

export function useDeviceType(): DeviceType {
  const [device, setDevice] = useState<DeviceType>(() => detect());

  useEffect(() => {
    const onResize = () => setDevice(detect());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return device;
}