<script>
	import RequestAccessDialogue from './RequestAccessDialogue.svelte'
	import { InputText, Dialog, Button } from 'delightful-ui'
	import { createEventDispatcher } from 'svelte'

	const dispatch = createEventDispatcher()

	/**
	 * @type {*}
	 */
	export let state

	export let invitationCode = ''

	let displayName = ''
</script>

<h2>Not signed in</h2>
{#if state.matches({ SignedOut: 'idle' })}
	<Button on:click={() => dispatch('create_identity')} text={{ EN: 'Create an Identity' }} />
	<!--<button on:click={() => dispatch({ type: 'USE_AUTHED_DEVICE' })}>Use an authed device</button>-->
	<Dialog title={{ EN: 'Use an authed device' }} button_title={{ EN: 'Use an authed device' }}>
		<RequestAccessDialogue on:signed_in {invitationCode} />
	</Dialog>
{:else}
	<div>
		{#if state.matches({ SignedOut: 'creatingIdentity' })}
			<form on:submit|preventDefault={() => dispatch('save_displayname', { value: displayName })}>
				<InputText bind:value={displayName} required title="Add a display name" />
				<Button type="submit" text={{ EN: 'add' }} />
			</form>
		{/if}
	</div>
{/if}

<style>
	form {
		display: flex;
		align-items: end;
		gap: 0.5rem;
	}
</style>
