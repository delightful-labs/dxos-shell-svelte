import { createMachine, fromCallback, sendParent } from 'xstate'
import { Invitation } from '@dxos/client/invitations'

const invitationObservableMachine = createMachine({
  context: ({ input }) => ({
    /** @type {import('@dxos/client/invitations').Invitation} */
    invitationObervable: input.invitationObervable
  }),
  id: 'invitationObservable',
  invoke: {
    src: fromCallback(({ input, sendBack }) => {
      input.observable.subscribe(
        (x) => sendBack({ ...x, type: Invitation.State[x.state] }),
        (e) => console.log(e),
        () => sendBack({ type: 'COMPLETE' })
      )
    }),
    input: ({ context }) => ({
      observable: context.invitationObervable
    })
  },
  on: {
    '*': {
      actions: sendParent(({event}) => event),
    }
  }
})

export default invitationObservableMachine