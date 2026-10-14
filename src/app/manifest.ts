import type { MetadataRoute } from 'next'

// Lets staff add the back office to the phone home screen (needed for iPhone notifications).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PET-FRIENDLY Backoffice',
    short_name: 'PET-FRIENDLY',
    start_url: '/',
    display: 'standalone',
    background_color: '#F2F4F7',
    theme_color: '#5BC0E8',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
