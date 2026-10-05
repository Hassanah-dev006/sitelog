/**
 * Tells the supervisor, in plain words, where their report currently is.
 *
 * "Pending" or a spinner is not enough reassurance when someone has just
 * spent ten minutes on a form and the signal bar is empty.
 */
export default function OutboxBanner({ online, pending, sending }) {
  if (pending === 0 && online) return null;

  if (pending > 0) {
    const n = pending === 1 ? '1 report is' : `${pending} reports are`;
    return (
      <p className={`alert ${online ? 'alert-pending' : 'alert-offline'}`} role="status">
        <strong>{n} saved on this phone.</strong>{' '}
        {sending
          ? 'Sending now…'
          : online
            ? 'Sending as soon as the connection allows.'
            : 'They will send by themselves once you have signal. You can close the app.'}
      </p>
    );
  }

  return (
    <p className="alert alert-offline" role="status">
      <strong>No connection.</strong> You can still fill in reports — they are saved here and
      sent automatically later.
    </p>
  );
}
