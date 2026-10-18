import { useState } from 'react'
import MenuLunaHeader from '../../components/menuLuna/MenuLunaHeader'
import PermanentEditor from '../../components/menuLuna/PermanentEditor'
import { useMenuSettings } from '../../hooks/useMenuSettings'

function polozky(n) {
  if (n === 1) return '1 položka'
  if (n >= 2 && n <= 4) return `${n} položky`
  return `${n} položiek`
}

export default function PermanentMenu() {
  const { portionOptions, defaultPricePermanent } = useMenuSettings()
  const [count, setCount] = useState(null)

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <MenuLunaHeader title="Trvalé menu" backTo="/menu" />

      <div className="w-full max-w-2xl xl:max-w-5xl mx-auto flex-1 w-full px-4 py-5">
        <div className="mb-3">
          <p className="text-[13px] text-[#8aaabb]">Minútky / stála ponuka</p>
          <p className="text-[18px] font-bold text-[#2b3f4c] min-h-7">{count != null && polozky(count)}</p>
        </div>

        <PermanentEditor portionOptions={portionOptions} defaultPrice={defaultPricePermanent} onCount={setCount} />
      </div>
    </div>
  )
}
