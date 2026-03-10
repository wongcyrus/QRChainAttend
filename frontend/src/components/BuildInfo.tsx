export default function BuildInfo() {
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown';
  const buildEnv = process.env.NEXT_PUBLIC_BUILD_ENV || 'unknown';
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      fontSize: '11px',
      color: '#666',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      padding: '4px 8px',
      borderRadius: '4px',
      border: '1px solid #ddd',
      zIndex: 9999
    }}>
      <div>Build: {buildTime}</div>
      <div>Env: {buildEnv}</div>
    </div>
  );
}
