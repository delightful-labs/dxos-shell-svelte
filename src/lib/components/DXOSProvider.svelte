<script>
	import { createMachine, fromPromise } from 'xstate'
	import IdentityDialogue from '$lib/components/IdentityDialogue.svelte'
	import GrantAccessDialogue from '$lib/components/GrantAccessDialogue.svelte'
	import { useMachine } from '$lib/useMachine'
	import { page } from '$app/stores'
	import { Dialog } from 'delightful-ui'
	import { Client } from '@dxos/client'
	import { setContext } from 'svelte'

	export const client = new Client()

	setContext('client', client)

	const invitationCode = $page.url.searchParams.get('invitationCode') || ''

	const dxosMachine = createMachine({
		id: 'dxos',
		initial: 'Unititialized',
		context: {
			// Might change this to be a store that is passed in...
			client: client,
			invitationCode: invitationCode
		},
		states: {
			Unititialized: {
				invoke: {
					src: fromPromise(async ({ input }) => {
						const data = await input.client.initialize()
						return data
					}),
					input: ({ context }) => ({
						client: context.client
					}),
					onDone: [
						{
							guard: ({ context }) => context.client.halo.identity.get(),
							target: 'SignedIn'
						},
						// @TODO: Figure out how to do this now that I've moved the state to the local component...
						// {
						// 	guard: ({ context }) => context.invitationCode,
						// 	target: 'SignedOut.usingAuthedDevice'
						// },
						{
							target: 'SignedOut'
						}
					],
					onError: {
						actions: (error) => console.error(error)
					}
				}
			},
			SignedIn: {
				initial: 'idle',
				states: {
					idle: {
						on: {
							ADD_DEVICE: {
								target: 'creatingInvitation'
							}
						}
						// get spaces with pet name
						// if more than one exists, let user select
					},
					creatingInvitation: {
						on: {
							COMPLETE: {
								target: 'idle'
							}
						}
					}
				}
			},
			SignedOut: {
				initial: 'idle',
				on: {
					SIGNED_IN: {
						target: 'SignedIn'
					}
				},
				onDone: {
					target: 'SignedIn'
				},
				states: {
					idle: {
						on: {
							CREATE_IDENTITY: {
								target: 'creatingIdentity'
							}
						}
					},
					creatingIdentity: {
						initial: 'idle',
						onDone: {
							target: 'done'
						},
						states: {
							idle: {
								on: {
									SAVE_DISPLAYNAME: {
										target: 'savingDisplayname',
										actions: ({ event }) => console.log(event)
									}
								}
							},
							savingDisplayname: {
								invoke: {
									src: fromPromise(async ({ input }) => {
										const identity = await input.client.halo.createIdentity({
											displayName: input.displayName
										})
										return identity
									}),
									input: ({ context, event }) => ({
										client: context.client,
										displayName: event.value
									}),
									onDone: {
										actions: ({ event }) => console.log(event),
										target: 'done'
									},
									onError: {
										actions: ({ event }) => console.error(event)
									}
								}
							},
							done: {
								type: 'final'
							}
						}
					},
					done: {
						type: 'final'
					}
				}
			}
		}
	})

	const { send, state } = useMachine(dxosMachine)
</script>

{#if !$state.matches('Unititialized')}
	<slot />
{/if}

{#if $state}
	{#if $state.matches('SignedOut')}
		<IdentityDialogue
			state={$state}
			on:create_identity={() => send({ type: 'CREATE_IDENTITY' })}
			on:save_displayname={(e) => send({ type: 'SAVE_DISPLAYNAME', value: e.detail.value })}
			on:signed_in={() => send({ type: 'SIGNED_IN' })}
			{invitationCode}
		/>
	{:else if $state.matches('SignedIn')}
		<Dialog button_title={{ EN: 'Add device' }} on:open={() => send({ type: 'ADD_DEVICE' })}>
			<GrantAccessDialogue on:complete={() => send({ type: 'COMPLETE' })} />
		</Dialog>
	{/if}
{/if}
