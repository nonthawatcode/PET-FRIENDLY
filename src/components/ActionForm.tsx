'use client'

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from 'react'
import type { ActionResult } from '@/lib/types'

type Action = (state: ActionResult | null, fd: FormData) => Promise<ActionResult>

const Pending = createContext(false)

/**
 * Form bound to a server action. Submits through onSubmit instead of the form `action`
 * prop so React does not clear the fields when the action returns an error.
 */
export function ActionForm({
  action, children, className, resetOnSuccess = false,
}: { action: Action; children: React.ReactNode; className?: string; resetOnSuccess?: boolean }) {
  const [state, formAction, pending] = useActionState(action, null)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset()
  }, [state, resetOnSuccess])
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault()
        if (pending) return
        const fd = new FormData(e.currentTarget)
        startTransition(() => formAction(fd))
      }}
    >
      <Pending.Provider value={pending}>{children}</Pending.Provider>
      {state && (state.ok ? state.message && <p className="fok" role="status">{state.message}</p> : <p className="ferr" role="alert">{state.error}</p>)}
    </form>
  )
}

export function Submit({ children, className = 'btn pri', pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const pending = useContext(Pending)
  return (
    <button className={className} disabled={pending} type="submit">
      {pending ? pendingText ?? 'กำลังบันทึก…' : children}
    </button>
  )
}
