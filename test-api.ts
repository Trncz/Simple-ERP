import app from './server';
import http from 'http';

const server = http.createServer(app);
server.listen(4001, '0.0.0.0', async () => {
  console.log('Test api server listening on port 4001');
  try {
    const res = await fetch('http://localhost:4001/api/items', {
      headers: {
        'Authorization': 'Bearer simple-erp-mock-jwt-session-token-2026'
      }
    });
    console.log('Response Status:', res.status);
    const text = await res.text();
    console.log('Response Body:', text);
  } catch (err: any) {
    console.error('Fetch error:', err.message);
  } finally {
    server.close();
    process.exit(0);
  }
});
