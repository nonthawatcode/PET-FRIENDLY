'use client'

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState } from 'react'
import type { ActionResult } from '@/lib/types'

type Action = (state: ActionResult | null, fd: FormData) => Promise<ActionResult>

// Submit stays disabled until the page has finished loading its scripts; before that a tap
// would do a plain browser submit that reloads the page and loses what was typed.
const Pending = createContext({ pending: false, ready: false })

/**
 * Form bound to a server action. Submits through onSubmit instead of the form `action`
 * prop so React does not clear the fields when the action returns an error.
 */
export function ActionForm({
  action, children, className, resetOnSuccess = false,
}: { action: Action; children: React.ReactNode; className?: string; resetOnSuccess?: boolean }) {
  const [state, formAction, pending] = useActionState(action, null)
  const ref = useRef<HTMLFormElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset()
  }, [state, resetOnSuccess])
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault()
        if (pending || !ready) return
        const fd = new FormData(e.currentTarget)
        startTransition(() => formAction(fd))
      }}
    >
      <Pending.Provider value={{ pending, ready }}>{children}</Pending.Provider>
      {state && (state.ok ? state.message && <p className="fok" role="status">{state.message}</p> : <p className="ferr" role="alert">{state.error}</p>)}
    </form>
  )
}

export function Submit({ children, className = 'btn pri', pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending, ready } = useContext(Pending)
  return (
    <button className={className} disabled={pending || !ready} type="submit">
      {pending ? pendingText ?? 'กำลังบันทึก…' : children}
    </button>
  )
}
