import React from 'react'

const Logo: React.FC = () => {
  return (
    <div className="flex items-center justify-center w-8 h-8 bg-primary-500 rounded-lg">
      <svg
        className="w-5 h-5 text-white"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    </div>
  )
}

export default Logo
