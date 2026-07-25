// Minimal client-side navigation: pushState + a manually-dispatched
// popstate so listeners (e.g. App's router) react the same way they would
// to a real back/forward navigation, without a full page reload.
export function navigateTo(path: string) {
  if (window.location.pathname !== path) {
    window.history.pushState(null, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.scrollTo(0, 0)
  }
}
