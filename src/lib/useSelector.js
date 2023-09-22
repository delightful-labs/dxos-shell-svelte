import { readable } from "svelte/store"

function defaultCompare(a, b) {
  return a === b
}

export const useSelector = (actor, selector, compare = defaultCompare) => {
  let sub

  let prevSelected = selector(actor.getSnapshot())

  const selected = readable(prevSelected, set => {
    const onNext = state => {
      const nextSelected = selector(state)
      if (!compare(prevSelected, nextSelected)) {
        prevSelected = nextSelected
        set(nextSelected)
      }
    }

    // Make sure the store gets updated when it's subscribed to.
    onNext(actor.getSnapshot())

    sub = actor.subscribe(onNext)

    return () => {
      sub.unsubscribe()
    }
  })

  return selected
}
