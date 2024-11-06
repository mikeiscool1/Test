export function msToTime(ms: number) {
  // Convert milliseconds to total seconds
  let totalSeconds = Math.floor(ms / 1000);

  // Calculate hours, minutes, and seconds
  let hours = Math.floor(totalSeconds / 3600);
  let minutes = Math.floor((totalSeconds % 3600) / 60);
  let seconds = totalSeconds % 60;

  // Format minutes and seconds with leading zeros if necessary
  let formattedMinutes = hours > 0 ? String(minutes).padStart(2, '0') : minutes;
  let formattedSeconds = String(seconds).padStart(2, '0');

  // Return the formatted time
  return hours > 0
    ? `${hours}:${formattedMinutes}:${formattedSeconds}`
    : `${formattedMinutes}:${formattedSeconds}`;
}

export function popup(element: HTMLElement) {
  document.body.classList.add('no-events');
  element.classList.remove('d-none');
  document.getElementById('overlay')?.classList.remove('d-none');

  document.body.style.overflow = 'hidden';
}

export function removePopup(element: HTMLElement) {
  document.body.classList.remove('no-events');
  element.classList.add('d-none');
  document.getElementById('overlay')?.classList.add('d-none');

  document.body.style.overflow = 'auto';
}