import { db } from './src/server/dbStore';
console.log('Database Loaded successfully!', db ? 'yes' : 'no');
setTimeout(() => {
  console.log('Finished 3s timeout');
  process.exit(0);
}, 3000);
