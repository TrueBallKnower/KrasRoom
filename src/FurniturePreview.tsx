/** Lightweight illustrations: no remote models or extra WebGL contexts. */
export default function FurniturePreview({ kind }: { kind: string }) {
  const wood = "#ba9470",
    fabric = "#92aab4",
    dark = "#536578";
  const shapes = (() => {
    switch (kind) {
      case "sofa":
        return (
          <>
            <path d="M24 57V38Q24 29 33 29H88Q97 29 97 38V57" fill={fabric} />
            <rect x="27" y="47" width="67" height="21" rx="5" fill="#b4c6ce" />
            <rect x="19" y="41" width="13" height="28" rx="5" fill={fabric} />
            <rect x="90" y="41" width="13" height="28" rx="5" fill={fabric} />
            <path d="M60 32V64M28 69V75M94 69V75" />
          </>
        );
      case "bed":
        return (
          <>
            <rect x="32" y="20" width="58" height="20" rx="3" fill={wood} />
            <path d="M32 37H90L101 72H21Z" fill="#d4dde3" />
            <path d="M26 58H96L101 72H21Z" fill={fabric} />
            <rect x="38" y="33" width="20" height="12" rx="4" fill="white" />
            <rect x="64" y="33" width="20" height="12" rx="4" fill="white" />
            <path d="M24 73V78M98 73V78" />
          </>
        );
      case "table":
        return (
          <>
            <path d="M25 49V75M90 49V75M66 37V61" />
            <path d="M18 42L66 27L104 42L57 58Z" fill={wood} />
            <path d="M18 42V48L57 64L104 48V42L57 58Z" fill="#9a7757" />
          </>
        );
      case "chair":
        return (
          <>
            <rect x="40" y="22" width="39" height="33" rx="9" fill={fabric} />
            <path d="M34 54L67 44L88 57L56 68Z" fill="#b4c6ce" />
            <path d="M39 61L34 79M79 63L85 79M49 52V33M73 52V33" />
          </>
        );
      case "plant":
        return (
          <>
            <path d="M47 57H78L72 78H53Z" fill={wood} />
            <path d="M62 58V26" />
            <ellipse
              cx="49"
              cy="42"
              rx="10"
              ry="17"
              transform="rotate(-40 49 42)"
              fill="#769b74"
            />
            <ellipse
              cx="74"
              cy="33"
              rx="11"
              ry="19"
              transform="rotate(35 74 33)"
              fill="#557f59"
            />
            <ellipse cx="57" cy="24" rx="9" ry="14" fill="#91ae7e" />
          </>
        );
      case "lamp":
        return (
          <>
            <path d="M61 43V76" />
            <ellipse cx="61" cy="77" rx="18" ry="4" fill={dark} />
            <path d="M45 20H77L87 45H35Z" fill="#e2cda6" />
          </>
        );
      case "rug":
        return (
          <>
            <path d="M15 53L72 27L110 51L52 79Z" fill="#c4aa95" />
            <path
              d="M27 53L71 34L98 51L53 71Z"
              fill="none"
              stroke="#f2e7d8"
              strokeWidth="3"
            />
          </>
        );
      case "tv":
        return (
          <>
            <rect x="23" y="24" width="77" height="44" rx="3" fill={dark} />
            <rect x="28" y="29" width="67" height="34" fill="#9db8c4" />
            <path d="M61 68V75M46 77H78" />
          </>
        );
      case "sink":
        return (
          <>
            <path d="M36 47H87V76H36Z" fill={wood} />
            <ellipse cx="61" cy="44" rx="31" ry="10" fill="#e7eef2" />
            <ellipse cx="61" cy="43" rx="20" ry="5" fill="#b2c6d1" />
            <path d="M63 37V25Q63 18 71 23" />
          </>
        );
      case "shower":
        return (
          <>
            <path d="M33 76V19H85V76Z" fill="#d6e6ed" fillOpacity=".6" />
            <path d="M59 19V76M72 28V40H65" />
            <path d="M29 76H91V81H29Z" fill="#e6ecf0" />
          </>
        );
      default:
        return (
          <>
            <rect x="35" y="17" width="54" height="60" rx="2" fill={wood} />
            <path d="M62 18V75" />
            {kind === "shelf" ? (
              <path d="M36 35H88M36 55H88" />
            ) : (
              <path d="M56 43V51M68 43V51" />
            )}
            <path d="M39 77V81M84 77V81" />
          </>
        );
    }
  })();
  return (
    <svg
      className="furniture-illustration"
      viewBox="0 0 122 96"
      aria-hidden="true"
    >
      <ellipse cx="61" cy="81" rx="42" ry="5" fill="#263445" opacity=".07" />
      <g
        stroke="#667684"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {shapes}
      </g>
    </svg>
  );
}
