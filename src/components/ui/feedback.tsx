'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   Notifications (toast) et confirmations, appelables de n'importe où :
     toast.success('Enregistré')
     if (await confirmer({ titre: 'Supprimer ?', danger: true })) …
   Le rendu est assuré par <Toaster /> placé une fois dans le layout racine.
   ═══════════════════════════════════════════════════════════════ */

type ToastKind = 'success' | 'error' | 'info'
type ToastItem = { id: number; kind: ToastKind; message: string }

export type ConfirmOptions = {
  titre: string
  message?: React.ReactNode
  /** Libellé du bouton de validation : nommer l'action (« Supprimer », « Clôturer »). */
  confirmer?: string
  annuler?: string
  danger?: boolean
  /** Si fourni, l'utilisateur doit taper ce mot pour valider (actions massives irréversibles). */
  saisieRequise?: string
}
type ConfirmRequest = ConfirmOptions & { resolve: (ok: boolean) => void }

let toasts: ToastItem[] = []
let confirmRequest: ConfirmRequest | null = null
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

function push(kind: ToastKind, message: string) {
  const id = nextId++
  toasts = [...toasts.slice(-3), { id, kind, message }]
  emit()
  setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000)
}
function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
  info: (message: string) => push('info', message),
}

export function confirmer(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    confirmRequest?.resolve(false)
    confirmRequest = { ...options, resolve }
    emit()
  })
}

function closeConfirm(ok: boolean) {
  confirmRequest?.resolve(ok)
  confirmRequest = null
  emit()
}

const ICONS = {
  success: <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-600" aria-hidden />,
  error: <XCircle className="h-4.5 w-4.5 shrink-0 text-red-600" aria-hidden />,
  info: <Info className="h-4.5 w-4.5 shrink-0 text-navy-600" aria-hidden />,
}

export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => toasts)
  const request = useSyncExternalStore(subscribe, () => confirmRequest, () => null)

  return (
    <>
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm animate-rise-in items-start gap-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-800 shadow-overlay ring-1 ring-slate-900/5"
          >
            {ICONS[t.kind]}
            <p className="flex-1 leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-m-1 rounded p-1 text-slate-400 hover:text-slate-700"
              aria-label="Fermer la notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      {request && <ConfirmDialog request={request} />}
    </>
  )
}

function ConfirmDialog({ request }: { request: ConfirmRequest }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [saisie, setSaisie] = useState('')
  const bloque = Boolean(request.saisieRequise && saisie.trim().toUpperCase() !== request.saisieRequise.toUpperCase())

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        closeConfirm(false)
      }}
      onClick={(e) => {
        if (e.target === ref.current) closeConfirm(false)
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md animate-rise-in rounded-2xl bg-white p-0 text-slate-900 shadow-overlay backdrop:bg-navy-950/45"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          if (!bloque) closeConfirm(true)
        }}
        className="p-6"
      >
        <div className="flex gap-4">
          {request.danger && (
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-base font-semibold text-slate-900">
              {request.titre}
            </h2>
            {request.message && <div className="mt-2 text-sm leading-relaxed text-slate-600">{request.message}</div>}
            {request.saisieRequise && (
              <label className="mt-4 block text-sm text-slate-700">
                Tapez <strong className="font-semibold">{request.saisieRequise}</strong> pour confirmer
                <input
                  autoFocus
                  value={saisie}
                  onChange={(e) => setSaisie(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/15"
                />
              </label>
            )}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => closeConfirm(false)}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            {request.annuler ?? 'Annuler'}
          </button>
          <button
            type="submit"
            autoFocus={!request.saisieRequise}
            disabled={bloque}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 ${
              request.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-navy-900 hover:bg-navy-800'
            }`}
          >
            {request.confirmer ?? 'Confirmer'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
