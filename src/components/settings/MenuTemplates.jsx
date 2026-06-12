import { useEffect, useRef, useState } from 'react'
import { IconChevronDown, IconChevronRight, IconPlus, IconTrash } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import MenuEditor from '../menu/MenuEditor'
import BlurInput from './BlurInput'

// Šablóny menu — tvoria sa rovnakým editorom ako menu rezervácie a v detaile
// rezervácie sa dajú načítať jedným klikom. Mažú sa natvrdo (cascade) —
// menu rezervácií sú ich kópie, takže vymazanie šablóny ich neovplyvní.
export default function MenuTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  const [expandedId, setExpandedId] = useState(null)
  const [newName, setNewName]       = useState('')

  // Prvý klik = potvrdenie (~4 s), druhý = vymazanie
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const confirmTimer = useRef(null)

  useEffect(() => {
    supabase
      .from('menu_templates')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setTemplates(data ?? [])
        setLoading(false)
      })
  }, [])

  async function addTemplate(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const { data, error } = await supabase
      .from('menu_templates')
      .insert({ name })
      .select()
      .single()
    if (error) { setError(error.message); return }
    setTemplates(ts => [...ts, data].sort((a, b) => a.name.localeCompare(b.name, 'sk')))
    setNewName('')
    setExpandedId(data.id)
  }

  function renameTemplate(tpl, name) {
    if (!name.trim()) return
    supabase
      .from('menu_templates')
      .update({ name: name.trim() })
      .eq('id', tpl.id)
      .then(({ error }) => {
        if (error) { setError(error.message); return }
        setTemplates(ts => ts.map(t => t.id === tpl.id ? { ...t, name: name.trim() } : t))
      })
  }

  async function deleteTemplate(tpl) {
    if (confirmDeleteId !== tpl.id) {
      setConfirmDeleteId(tpl.id)
      clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirmDeleteId(null), 4000)
      return
    }
    clearTimeout(confirmTimer.current)
    setConfirmDeleteId(null)
    const { error } = await supabase.from('menu_templates').delete().eq('id', tpl.id)
    if (error) { setError(error.message); return }
    setTemplates(ts => ts.filter(t => t.id !== tpl.id))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#4cbfb3] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* Nová šablóna */}
      <form onSubmit={addTemplate} className="flex gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Názov novej šablóny (napr. Svadba klasik)"
          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold
                     transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: '#4cbfb3', color: '#0a2d2a' }}
        >
          <IconPlus size={16} stroke={2.5} />
          Pridať
        </button>
      </form>

      {templates.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">
          Zatiaľ žiadne šablóny. Vytvor šablónu a naklikaj do nej položky —
          v detaile rezervácie ju potom načítaš jedným klikom.
        </p>
      )}

      {templates.map(tpl => {
        const expanded = expandedId === tpl.id
        return (
          <div key={tpl.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-3 py-2 flex items-center gap-1.5">
              <button
                onClick={() => setExpandedId(expanded ? null : tpl.id)}
                aria-label={expanded ? 'Zbaliť' : 'Rozbaliť'}
                className="w-7 h-7 shrink-0 rounded flex items-center justify-center
                           text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              >
                {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              </button>

              <BlurInput
                value={tpl.name}
                onSave={name => renameTemplate(tpl, name)}
                className="flex-1 min-w-[120px] font-semibold text-gray-900"
              />

              <button
                onClick={() => deleteTemplate(tpl)}
                title="Vymazať šablónu (menu rezervácií neovplyvní)"
                aria-label="Vymazať šablónu"
                className={`px-2 py-1.5 rounded-md text-xs font-bold border transition-colors
                            inline-flex items-center gap-1 shrink-0
                            ${confirmDeleteId === tpl.id
                              ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                              : 'border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50'}`}
              >
                <IconTrash size={14} />
                {confirmDeleteId === tpl.id && 'Naozaj?'}
              </button>
            </div>

            {expanded && (
              <div className="border-t border-gray-100">
                <MenuEditor
                  table="menu_template_items"
                  ownerColumn="template_id"
                  ownerId={tpl.id}
                  editable
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
