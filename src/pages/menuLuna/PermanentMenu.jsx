import MenuLunaHeader from '../../components/menuLuna/MenuLunaHeader'
import PermanentEditor from '../../components/menuLuna/PermanentEditor'
import { useMenuSettings } from '../../hooks/useMenuSettings'

export default function PermanentMenu() {
  const { portionOptions, defaultPricePermanent } = useMenuSettings()

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <MenuLunaHeader title="Trvalé menu" backTo="/menu" />

      <div className="w-full max-w-2xl xl:max-w-5xl mx-auto flex-1 w-full px-4 py-5">
        <div className="mb-3">
          <p className="text-[13px] text-[#8aaabb]">Minútky / stála ponuka</p>
          <p className="text-[18px] font-bold text-[#2b3f4c]">6 položiek</p>
        </div>

        <PermanentEditor portionOptions={portionOptions} defaultPrice={defaultPricePermanent} />
      </div>
    </div>
  )
}
