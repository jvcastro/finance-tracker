"use client"

import * as React from "react"

const QUERY = "(min-width: 640px)"

function subscribe(onStoreChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener("change", onStoreChange)
  return () => mq.removeEventListener("change", onStoreChange)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

function getServerSnapshot() {
  return false
}

/** `true` at `sm` breakpoint and above (desktop). */
export function useIsMinSm() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
