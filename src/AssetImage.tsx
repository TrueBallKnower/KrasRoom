import { useEffect, useState } from "react";
import { assetGet } from "./db";
export default function AssetImage({ id, alt }: { id: string; alt: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let url = "",
      active = true;
    assetGet(id).then((b) => {
      if (b && active) {
        url = URL.createObjectURL(b);
        setUrl(url);
      }
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return url ? (
    <img
      src={url}
      alt={alt}
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  ) : null;
}
