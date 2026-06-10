export default function NavButton({ icon, label, sub, bgColor, textDark = true, onClick, disabled }) {
  const textCls = textDark ? 'text-[#1a2830]' : 'text-white'
  const subCls  = textDark ? 'text-[#1a2830]/70' : 'text-white/70'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-tile p-[18px] flex flex-col gap-1 min-h-[104px]
                 active:scale-[.97] transition-transform text-left w-full
                 disabled:opacity-75 disabled:cursor-default relative"
      style={{ background: bgColor }}
    >
      <span className={textCls}>{icon}</span>
      <span className={`text-[15px] font-bold mt-1 ${textCls}`}>{label}</span>
      {sub && <span className={`text-[11px] ${subCls}`}>{sub}</span>}
      {disabled && (
        <span className="absolute top-2 right-2 text-[9px] font-semibold
                         bg-black/10 text-black/40 px-1.5 py-0.5 rounded-full
                         uppercase tracking-wide">
          Čoskoro
        </span>
      )}
    </button>
  )
}
