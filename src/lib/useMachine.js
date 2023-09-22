import { onDestroy } from "svelte"
import { readable } from "svelte/store"
import { createActor } from "xstate"

export function useMachine(machine, ...[options = {}]) {
  const { guards, actions, actors, delays, ...interpreterOptions } = options

  const machineConfig = {
    guards,
    actions,
    actors,
    delays
  }

  const resolvedMachine = machine.provide(machineConfig)

  const service = createActor(resolvedMachine, interpreterOptions).start()

  onDestroy(() => service.stop())

  let snapshot = service.getSnapshot()

  const state = readable(snapshot, set => {
    return service.subscribe(nextSnapshot => {
      if (snapshot !== nextSnapshot) {
        snapshot = nextSnapshot
        set(snapshot)
      }
    }).unsubscribe
  })

  return {
    state,
    send: service.send,
    service
  }
}
