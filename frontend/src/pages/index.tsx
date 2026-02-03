/**
 * Home Page
 * Feature: qr-chain-attendance
 */

export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>QR Chain Attendance System</h1>

      <p>Welcome to the QR Chain Attendance System.</p>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Getting Started</h2>
        <ul>
          <li>
            <strong>Students:</strong> Scan the session QR code to join a class
          </li>
          <li>
            <strong>Teachers:</strong> Create and manage attendance sessions
          </li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#666' }}>
        <p>
          This is a Progressive Web App. You can install it on your device for quick access.
        </p>
      </div>
    </div>
  );
}
