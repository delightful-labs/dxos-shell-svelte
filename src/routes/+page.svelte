<script>
	import DxosProvider from '$lib/components/DXOSProvider.svelte'
</script>

<DxosProvider>
	<h1>This is my app</h1>
</DxosProvider>

<style>
	@media (prefers-color-scheme: dark) {
		:global(body) {
			background-color: black;
			color: white;
		}
	}
</style>
