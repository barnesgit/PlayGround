const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]

const params = new URLSearchParams(window.location.search)
const requestName = (params.get('from') || 'Jordan Lee').trim().slice(0, 60) || 'Jordan Lee'
const requestPlace = (params.get('place') || 'Apartment 4B · Front door').trim().slice(0, 90) || 'Apartment 4B · Front door'

const requestTitle = $('#request-title')
const requestPlaceElement = $('#request-place')
const requestAvatar = $('#request-avatar')
const status = $('#status')
const preUnlock = $('#pre-unlock')
const unlocked = $('#unlocked')
const shareButton = $('#share-location')
const demoButton = $('#demo-location')
const errorElement = $('#location-error')
const codeRow = $('#unlock-code')
const codeDigits = $$('.code-digit')
const timerElement = $('#timer')
const copyButton = $('#copy-code')
const coordsText = $('#coords-text')
const mapLabel = $('#map-label')
const mapPin = $('#map-pin')

const initials = requestName
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0])
  .join('')
  .toUpperCase()

requestTitle.textContent = requestName
requestPlaceElement.textContent = requestPlace
requestAvatar.textContent = initials || 'GK'

let countdown
let activeCode = ''

function setStatus(label, state) {
  status.textContent = label
  status.dataset.state = state
}

function stopCountdown() {
  if (countdown) window.clearInterval(countdown)
  countdown = undefined
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function startCountdown() {
  stopCountdown()
  let remaining = 10 * 60
  timerElement.textContent = formatTime(remaining)
  countdown = window.setInterval(() => {
    remaining -= 1
    if (remaining <= 0) {
      stopCountdown()
      timerElement.textContent = 'Expired'
      setStatus('Expired', 'error')
      codeRow.classList.add('is-expired')
      copyButton.disabled = true
      copyButton.textContent = 'Expired'
      return
    }
    timerElement.textContent = formatTime(remaining)
  }, 1000)
}

function makeCode() {
  const random = new Uint32Array(1)
  crypto.getRandomValues(random)
  return String(random[0] % 1_000_000).padStart(6, '0')
}

function revealLocation(latitude, longitude, accuracy, source) {
  const lat = Number(latitude.toFixed(5))
  const lon = Number(longitude.toFixed(5))
  const spread = Number.isFinite(accuracy) ? Math.round(accuracy) : 18
  activeCode = makeCode()

  codeDigits.forEach((digit, index) => {
    digit.textContent = activeCode[index]
  })
  codeRow.dataset.unlocked = 'true'
  codeRow.classList.remove('is-expired')
  copyButton.disabled = false
  copyButton.textContent = 'Copy code'
  copyButton.classList.remove('is-copied')

  preUnlock.hidden = true
  unlocked.hidden = false
  errorElement.hidden = true

  coordsText.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)} · ±${spread} m`
  mapLabel.textContent = source === 'demo' ? 'Demo location · San Francisco' : 'Location confirmed'
  mapLabel.classList.add('is-located')
  mapPin.classList.add('is-located')

  setStatus('Unlocked', 'unlocked')
  startCountdown()
  document.documentElement.dataset.unlocked = 'true'
}

function showLocationError(message) {
  errorElement.textContent = message
  errorElement.hidden = false
  shareButton.disabled = false
  shareButton.querySelector('span').textContent = 'Share location & unlock'
  setStatus('Needs access', 'error')
}

function requestLocation() {
  errorElement.hidden = true
  shareButton.disabled = true
  shareButton.querySelector('span').textContent = 'Verifying location…'
  setStatus('Verifying', 'verifying')

  if (!navigator.geolocation) {
    showLocationError('This browser cannot access location. Open the link in a modern browser or use the demo location below.')
    return
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude, accuracy } = position.coords
      revealLocation(latitude, longitude, accuracy, 'gps')
    },
    error => {
      const messages = {
        1: 'Location permission was not granted. Allow location for this site, then try again — or preview with a demo location.',
        2: 'Your location is unavailable right now. Check your connection or preview with a demo location.',
        3: 'Locating took too long. Try again or preview with a demo location.'
      }
      showLocationError(messages[error.code] || 'We could not confirm your location. Try again or use the demo location.')
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  )
}

function useDemoLocation() {
  errorElement.hidden = true
  shareButton.disabled = false
  shareButton.querySelector('span').textContent = 'Share location & unlock'
  revealLocation(37.7749, -122.4194, 18, 'demo')
}

async function copyCode() {
  if (!activeCode) return
  try {
    await navigator.clipboard.writeText(activeCode)
  } catch {
    const field = document.createElement('textarea')
    field.value = activeCode
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.append(field)
    field.select()
    document.execCommand('copy')
    field.remove()
  }
  copyButton.textContent = 'Copied'
  copyButton.classList.add('is-copied')
  window.setTimeout(() => {
    copyButton.textContent = 'Copy code'
    copyButton.classList.remove('is-copied')
  }, 1800)
}

shareButton.addEventListener('click', requestLocation)
demoButton.addEventListener('click', useDemoLocation)
copyButton.addEventListener('click', copyCode)

if (params.get('demo') === '1') useDemoLocation()

document.documentElement.dataset.appReady = 'true'
