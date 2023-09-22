<script>
	import { createMachine, fromPromise } from 'xstate'
	import { useMachine } from '$lib/useMachine'
	import { Button } from 'delightful-ui'

	export let content = ''
	export let textIdle = {
		EN: 'Copy to Clipboard'
	}

	export let textSuccess = {
		EN: 'Copied!'
	}

	const clipboardIsSupported = () => 'clipboard' in navigator

	const copyMachine = createMachine({
		initial: clipboardIsSupported() ? 'supported' : 'unsupported',
		context: {
			content: content
		},
		states: {
			supported: {
				initial: 'idle',
				states: {
					idle: {
						on: {
							COPY: {
								target: 'copying'
							}
						}
					},
					copying: {
						invoke: {
							src: fromPromise(
								async ({ input }) => await navigator.clipboard.writeText(input.content)
							),
							input: ({ context }) => context,
							onDone: {
								target: 'copied'
							},
							onError: {}
						}
					},
					copied: {
						after: {
							3000: {
								target: 'idle'
							}
						}
					}
				}
			},
			unsupported: {}
		}
	})

	const { state, send } = useMachine(copyMachine)
</script>

{#if $state.matches('supported')}
	<Button
		on:click={() => send({ type: 'COPY' })}
		disabled={!$state.can({ type: 'COPY' })}
		text={$state.matches({ supported: 'copied' }) ? textSuccess : textIdle}
	/>
{:else}
	<p>{content}</p>
{/if}
