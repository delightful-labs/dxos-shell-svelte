<script>
	import { getContext, createEventDispatcher } from 'svelte'
	import { InvitationEncoder, Invitation } from '@dxos/client/invitations'
	import { assign, createMachine, fromPromise, fromCallback } from 'xstate'
	import { useMachine } from '$lib/useMachine'
	import { InputText, Button } from 'delightful-ui'

	const client = getContext('client')

	const dispatch = createEventDispatcher()

	export let invitationCode = ''
	let accessCode = ''

	/**
	 *
	 * @param {string} string
	 * @returns {Promise<boolean>}
	 */
	const checkIfUrl = (string) =>
		new Promise((resolve, reject) => {
			if (string.length == 0) reject(new Error('String is empty'))

			try {
				new URL(string)
				resolve(true)
			} catch (err) {
				resolve(false)
			}
		})

	/**
	 *
	 * @param {string} string
	 * @param {string} paramName
	 * @returns {Promise<string>}
	 */
	const extractParamFromStringUrl = (string, paramName) =>
		new Promise((resolve, reject) => {
			try {
				new URL(string)
				const url = new URL(string)
				const searchParams = url.searchParams
				const param = searchParams.get(paramName)

				if (param) {
					resolve(param)
				} else {
					reject(new Error("Param doesn't exist."))
				}
			} catch (err) {
				reject(new Error('String is not a valid URL.'))
			}
		})

	const requestAccessMachine = createMachine({
		id: 'requestAccess',
		initial: 'idle',
		types: {
			events: {
				value: '',
				type: ''
			}
		},
		context: {
			// @TODO: add types
			// @TODO: change to pass in when starting the machine
			client: client,
			invitationId: '',
			invitationObervable: undefined,
			accessAttempts: 0
		},
		states: {
			idle: {
				on: {
					ACCEPT_INVITATION: {
						target: 'parsingInvitation',
						actions: assign({ invitationId: ({ event }) => event.value })
					}
				}
			},
			parsingInvitation: {
				invoke: {
					src: fromPromise(async ({ input }) => await checkIfUrl(input.invitationId)),
					input: ({ event }) => ({
						invitationId: event.value
					}),
					onDone: [
						{
							guard: ({ event }) => event.output,
							target: 'extractingInvitationParam'
						},
						{
							target: 'acceptingInvitation'
						}
					],
					onError: {
						actions: ({ event }) => console.error(event)
					}
				}
			},
			extractingInvitationParam: {
				invoke: {
					src: fromPromise(
						async ({ input }) =>
							await extractParamFromStringUrl(input.invitationId, 'invitationCode')
					),
					input: ({ context }) => ({
						invitationId: context.invitationId
					}),
					onDone: {
						target: 'acceptingInvitation',
						actions: assign({ invitationId: ({ event }) => event.output })
					},
					onError: {
						actions: ({ event }) => console.error(event)
					}
				}
			},
			acceptingInvitation: {
				invoke: {
					src: fromPromise(async ({ input }) => {
						const invitation = InvitationEncoder.decode(input.invitationId)
						const access = await input.client.halo.join(invitation)
						return access
					}),
					input: ({ context }) => ({
						client: context.client,
						invitationId: context.invitationId
					}),
					onDone: {
						actions: assign({ invitationObervable: ({ event }) => event.output }),
						target: 'enteringOTP'
					},
					onError: {
						actions: ({ event }) => console.error(event)
					}
				}
			},
			enteringOTP: {
				// @TODO: turn this into a reusable actor that can also be used for grantAccess
				initial: 'waiting',
				invoke: {
					src: fromCallback(({ input, sendBack }) => {
						input.observable.subscribe((x) => {
							sendBack({ type: 'INVITATION', data: x })
						})
					}),
					input: ({ context }) => ({
						cleint: context.client,
						observable: context.invitationObervable
					})
				},
				on: {
					INVITATION: [
						// INIT = 0,
						// CONNECTING = 1,
						// CONNECTED = 2,
						// READY_FOR_AUTHENTICATION = 3,
						// AUTHENTICATING = 4,
						// SUCCESS = 5,
						// CANCELLED = 6,
						// TIMEOUT = 7,
						// ERROR = 8
						{
							guard: ({ event }) => event.data.state === Invitation.State.READY_FOR_AUTHENTICATION,
							target: 'enteringOTP.ready'
						},
						{
							guard: ({ event }) => event.data.state === Invitation.State.SUCCESS,
							actions: () => dispatch('signed_in'),
							target: 'success'
						},
						{
							guard: ({ event }) => event.data.state === Invitation.State.TIMEOUT,
							target: 'timedOut'
						}
					]
				},
				states: {
					waiting: {
						//TODO: there seems to be no indication when an invitation has expired
						//so add a manual timeout here
					},
					ready: {
						on: {
							SUBMIT_CODE: {
								target: 'checkingCode',
								actions: assign({ accessAttempts: ({ context }) => context.accessAttempts + 1 })
							}
						}
					},
					checkingCode: {
						invoke: {
							src: fromPromise(
								async ({ input }) =>
									await input.invitation.authenticate(input.code).catch((e) => console.log(e))
							),
							input: ({ context, event }) => ({
								invitation: context.invitationObervable,
								code: event.value
							})
						}
					}
				}
			},
			timedOut: {},
			success: {
				type: 'final'
			}
		}
	})

	const { send, state } = useMachine(requestAccessMachine)
</script>

{#if $state.matches('idle')}
	<form on:submit|preventDefault={() => send({ type: 'ACCEPT_INVITATION', value: invitationCode })}>
		<!-- 
			@TODO: Convert to acual URL field? 
			Or not, because they might just paste the code?
			If I did convert to URL, then I can get rid of my URL check in my machine.
			The chances of entering a non-url are slim, since I don't provide that as an option... 
		-->
		<InputText bind:value={invitationCode} required title="Enter Invitation URL" />
		<Button type="submit" text={{ EN: 'Submit' }} />
	</form>
{:else if $state.matches({ enteringOTP: 'ready' })}
	<form on:submit|preventDefault={() => send({ type: 'SUBMIT_CODE', value: accessCode })}>
		<InputText
			bind:value={accessCode}
			required
			maxlength={6}
			minlength={6}
			size={6}
			limitToNumbers
			title="Enter Access Code"
		/>
		<!-- @TODO: Clear field if error -->
		<Button type="submit" text={{ EN: 'Submit' }} />
	</form>
	{#if $state.context.accessAttempts > 0}
		<p>Incorrect code, please try again.</p>
	{/if}
	<small>Tried {$state.context.accessAttempts} times</small>
{:else if $state.matches('timedOut')}
	<p>Invitation has expired.</p>
{/if}

<style>
	form {
		display: flex;
		align-items: end;
		gap: 0.5rem;
	}
</style>
