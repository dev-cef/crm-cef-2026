"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

type Props = {
  memberId: string;
  appleEnabled: boolean;
  googleEnabled: boolean;
};

export function WalletButtons({ memberId, appleEnabled, googleEnabled }: Props) {
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  if (!appleEnabled && !googleEnabled) return null;

  const appleUrl = `/api/carteirinha/${memberId}/apple`;
  const googleUrl = `/api/carteirinha/${memberId}/google`;

  // Apple Wallet only on iOS (when configured); Google Wallet on all platforms
  const showApple = appleEnabled && platform === "ios";
  const showGoogle = googleEnabled;

  if (!showApple && !showGoogle) return null;

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {showApple && (
        <a href={appleUrl} download>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/wallet/add-to-apple-wallet.svg"
            alt="Adicionar ao Apple Wallet"
            className="h-12 w-auto"
            onError={(e) => {
              // fallback if SVG not present
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = "none";
              el.nextElementSibling?.removeAttribute("hidden");
            }}
          />
          <Button variant="outline" size="sm" hidden>
            <Smartphone className="size-4" /> Apple Wallet
          </Button>
        </a>
      )}
      {showGoogle && (
        <a href={googleUrl} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/wallet/add-to-google-wallet.svg"
            alt="Adicionar ao Google Wallet"
            className="h-12 w-auto"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = "none";
              el.nextElementSibling?.removeAttribute("hidden");
            }}
          />
          <Button variant="outline" size="sm" hidden>
            <Smartphone className="size-4" /> Google Wallet
          </Button>
        </a>
      )}
    </div>
  );
}
