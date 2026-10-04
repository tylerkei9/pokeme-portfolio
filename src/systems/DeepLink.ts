import { useGameState } from './GameState'

/**
 * Parse ?content= query param on page load and open the matching ContentModal.
 * Call once at app startup.
 */
export function handleDeepLink() {
  const params = new URLSearchParams(window.location.search)
  const contentId = params.get('content')
  if (contentId) {
    useGameState.getState().openContent(contentId)
  }
}
