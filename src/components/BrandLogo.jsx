import React, { useId } from 'react'

/** CrowdWork360 brand mark — custom SVG (no stock/old logo) */
const BrandLogo = ({ className = 'w-8 h-8', title = 'CrowdWork360' }) => {
  const uid = useId().replace(/:/g, '')
  const gradId = `cw360-${uid}`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradId} x1="16" y1="12" x2="112" y2="116" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F766E" />
          <stop offset="1" stopColor="#134E4A" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="112" height="112" rx="28" fill={`url(#${gradId})`} />
      <circle cx="64" cy="64" r="38" fill="none" stroke="#99F6E4" strokeWidth="4" strokeOpacity="0.35" />
      <path d="M92 48a34 34 0 1 1-8-22" fill="none" stroke="#5EEAD4" strokeWidth="5" strokeLinecap="round" />
      <path d="M84 26l12 2-6 10z" fill="#5EEAD4" />
      <circle cx="46" cy="54" r="8" fill="#F0FDFA" />
      <circle cx="64" cy="50" r="9" fill="#FFFFFF" />
      <circle cx="82" cy="54" r="8" fill="#F0FDFA" />
      <path d="M30 90c2-14 10-20 16-20s14 6 16 20" fill="#CCFBF1" />
      <path d="M46 88c2-16 11-24 18-24s16 8 18 24" fill="#FFFFFF" />
      <path d="M66 90c2-14 10-20 16-20s14 6 16 20" fill="#CCFBF1" />
    </svg>
  )
}

export default BrandLogo
