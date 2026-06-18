export function enableAppLikeMode() {
  document.documentElement.setAttribute('translate', 'no')

  document.addEventListener('contextmenu', (event) => {
    const target = event.target as HTMLElement | null

    if (target?.closest('input, textarea')) {
      return
    }

    event.preventDefault()
  })
}