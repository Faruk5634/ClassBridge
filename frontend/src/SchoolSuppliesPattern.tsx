type Props = { className: string }

export default function SchoolSuppliesPattern({ className }: Props) {
  const patternId = className + '-pattern'
  return <svg className={className} viewBox="0 0 1200 160" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <pattern id={patternId} width="230" height="150" patternUnits="userSpaceOnUse">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
          <g transform="rotate(-8 39 66)">
            <path d="M12 39c9-5 18-5 27 0v53c-9-5-18-5-27 0V39Zm27 0c9-5 18-5 27 0v53c-9-5-18-5-27 0V39Zm0 1v51" />
          </g>
          <g transform="rotate(6 97 48)">
            <rect x="76" y="15" width="42" height="64" rx="4" />
            <path d="M85 28h23m-23 9h23m-23 9h16m-16 9h23m-23 9h18" />
          </g>
          <g transform="rotate(-17 157 96)">
            <path d="m137 102 31-45 9 6-31 45-12 6 3-12Zm31-45 9 6m-43 51 3-12" />
          </g>
          <g transform="rotate(13 203 47)">
            <rect x="192" y="25" width="23" height="43" rx="5" />
            <path d="m197 33 13 3" />
          </g>
        </g>
      </pattern>
    </defs>
    <rect width="1200" height="160" fill={`url(#${patternId})`} />
  </svg>
}
