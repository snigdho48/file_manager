import React from 'react'

/** Reachableads brand logo */
const BrandLogo = ({ className = 'w-8 h-8', title = 'Reachableads' }) => (
  <img
    src="/logo.png"
    alt={title}
    className={`${className} rounded-md object-cover`}
    draggable={false}
  />
)

export default BrandLogo
