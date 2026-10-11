import ChangePassword from '../../components/settings/ChangePassword'
import VersionInfo from '../../components/settings/VersionInfo'
import VoHeader from '../../components/vo/VoHeader'

// Nastavenia VO — len zmena hesla a aktuálna verzia aplikácie
// (nič z nastavení administrácie)
export default function VoSettings() {
  return (
    <div className="min-h-screen bg-gray-50">
      <VoHeader title="Nastavenia" backTo="/vo" />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <ChangePassword />
        <VersionInfo />
      </main>
    </div>
  )
}
