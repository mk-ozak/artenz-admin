const HALL_STRIP = {
  ARTENZ_PLUS: '#4cbfb3',
  ARTENZ:      '#d4a036',
  LUNA:        '#b55db8',
  CATERING:    '#7aaaca',
}

const STATUS_BG = {
  dopyt:     '#f0f2f4',
  zaloha:    '#fff5e6',
  potvrdene: '#eaf7f0',
}

const SIZE_CLS = {
  sm: 'text-[10px] px-1 py-0.5 rounded-[5px] pl-[7px] mx-px my-px',
  md: 'text-xs px-2 py-1.5 rounded-[6px] pl-2.5 mx-0.5 my-0.5',
  lg: 'text-[13px] px-2.5 py-2 rounded-[7px] pl-3',
}

export default function DiaryEventBlock({ title, subtitle, hall, status = 'dopyt', size = 'md', onClick }) {
  // Na mobile (úzke stĺpce) zobrazíme len prvé slovo názvu + „…"; od sm nahor celý názov.
  const firstWord = (title ?? '').trim().split(/\s+/)[0] ?? ''

  return (
    <div
      className={`border-l-[3px] font-semibold text-[#1a2830] overflow-hidden
                  whitespace-nowrap text-ellipsis leading-snug ${SIZE_CLS[size]}
                  ${onClick ? 'cursor-pointer hover:brightness-95 active:brightness-90' : ''}`}
      style={{
        borderLeftColor: HALL_STRIP[hall] ?? '#9ab0ba',
        background:      STATUS_BG[status] ?? '#f0f2f4',
      }}
      onClick={onClick}
    >
      <span className="block overflow-hidden text-ellipsis">
        <span className="sm:hidden">{firstWord}…</span>
        <span className="hidden sm:inline">{title}</span>
      </span>
      {subtitle && (
        <span className="block text-[10px] font-normal text-[#7a8a98] mt-0.5">{subtitle}</span>
      )}
    </div>
  )
}
