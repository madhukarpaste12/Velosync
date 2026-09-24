const normalizeErrorText = (error) => {
  if (!error) return '';

  if (typeof error === 'string') return error.toLowerCase();

  const fromResponse = error?.response?.data?.message || error?.response?.data?.error || '';
  const fromError = error?.message || '';
  const combined = `${fromResponse} ${fromError}`.trim();
  return combined.toLowerCase();
};

export const getUserFriendlyError = (error, fallback = 'VeloSync is temporarily unavailable. Please try again later.') => {
  if (error && error.userFriendly) return error.userFriendly;

  const status = Number(error?.response?.status || error?.status || 0);
  const raw = normalizeErrorText(error);

  if (/suspended|suspension|temporarily suspended/.test(raw)) {
    return 'Your account has been suspended. Please contact the administrator for assistance.';
  }

  if (/verify your account|please verify your account before signing in|not verified|email.*not.*verified/.test(raw)) {
    return 'Please verify your account before signing in.';
  }

  if (/no account found with this email address|email.*not.*registered|no account.*found.*email/.test(raw)) {
    return 'No account found with this email address.';
  }

  if (/invalid email or password|incorrect email or password/.test(raw)) {
    return 'Incorrect email or password. Please try again.';
  }

  if (/please enter a valid email address|invalid email/.test(raw)) {
    return 'Please enter a valid email address.';
  }

  if (/please enter your email address|email.*required/.test(raw)) {
    return 'Please enter your email address.';
  }

  if (/this user already exists|already registered|email already registered|user already exists/.test(raw)) {
    return 'This user already exists. Please sign in instead.';
  }

  if (status === 401 || /session.*expired|token.*expired|invalid.*refresh|please sign in|unauthorized|not authenticated/.test(raw)) {
    return 'Your session has expired. Please sign in again.';
  }

  if (status === 404 || /no account.*found|user not found|account.*not found|station not found|bicycle.*not found|could not be found/.test(raw)) {
    if (/station|location/.test(raw)) return "We couldn't find this station. Please try again.";
    if (/bicycle|bike/.test(raw)) return 'This bicycle could not be found. Please scan a valid VeloSync bicycle QR code.';
    return 'No account was found with these details.';
  }

  if (/you already have an active ride|active ride/.test(raw)) {
    return 'You already have an active ride. Please complete your current ride before renting another bicycle.';
  }

  if (status === 409 || /bike not available|already rented|currently in use|in use|unavailable/.test(raw)) {
    if (!/you already have an active ride|active ride/.test(raw)) {
      return 'This bicycle is currently unavailable. Please choose another bicycle.';
    }
  }

  if (/invalid email or password|incorrect email or password|email or password/.test(raw)) {
    return 'Incorrect email or password. Please try again.';
  }

  if (/invalid.*qr|qrcode|qr code.*invalid|v.*sync.*qr/.test(raw)) {
    return 'Invalid VeloSync QR code. Please scan a valid bicycle QR code.';
  }

  if (/couldn't read the qr|read the qr|qr.*read|notfoundexception|no multi format/.test(raw)) {
    return "We couldn't read the QR code. Please position the QR code clearly inside the scanning area.";
  }

  if (/unknown bicycle|bicycle.*not found|bike.*not found/.test(raw)) {
    return 'This bicycle could not be found. Please scan a valid VeloSync bicycle QR code.';
  }

  if (/already.*rented|currently in use|bike not available|bike.*unavailable|currently unavailable/.test(raw)) {
    return 'This bicycle is currently unavailable. Please choose another bicycle.';
  }

  if (/maintenance|needs maintenance|health.*good/.test(raw)) {
    return 'This bicycle is currently unavailable due to a maintenance issue.';
  }

  if (/permission.*camera|notallowed|denied.*camera|camera permission/.test(raw)) {
    return 'Camera permission is required to scan a QR code. Please allow camera access in your browser settings.';
  }

  if (/camera.*not found|no camera|no device found/.test(raw)) {
    return 'No camera was found on this device.';
  }

  if (/couldn't access.*camera|camera.*unavailable|camera.*open|failed.*camera/.test(raw)) {
    return "We couldn't access your camera. Please check your camera permissions and try again.";
  }

  if (/not supported.*camera|browser.*support|secure context|https/.test(raw)) {
    return 'Your browser does not support camera scanning. Please try using a supported browser.';
  }

  if (/insufficient wallet|wallet balance|minimum wallet balance/.test(raw)) {
    return 'Insufficient wallet balance. Please add money to your wallet before starting the ride.';
  }

  if (/this ride has already been completed|already been completed/.test(raw)) {
    return 'This ride has already been completed.';
  }

  if (/cancelled|canceled/.test(raw)) {
    return 'This ride has been cancelled.';
  }

  if (/no bicycles are currently available|station.*unavailable|no bikes.*station/.test(raw)) {
    return 'No bicycles are currently available at this station.';
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'No internet connection. Please check your network and try again.';
  }

  if (/temporarily unavailable|server unavailable|internal server error|failed to fetch|network error|econnrefused|timeout|timed out/.test(raw) || status >= 500) {
    return 'VeloSync is temporarily unavailable. Please try again later.';
  }

  if (/timed out|request took too long/.test(raw)) {
    return 'The request took too long. Please check your connection and try again.';
  }

  if (/payment.*cancelled|cancelled.*payment/.test(raw)) {
    return 'Payment was cancelled.';
  }

  if (/top[- ]?up.*failed|wallet.*failed|could not add money|payment could not be completed|unable to add money/.test(raw)) {
    return "We couldn't add money to your wallet. Please try again.";
  }

  if (/payment.*failed|could not.*complete.*payment|payment.*error/.test(raw)) {
    return 'Payment could not be completed. Please try again.';
  }

  if (/invalid amount|amount must be greater than|please enter a valid amount|greater than zero/.test(raw)) {
    return 'Please enter a valid amount.';
  }

  if (/account.*verified|verify your account|email.*not.*verified/.test(raw)) {
    return 'Please verify your account before continuing.';
  }

  if (/we couldn't start your ride|trip.*cannot start|failed to rent|unable to rent|ride rental.*unavailable/.test(raw)) {
    return "We couldn't start your ride. Please try again.";
  }

  if (/cannot.*complete.*ride|couldn't complete.*ride|trip.*cannot.*complete/.test(raw)) {
    return "We couldn't complete your ride. Please try again.";
  }

  if (/ride rental is temporarily unavailable|temporarily unavailable.*ride/.test(raw)) {
    return 'Ride rental is temporarily unavailable. Please try again later.';
  }

  if (/bicycle.*available.*while.*scanning|this bicycle is no longer available/.test(raw)) {
    return 'This bicycle is no longer available. Please choose another bicycle.';
  }

  if (/no account.*found|invalid email|email.*not registered/.test(raw)) {
    return 'No account was found with these details.';
  }

  return fallback;
};
