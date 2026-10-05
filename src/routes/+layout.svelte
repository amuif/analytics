<script lang="ts">
  export let data: { title?: string; description?: string; url?: string };
</script>

<svelte:head>
  <title>{data.title ?? 'Decide Analytics'}</title>
  <meta name="description" content={data.description ?? 'Analytics & insights built with SvelteKit.'} />
  <meta property="og:title" content={data.title ?? 'Decide Analytics'} />
  <meta property="og:description" content={data.description ?? 'Analytics & insights built with SvelteKit.'} />
  <meta property="og:url" content={data.url ?? 'https://decide.example.com'} />
  <meta property="og:type" content="website" />
  <link rel="canonical" href={data.url ?? 'https://decide.example.com'} />
  <script type="application/ld+json">
    {`{
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Decide Analytics",
      "url": "https://decide.example.com"
    }`}
  </script>
</svelte:head>

<slot />
