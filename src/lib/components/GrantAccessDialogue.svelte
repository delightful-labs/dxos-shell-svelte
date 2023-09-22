<script>
	import { getContext, createEventDispatcher } from 'svelte'
	import { assign, createMachine, fromPromise } from 'xstate'
	import { useMachine } from '$lib/useMachine'
	import invitationObservableMachine from '$lib/machines/invitationObservableMachine'
	import { InvitationEncoder } from '@dxos/client/invitations'
	import { page } from '$app/stores'
	import QRCode from 'qrcode-svg'
	import CopyButton from './CopyButton.svelte'

	const dispatch = createEventDispatcher()

	const client = getContext('client')

	const grantAccessMachine = createMachine({
		id: 'requestAccess',
		initial: 'creatingInvitation',
		context: {
			// @TODO: add types
			// @TODO: change to pass in when starting the machine
			client: client,
			invitationObervable: undefined,
			deviceInvitationCode: '',
			authCode: '',
			/** @type {string|undefined}*/
			qrcode: undefined
		},
		//const client = new Client().halo.createInvitation()
		//show qr code + url
		//after invitation received, show code
		on: {
			'*': {
				actions: ({ event }) => console.log(event)
			}
		},
		states: {
			creatingInvitation: {
				invoke: {
					src: fromPromise(async ({ input }) => {
						const invitation = await input.client.halo.share()
						return invitation
					}),
					input: ({ context }) => ({
						client: context.client
					}),
					onDone: {
						actions: assign({
							deviceInvitationCode: ({ event }) => InvitationEncoder.encode(event.output.get()),
							invitationObervable: ({ event }) => event.output
						}),
						target: 'listeningForResponse'
					},
					onError: {
						actions: (error) => console.error(error)
					}
				}
			},
			listeningForResponse: {
				entry: assign({
					qrcode: ({ context }) =>
						new QRCode({
							content: `${$page.url.origin}?invitationCode=${context.deviceInvitationCode}`,
							//color: color,
							//background: bg,
							padding: 0,
							container: 'svg-viewbox',
							join: true
						}).svg()
				}),
				invoke: {
					src: invitationObservableMachine,
					id: 'observable',
					input: ({ context }) => ({
						invitationObervable: context.invitationObervable
					})
				},
				initial: 'loading',
				on: {
					'*': {
						actions: ({ event }) => console.log(event)
					},
					CONNECTING: {
						actions: [({ event }) => console.log(event)],
						target: '.showingInvitation'
					},
					READY_FOR_AUTHENTICATION: {
						actions: [
							assign({ authCode: ({ event }) => event.authCode }),
							({ event }) => console.log(event)
						],
						target: '.showingAuthCode'
					},
					COMPLETE: {
						target: '.complete'
					}
				},
				states: {
					loading: {},
					showingInvitation: {},
					showingAuthCode: {},
					complete: {
						type: 'final',
						entry: () => dispatch('complete')
					}
				}
			}
		}
	})

	const { state } = useMachine(grantAccessMachine, { id: 'parent' })
</script>

{#if $state.matches({ listeningForResponse: 'showingInvitation' })}
	<p>Copy code and paste on other device</p>
	<div class="qr-code">
		{@html $state.context.qrcode}
	</div>
	<CopyButton
		content={`${$page.url.origin}?invitationCode=${$state.context.deviceInvitationCode}`}
	/>
{:else if $state.matches({ listeningForResponse: 'showingAuthCode' })}
	<p>Enter code on other device</p>
	<p>{$state.context.authCode}</p>
{:else if $state.matches({ listeningForResponse: 'complete' })}
	<p>Success!</p>
{/if}

<style>
	.qr-code {
		max-width: 200px;
	}
</style>
